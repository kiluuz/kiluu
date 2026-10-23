import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCommunityNotification } from "@/lib/community";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { awardXpInTransaction, getXpTotal, getXpTotals, levelFromXp } from "@/lib/xp";
import { evaluateAchievements } from "@/lib/achievements";
import { emitEvent } from "@/lib/events";

const COMMENT_USER = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  accentColor: true,
  avatarFrame: true,
  equippedAvatarFrameId: true,
  equippedNameFrameId: true,
  role: true,
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cursor = req.nextUrl.searchParams.get("cursor");
  const comments = await db.comment.findMany({
    where: { postId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 101,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: COMMENT_USER },
      _count: { select: { likes: true, replies: true } },
    },
  });
  const xpTotals = await getXpTotals(comments.map((comment) => comment.userId));
  return NextResponse.json({
    comments: comments.slice(0, 100).map(({ _count, ...comment }) => ({
      ...comment,
      user: {
        ...comment.user,
        level: levelFromXp(xpTotals.get(comment.userId) ?? 0).level,
      },
      likeCount: _count.likes,
      replyCount: _count.replies,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to comment" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-comment:${user.id}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many comments. Please try again later." }, { status: 429 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? sanitizeText(body.content, 500) : "";
  const parentId = typeof body.parentId === "string" ? body.parentId : null;
  if (!content) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });

  const result = await db.$transaction(async (tx) => {
    const post = await tx.post.findFirst({ where: { id, hidden: false } });
    if (!post) return { error: "Post not found" as const };
    let parent: { userId: string } | null = null;
    if (parentId) {
      parent = await tx.comment.findFirst({ where: { id: parentId, postId: id } });
      if (!parent) return { error: "Reply target not found" as const };
    }
    const comment = await tx.comment.create({
      data: { userId: user.id, postId: id, parentId, content },
      include: { user: { select: COMMENT_USER }, _count: { select: { likes: true, replies: true } } },
    });
    await awardXpInTransaction(tx, user.id, "comment", comment.id);
    const recipient = parent?.userId ?? post.userId;
    await createCommunityNotification(
      tx,
      recipient,
      user.id,
      parent ? "REPLY" : "COMMENT",
      parent ? "New reply" : "New comment",
      `${user.displayName || user.username} ${parent ? "replied to your comment" : "commented on your post"}`,
      { postId: id, commentId: comment.id }
    );
    const { _count, ...commentData } = comment;
    return { comment: { ...commentData, likeCount: _count.likes, replyCount: _count.replies } };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  await evaluateAchievements(user.id);
  await emitEvent(user, "comment_created", { postId: id, commentId: result.comment.id, content });
  const xpTotal = await getXpTotal(user.id);
  return NextResponse.json({
    comment: {
      ...result.comment,
      user: { ...result.comment.user, level: levelFromXp(xpTotal).level },
    },
  }, { status: 201 });
}
