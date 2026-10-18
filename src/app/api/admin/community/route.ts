import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";
import { sanitizeText } from "@/lib/sanitize";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const reports = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { reporter: { select: { id: true, username: true, displayName: true } } },
  });
  const postIds = reports.filter((report) => report.targetType === "POST").map((report) => report.targetId);
  const commentIds = reports.filter((report) => report.targetType === "COMMENT").map((report) => report.targetId);
  const userIds = reports.filter((report) => report.targetType === "USER").map((report) => report.targetId);
  const [posts, comments, users] = await Promise.all([
    db.post.findMany({ where: { id: { in: postIds } }, select: { id: true, content: true, user: { select: { username: true } } } }),
    db.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, content: true, user: { select: { username: true } } } }),
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, displayName: true } }),
  ]);
  const targets = new Map<string, { content: string; owner: string }>();
  for (const post of posts) targets.set(`POST:${post.id}`, { content: post.content, owner: post.user.username });
  for (const comment of comments) targets.set(`COMMENT:${comment.id}`, { content: comment.content, owner: comment.user.username });
  for (const target of users) targets.set(`USER:${target.id}`, { content: target.displayName || target.username, owner: target.username });
  return NextResponse.json({
    reports: reports.map((report) => ({
      ...report,
      target: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const reportId = typeof body.reportId === "string" ? body.reportId : null;
  const targetType = typeof body.targetType === "string" ? body.targetType : "";
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!["hide", "unhide", "delete", "block", "unblock", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid moderation action" }, { status: 400 });
  }

  if (reportId) {
    const report = await db.report.findUnique({ where: { id: reportId } });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    const resolvedType = report.targetType;
    const resolvedId = report.targetId;
    const validAction =
      action === "dismiss" ||
      (resolvedType === "POST" && ["hide", "unhide", "delete"].includes(action)) ||
      (resolvedType === "COMMENT" && action === "delete") ||
      (resolvedType === "USER" && ["block", "unblock"].includes(action));
    if (!validAction) return NextResponse.json({ error: "Action is not valid for this report" }, { status: 400 });
    await db.$transaction(async (tx) => {
      if (action === "hide" && resolvedType === "POST") {
        await tx.post.update({ where: { id: resolvedId }, data: { hidden: true } });
      } else if (action === "delete" && resolvedType === "POST") {
        await tx.post.delete({ where: { id: resolvedId } });
      } else if (action === "delete" && resolvedType === "COMMENT") {
        await tx.comment.delete({ where: { id: resolvedId } });
      } else if (action === "block" && resolvedType === "USER") {
        await tx.user.update({ where: { id: resolvedId }, data: { communityBlocked: true } });
      } else if (action === "unblock" && resolvedType === "USER") {
        await tx.user.update({ where: { id: resolvedId }, data: { communityBlocked: false } });
      }
      await tx.report.update({
        where: { id: reportId },
        data: { status: action === "dismiss" ? "DISMISSED" : action === "hide" ? "HIDDEN" : "DISMISSED" },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (!targetId || !["POST", "COMMENT", "USER"].includes(targetType)) {
    return NextResponse.json({ error: "targetType and targetId are required" }, { status: 400 });
  }
  if (targetType === "POST") {
    if (action === "hide" || action === "unhide") {
      await db.post.update({ where: { id: targetId }, data: { hidden: action === "hide" } });
    } else if (action === "delete") {
      await db.post.delete({ where: { id: targetId } });
    }
  } else if (targetType === "COMMENT" && action === "delete") {
    await db.comment.delete({ where: { id: targetId } });
  } else if (targetType === "USER" && (action === "block" || action === "unblock")) {
    await db.user.update({
      where: { id: targetId },
      data: { communityBlocked: action === "block" },
    });
  } else {
    return NextResponse.json({ error: "Action is not valid for this target" }, { status: 400 });
  }
  if (typeof body.reason === "string" && body.reason.trim()) {
    console.info("Community moderation action", { actorId: user?.id, targetType, targetId, action, reason: sanitizeText(body.reason, 250) });
  }
  return NextResponse.json({ ok: true });
}
