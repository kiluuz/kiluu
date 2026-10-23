// src/app/api/seasonal-events/route.ts
import { NextResponse } from "next/server";
import { getActiveSeasonalEvent } from "@/lib/seasonal-events";

export async function GET() {
  try {
    const event = await getActiveSeasonalEvent();
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Seasonal event get error:", error);
    return NextResponse.json({ error: "Mavsumiy tadbirni yuklashda xatolik" }, { status: 500 });
  }
}
