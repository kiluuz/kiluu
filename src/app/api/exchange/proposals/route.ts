import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ received: [], sent: [], archived: true });
}

export async function POST() {
  return NextResponse.json({ error: "Exchange archived. Use /api/gifts" }, { status: 410 });
}
