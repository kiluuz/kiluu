import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

class FramePurchaseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const slug = body && typeof body === "object" && "slug" in body && typeof body.slug === "string"
    ? body.slug
    : "";
  if (!slug || slug.length > 100) return NextResponse.json({ error: "Choose a valid frame" }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      const frame = await tx.frame.findUnique({ where: { slug } });
      if (!frame?.isActive) throw new FramePurchaseError("FRAME_NOT_FOUND", 404);
      if (!["shop", "both"].includes(frame.acquisition) || frame.priceCredits === null) {
        throw new FramePurchaseError("MISSION_REWARD", 400);
      }
      if (await tx.userFrame.findUnique({
        where: { userId_frameId: { userId: user.id, frameId: frame.id } },
      })) {
        throw new FramePurchaseError("ALREADY_OWNED", 409);
      }

      const charged = await tx.user.updateMany({
        where: { id: user.id, credits: { gte: frame.priceCredits } },
        data: { credits: { decrement: frame.priceCredits } },
      });
      if (charged.count !== 1) throw new FramePurchaseError("INSUFFICIENT_CREDITS", 402);

      await tx.userFrame.create({
        data: { userId: user.id, frameId: frame.id, source: "purchase" },
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -frame.priceCredits,
          type: "PURCHASE",
          description: `Purchased ${frame.name} frame`,
          refType: "frame",
          refId: frame.id,
          idempotencyKey: `frame-purchase:${user.id}:${frame.id}`,
        },
      });
      const updated = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { credits: true },
      });
      return { credits: updated.credits, frame: frame.name };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FramePurchaseError) {
      const message = error.message === "INSUFFICIENT_CREDITS"
        ? "Not enough credits"
        : error.message === "ALREADY_OWNED"
          ? "You already own this frame"
          : error.message === "MISSION_REWARD"
            ? "This frame is only available as a mission reward"
            : "Frame not found";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You already own this frame" }, { status: 409 });
    }
    console.error("Frame purchase failed", error);
    return NextResponse.json({ error: "Frame purchase failed" }, { status: 500 });
  }
}
