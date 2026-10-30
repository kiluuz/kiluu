// src/app/api/clubs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateLevel } from "@/lib/level-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    const club = await db.club.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        chatRoom: {
          select: { id: true, slowMode: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                avatarFrame: true,
                lastSeenAt: true,
                xpEvents: { select: { amount: true } },
              },
            },
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!club) {
      return NextResponse.json({ error: "Klub topilmadi" }, { status: 404 });
    }

    const myMembership = user
      ? club.members.find((m) => m.userId === user.id)
      : null;
    const isStaff =
      myMembership?.role === "owner" ||
      myMembership?.role === "mod" ||
      user?.role === "admin" ||
      user?.role === "ADMIN";

    if (!club.isPublic && !myMembership && !isStaff) {
      return NextResponse.json({ error: "Bu yopiq klub. Faqat a'zolar ko'ra oladi" }, { status: 403 });
    }

    let joinRequests: any = null;
    let invites: any = null;

    if (isStaff) {
      joinRequests = await db.clubJoinRequest.findMany({
        where: { clubId: id, status: "pending" },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      invites = await db.clubInvite.findMany({
        where: { clubId: id },
        orderBy: { createdAt: "desc" },
      });
    }

    const presenceCutoff = new Date(Date.now() - 5 * 60_000);
    const onlineMembersCount = club.members.filter(
      (m) => (m.user as any).lastSeenAt && (m.user as any).lastSeenAt >= presenceCutoff
    ).length;
    const finalOnlineCount = Math.max(myMembership ? 1 : 0, onlineMembersCount);

    const formattedMembers = club.members.map((m) => {
      const totalXp = m.user.xpEvents.reduce((s, e) => s + e.amount, 0);
      const levelInfo = calculateLevel(totalXp);
      const isOnline = Boolean((m.user as any).lastSeenAt && (m.user as any).lastSeenAt >= presenceCutoff);
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        mutedUntil: m.mutedUntil,
        user: {
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName || m.user.username,
          avatarUrl: m.user.avatarUrl,
          avatarFrame: m.user.avatarFrame,
          level: levelInfo.level,
          isOnline,
        },
      };
    });

    return NextResponse.json({
      club: {
        id: club.id,
        name: club.name,
        tag: club.tag,
        description: club.description,
        avatarUrl: club.avatarUrl,
        bannerUrl: club.bannerUrl,
        isPublic: club.isPublic,
        level: club.level,
        xp: club.xp,
        createdAt: club.createdAt,
        owner: club.owner,
        memberCount: club._count.members,
        onlineCount: finalOnlineCount,
        chatRoomId: club.chatRoom?.id || `club:${club.id}`,
        slowMode: club.chatRoom?.slowMode || 0,
        myRole: myMembership?.role || null,
        members: formattedMembers,
        joinRequests,
        invites,
      },
    });
  } catch (error) {
    console.error("Club details error:", error);
    return NextResponse.json({ error: "Klub ma'lumotlarini yuklashda xatolik" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const membership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    const isStaff =
      membership?.role === "owner" ||
      membership?.role === "mod" ||
      user.role === "admin" ||
      user.role === "ADMIN";
    if (!isStaff) {
      return NextResponse.json({ error: "Klubni tahrirlash huquqingiz yo'q" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, avatarUrl, bannerUrl, isPublic, slowMode } = body;

    const data: any = {};
    if (name) data.name = String(name).trim().slice(0, 40);
    if (description !== undefined) data.description = description ? String(description).trim().slice(0, 500) : null;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (bannerUrl !== undefined) data.bannerUrl = bannerUrl;
    if (isPublic !== undefined) data.isPublic = Boolean(isPublic);

    const updated = await db.club.update({
      where: { id },
      data,
    });

    if (slowMode !== undefined) {
      const slowSec = Math.max(0, Math.min(300, parseInt(String(slowMode), 10) || 0));
      await db.chatRoom.updateMany({
        where: { type: "club", refId: id },
        data: { slowMode: slowSec },
      });
    }

    return NextResponse.json({ ok: true, club: updated });
  } catch (error) {
    console.error("Update club error:", error);
    return NextResponse.json({ error: "Klubni tahrirlashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const club = await db.club.findUnique({
      where: { id },
    });
    if (!club) {
      return NextResponse.json({ error: "Klub topilmadi" }, { status: 404 });
    }

    const isOwner = club.ownerId === user.id || user.role === "admin" || user.role === "ADMIN";
    if (!isOwner) {
      return NextResponse.json({ error: "Faqat klub egasi klubni o'chira oladi" }, { status: 403 });
    }

    await db.club.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete club error:", error);
    return NextResponse.json({ error: "Klubni o'chirishda xatolik" }, { status: 500 });
  }
}
