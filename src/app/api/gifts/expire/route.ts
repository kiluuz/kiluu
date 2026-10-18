import { NextResponse } from "next/server";
import { expirePendingGifts } from "@/lib/gifts";

/** Cron: expire pending gifts past deadline. */
export async function POST() {
  const expired = await expirePendingGifts();
  return NextResponse.json({ expired });
}
