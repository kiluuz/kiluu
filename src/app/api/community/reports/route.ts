import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to report content" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-report:${user.id}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Report limit reached. Please try again later." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const targetType = body.targetType;
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const reason = typeof body.reason === "string" ? sanitizeText(body.reason, 400) : "";
  if (!["POST", "COMMENT", "USER"].includes(String(targetType)) || !targetId || !reason) {
    return NextResponse.json({ error: "A target and report reason are required" }, { status: 400 });
  }
  if (targetType === "POST" && !(await db.post.findUnique({ where: { id: targetId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (targetType === "COMMENT" && !(await db.comment.findUnique({ where: { id: targetId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (targetType === "USER" && !(await db.user.findUnique({ where: { id: targetId }, select: { id: true } }))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const prior = await db.report.findFirst({
    where: { reporterId: user.id, targetType: String(targetType), targetId, status: "OPEN" },
    select: { id: true },
  });
  if (prior) return NextResponse.json({ ok: true, duplicate: true });
  const report = await db.report.create({
    data: { reporterId: user.id, targetType: String(targetType), targetId, reason },
  });
  return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
}
