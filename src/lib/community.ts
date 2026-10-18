import type { PostAward, Prisma } from "@prisma/client";
import { APP_CONFIG } from "@/lib/config";
import { awardXpInTransaction } from "@/lib/xp";

export const COMMUNITY_CATEGORIES = [
  "Theories",
  "Reviews",
  "Discussions",
  "Memes",
  "Fan Art",
  "Recommendations",
  "UZ Dubbing",
  "Watch Parties",
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];
export const POST_AWARD_COST = APP_CONFIG.awardCost;

export async function createCommunityNotification(
  tx: Prisma.TransactionClient,
  recipientId: string,
  actorId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  if (recipientId === actorId) return;
  await tx.notification.create({
    data: { userId: recipientId, type, title, body, dataJson: JSON.stringify(data) },
  });
}

export function canDeleteCommunityPost(ownerId: string, requesterId: string, isAdmin: boolean): boolean {
  return ownerId === requesterId || isAdmin;
}

export async function awardCommunityPost(
  tx: Prisma.TransactionClient,
  opts: {
    userId: string;
    actorName: string;
    postId: string;
    idempotencyKey: string;
    cost: number;
    authorSharePercent: number;
  }
): Promise<
  | { error: "KEY_CONFLICT" | "POST_NOT_FOUND" | "SELF_AWARD" | "INSUFFICIENT_CREDITS" }
  | { award: PostAward; replay: boolean }
> {
  const previous = await tx.postAward.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
  if (previous) {
    if (previous.userId !== opts.userId || previous.postId !== opts.postId) return { error: "KEY_CONFLICT" as const };
    return { award: previous, replay: true };
  }
  const post = await tx.post.findFirst({ where: { id: opts.postId, hidden: false } });
  if (!post) return { error: "POST_NOT_FOUND" as const };
  if (post.userId === opts.userId) return { error: "SELF_AWARD" as const };
  const debit = await tx.user.updateMany({
    where: { id: opts.userId, credits: { gte: opts.cost } },
    data: { credits: { decrement: opts.cost } },
  });
  if (debit.count !== 1) return { error: "INSUFFICIENT_CREDITS" as const };

  const authorShare = Math.floor(opts.cost * Math.min(100, Math.max(0, opts.authorSharePercent)) / 100);
  const award = await tx.postAward.create({
    data: {
      userId: opts.userId,
      postId: opts.postId,
      cost: opts.cost,
      authorShare,
      idempotencyKey: opts.idempotencyKey,
    },
  });
  await awardXpInTransaction(tx, opts.userId, "award_given", award.id);
  await tx.creditTransaction.create({
    data: {
      userId: opts.userId,
      amount: -opts.cost,
      type: "AWARD",
      description: "Awarded a community post",
      refType: "post_award",
      refId: award.id,
      idempotencyKey: `community-award-spend:${opts.idempotencyKey}`,
    },
  });
  if (authorShare > 0) {
    await tx.user.update({ where: { id: post.userId }, data: { credits: { increment: authorShare } } });
    await tx.creditTransaction.create({
      data: {
        userId: post.userId,
        amount: authorShare,
        type: "AWARD",
        description: "Received a community post award",
        refType: "post_award",
        refId: award.id,
        idempotencyKey: `community-award-share:${opts.idempotencyKey}`,
      },
    });
  }
  await createCommunityNotification(
    tx,
    post.userId,
    opts.userId,
    "AWARD",
    "Post awarded",
    `${opts.actorName} awarded your post`,
    { postId: opts.postId, awardId: award.id }
  );
  return { award, replay: false };
}
