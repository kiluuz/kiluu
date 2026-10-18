import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Exchange archived. Use /api/gifts" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Exchange archived. Use /api/gifts" }, { status: 410 });
}
