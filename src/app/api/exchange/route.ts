import { NextResponse } from "next/server";

const EXCHANGE_UNLOCK_COUNT = 20;

/** 4-qism: Exchange archived (tables kept). Gift is the live flow. */
export async function GET() {
  return NextResponse.json({
    offers: [],
    archived: true,
    eligibility: { unlocked: false, purchaseCount: 0, required: EXCHANGE_UNLOCK_COUNT, ownedAnimes: [] },
    message: "Exchange archived. Use /api/gifts",
  });
}
