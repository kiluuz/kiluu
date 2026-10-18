import { createHmac, timingSafeEqual } from "node:crypto";
export { expectedPlaybackPosition, playbackCorrection } from "./watch-party-sync";

export interface PartyTicket {
  partyId: string;
  userId: string;
  exp: number;
}

function ticketSecret(): string {
  const secret = process.env.WATCH_PARTY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("WATCH_PARTY_SECRET must contain at least 32 characters");
  }
  return secret;
}

export function createPartyTicket(userId: string, partyId: string, now = Date.now()): string {
  const payload: PartyTicket = {
    partyId,
    userId,
    exp: Math.floor(now / 1000) + 8 * 60 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", ticketSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyPartyTicket(ticket: string, now = Date.now()): PartyTicket | null {
  const [encoded, signature, extra] = ticket.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = createHmac("sha256", ticketSecret()).update(encoded).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PartyTicket>;
    if (
      typeof payload.partyId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(now / 1000)
    ) return null;
    return payload as PartyTicket;
  } catch {
    return null;
  }
}
