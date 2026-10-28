import { timingSafeEqual } from "node:crypto";

export const INTERNAL_SECRET_HEADER = "x-internal-secret";

export function internalBridgeConfigured(): boolean {
  return Boolean(process.env.MOBILE_BRIDGE_SECRET);
}

export function internalRequestAuthorized(supplied: string | null): boolean {
  const secret = process.env.MOBILE_BRIDGE_SECRET;
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret, "utf8");
  const given = Buffer.from(supplied, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
