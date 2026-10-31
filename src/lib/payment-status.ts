/**
 * Customer top-ups are paused by default while the Payme integration is
 * being set up. Set PAYMENTS_MAINTENANCE=0 (or off/false/no) to turn the
 * payment UI and both top-up endpoints back on.
 */
export function paymentsMaintenance(): boolean {
  const raw = (process.env.PAYMENTS_MAINTENANCE || "").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(raw);
}
