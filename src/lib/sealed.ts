import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";

export class SealedConfigError extends Error {
  readonly code = "SEALED_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "SealedConfigError";
  }
}

function key(): Buffer {
  const raw = (process.env.DONATIONALERTS_TOKEN_KEY || "").trim();
  if (!raw) throw new SealedConfigError("DONATIONALERTS_TOKEN_KEY is not set");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new SealedConfigError("DONATIONALERTS_TOKEN_KEY must be 32 bytes (base64 or 64-char hex)");
  }
  return buf;
}

export function sealingReady(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** AES-256-GCM, format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unsupported sealed value");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Corrupt sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function sealJson(value: unknown): string {
  return seal(JSON.stringify(value));
}

export function openJson<T>(sealed: string): T {
  return JSON.parse(open(sealed)) as T;
}
