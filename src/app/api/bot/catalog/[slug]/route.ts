import { NextRequest, NextResponse } from "next/server";
import { getBotAnime } from "@/lib/bot-api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const data = await getBotAnime(resolvedParams.slug);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes("404") ? 404 : 500 });
  }
}
