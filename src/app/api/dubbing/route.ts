import { NextResponse } from "next/server";

function unavailable() {
  return NextResponse.json({ error: "AI dubbing is not available yet" }, { status: 410 });
}

export async function GET() {
  return unavailable();
}

export async function POST() {
  return unavailable();
}
