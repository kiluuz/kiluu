// src/app/api/clubs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkLevelGate, EXTRA_CLUB_COST_CREDITS } from "@/lib/chat";
import { calculateLevel } from "@/lib/level-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "popular"; // popular | level | new | my
    const search = (searchParams.get("search") || "").trim();

    let orderBy: any = { members: { _count: "desc" } };
    if (tab === "level") orderBy = { xp: "desc" };
    if (tab === "new") orderBy = { createdAt: "desc" };

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { tag: { contains: search.toUpperCase(), mode: "insensitive" } },
      ];
    }

    if (tab === "my" && user) {
      where.members = {
        some: { userId: user.id },
      };
    }

    const clubs = await db.club.findMany({
      where,
      orderBy,
      take: 50,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { members: true },
        },
        chatRoom: {
          select: { id: true },
        },
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                lastSeenAt: true,
              },
            },
          },
        },
      },
    });

    const presenceCutoff = new Date(Date.now() - 5 * 60_000);
    const formatted = clubs.map((c) => {
      const myRole = user ? c.members.find((m) => m.userId === user.id)?.role || null : null;
      const onlineCount = c.members.filter((m) => m.user?.lastSeenAt && m.user.lastSeenAt >= presenceCutoff).length;
      return {
        id: c.id,
        name: c.name,
        tag: c.tag,
        description: c.description,
        avatarUrl: c.avatarUrl,
        bannerUrl: c.bannerUrl,
        isPublic: c.isPublic,
        level: c.level,
        xp: c.xp,
        createdAt: c.createdAt,
        memberCount: c._count.members,
        onlineCount: Math.max(myRole ? 1 : 0, onlineCount),
        owner: c.owner,
        chatRoomId: c.chatRoom?.id || `club:${c.id}`,
        myRole,
      };
    });

    return NextResponse.json({ clubs: formatted });
  } catch (error) {
    console.error("Clubs list error:", error);
    return NextResponse.json({ error: "Klublar ro'yxatini yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Klub yaratish uchun tizimga kiring" }, { status: 401 });
    }

    // Level tekshiruvi (default kamida 10-daraja)
    const xpTotal = await db.xpEvent.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });
    const levelInfo = calculateLevel(xpTotal._sum.amount || 0);
    const allowed = await checkLevelGate("create_club", levelInfo.level);
    if (!allowed) {
      return NextResponse.json(
        { error: "Klub yaratish uchun kamida 10-daraja bo'lishingiz kerak" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, tag, description, avatarUrl, bannerUrl, isPublic = true } = body;

    const trimmedName = (name || "").trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      return NextResponse.json({ error: "Klub nomi 2 tadan 40 tagacha belgidan iborat bo'lishi kerak" }, { status: 400 });
    }

    const cleanTag = (tag || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{2,4}$/.test(cleanTag)) {
      return NextResponse.json(
        { error: "Klub tegi 2-4 ta lotin harflari yoki raqamlardan iborat bo'lishi kerak (masalan, UZ, PRO, KILU)" },
        { status: 400 }
      );
    }

    // Taqiqlangan so'zlar
    const forbiddenTags = ["ADMIN", "MOD", "ROOT", "NULL", "BOT"];
    if (forbiddenTags.includes(cleanTag)) {
      return NextResponse.json({ error: "Ushbu tegdan foydalanish taqiqlangan" }, { status: 400 });
    }

    // Teg noyobligi
    const existingClubTag = await db.club.findUnique({
      where: { tag: cleanTag },
    });
    if (existingClubTag) {
      return NextResponse.json({ error: `[${cleanTag}] tegi allaqachon band qilingan` }, { status: 409 });
    }

    // User yaratgan klublar soni (1 ta bepul, keyingisi 200 kredit)
    const ownedClubsCount = await db.club.count({
      where: { ownerId: user.id },
    });

    let creditsDeducted = 0;
    if (ownedClubsCount >= 1) {
      if (user.credits < EXTRA_CLUB_COST_CREDITS) {
        return NextResponse.json(
          {
            error: `1 ta klub bepul. Qo'shimcha klub ochish uchun ${EXTRA_CLUB_COST_CREDITS} kredit kerak. Sizda: ${user.credits} kredit`,
          },
          { status: 400 }
        );
      }
      creditsDeducted = EXTRA_CLUB_COST_CREDITS;
    }

    // User maksimum 3 ta klubga a'zo bo'la oladi
    const currentMemberships = await db.clubMember.count({
      where: { userId: user.id },
    });
    if (currentMemberships >= 3) {
      return NextResponse.json({ error: "Siz ko'pi bilan 3 ta klubga a'zo bo'la olasiz" }, { status: 400 });
    }

    // Tranzaksiya orqali yaratish
    const newClub = await db.$transaction(async (tx) => {
      if (creditsDeducted > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { credits: { decrement: creditsDeducted } },
        });
        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: -creditsDeducted,
            type: "CLUB_CREATE",
            description: `Yangi klub yaratildi: [${cleanTag}] ${trimmedName}`,
          },
        });
      }

      const club = await tx.club.create({
        data: {
          name: trimmedName,
          tag: cleanTag,
          description: description?.trim() || null,
          avatarUrl: avatarUrl || null,
          bannerUrl: bannerUrl || null,
          isPublic: Boolean(isPublic),
          ownerId: user.id,
        },
      });

      // Owner sifatida a'zolik qo'shish
      await tx.clubMember.create({
        data: {
          clubId: club.id,
          userId: user.id,
          role: "owner",
        },
      });

      // Chat xonasi yaratish
      await tx.chatRoom.create({
        data: {
          type: "club",
          refId: club.id,
          clubId: club.id,
        },
      });

      return club;
    });

    return NextResponse.json({
      ok: true,
      club: {
        ...newClub,
        chatRoomId: `club:${newClub.id}`,
      },
    });
  } catch (error) {
    console.error("Create club error:", error);
    return NextResponse.json({ error: "Klub yaratishda xatolik yuz berdi" }, { status: 500 });
  }
}
