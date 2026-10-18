import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateKey(req: NextRequest, bucket: string): string {
  return `${bucket}:${clientIp(req)}`;
}
