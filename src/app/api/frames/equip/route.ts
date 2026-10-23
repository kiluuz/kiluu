import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid frame selection" }, { status: 400 });
  const type = "type" in body && (body.type === "avatar" || body.type === "name") ? body.type : null;
  const frameId = "frameId" in body && typeof body.frameId === "string" ? body.frameId : null;
  if (!type) return NextResponse.json({ error: "Invalid frame type" }, { status: 400 });

  if (frameId) {
    const frame = await db.frame.findFirst({
      where: { id: frameId, type, isActive: true },
      select: { id: true },
    });
    if (!frame) return NextResponse.json({ error: "Frame not found" }, { status: 404 });
    const owned = await db.userFrame.findUnique({
      where: { userId_frameId: { userId: user.id, frameId } },
      select: { frameId: true },
    });
    if (!owned) return NextResponse.json({ error: "You do not own this frame" }, { status: 403 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: type === "avatar"
      ? { equippedAvatarFrameId: frameId }
      : { equippedNameFrameId: frameId },
    select: { equippedAvatarFrameId: true, equippedNameFrameId: true },
  });
  return NextResponse.json({ equipped: updated });
}
