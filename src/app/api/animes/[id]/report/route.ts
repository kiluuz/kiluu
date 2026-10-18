import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = sanitizeText(String(body.reason || "copyright"), 400);
  const anime = await db.anime.findFirst({ where: { OR: [{ id }, { slug: id }] } });
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.report.create({
    data: {
      reporterId: user.id,
      targetType: "ANIME",
      targetId: anime.id,
      reason,
    },
  });
  return NextResponse.json({ ok: true });
}
