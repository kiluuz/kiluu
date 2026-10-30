// src/app/api/chat/rooms/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkRoomAccess,
  chatRateLimit,
  checkLevelGate,
  pushToRoom,
  awardClubXp,
  notifyTelegramUser,
  getOrCreateRoom,
} from "@/lib/chat";
import { emitEvent } from "@/lib/events";
import { isDurableMediaUrl } from "@/lib/storage";
import { calculateLevel } from "@/lib/level-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Telegram HTML parse_mode: foydalanuvchi kiritgan matn teglarni buzmasligi uchun
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: rawRoomId } = await context.params;
    const user = await getCurrentUser();

    const room = await getOrCreateRoom(rawRoomId);
    if (!room) {
      return NextResponse.json({ error: "Xona topilmadi" }, { status: 404 });
    }

    if (user) {
      const access = await checkRoomAccess(rawRoomId, user.id);
      if (!access.allowed) {
        return NextResponse.json({ error: access.reason || "Kirish ruxsati yo'q" }, { status: 403 });
      }
    } else if (room.type === "club") {
      return NextResponse.json({ error: "Klub chatiga kirish uchun tizimga kiring" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const after = searchParams.get("after");

    const whereClause: any = {
      roomId: room.id,
    };

    if (after) {
      // Polling rejimi uchun: faqat ko'rsatilgan vaqtdan keyingi xabarlar
      whereClause.createdAt = { gt: new Date(after) };
    }

    const messages = await db.chatMessage.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: after ? "asc" : "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarFrame: true,
            role: true,
            clubMemberships: {
              select: { club: { select: { tag: true, name: true } } },
              take: 1,
            },
            xpEvents: { select: { amount: true } },
          },
        },
        replyTo: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
        reactions: {
          select: { id: true, emote: true, userId: true },
        },
        poll: {
          include: { votes: true },
        },
        pins: {
          select: { id: true, pinnedBy: true, createdAt: true },
        },
      },
    });

    const hasMore = !after && messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Normal ro'yxat uchun vaqt tartibida
    if (!after) {
      resultMessages.reverse();
    }

    // Spoiler va tomosha tekshiruvi
    const watchedEpisodeSet = new Set<string>();
    if (user) {
      const episodesInChat = resultMessages
        .filter((m) => m.animeId && m.episodeNo)
        .map((m) => ({ animeId: m.animeId!, epNo: m.episodeNo! }));

      if (episodesInChat.length > 0) {
        const events = await db.watchEvent.findMany({
          where: {
            userId: user.id,
            animeId: { in: [...new Set(episodesInChat.map((e) => e.animeId))] },
          },
          select: { animeId: true, episode: { select: { number: true } } },
        });

        for (const ev of events) {
          if (ev.episode?.number) {
            watchedEpisodeSet.add(`${ev.animeId}:${ev.episode.number}`);
          }
        }
      }
    }

    // Anime kartalari uchun ma'lumotlarni yig'ish
    const animeIds = [...new Set(resultMessages.filter((m) => m.animeId).map((m) => m.animeId!))];
    const animesMap = new Map<string, any>();
    if (animeIds.length > 0) {
      const animeRecords = await db.anime.findMany({
        where: { id: { in: animeIds } },
        select: {
          id: true,
          title: true,
          altTitle: true,
          coverImage: true,
          price: true,
          rating: true,
        },
      });
      for (const a of animeRecords) animesMap.set(a.id, a);
    }

    const formattedMessages = resultMessages.map((m) => {
      const totalXp = m.user.xpEvents.reduce((s, e) => s + e.amount, 0);
      const levelInfo = calculateLevel(totalXp);
      const clubTag = m.user.clubMemberships[0]?.club?.tag ?? null;

      const hasSpoilerTag = !!(m.animeId && m.episodeNo);
      const isOwner = user?.id === m.userId;
      const isWatched = user ? watchedEpisodeSet.has(`${m.animeId}:${m.episodeNo}`) : false;
      const spoilerHidden = hasSpoilerTag && !isOwner && !isWatched;

      // Reaksiyalarni guruhlash
      const reactionCounts: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
      for (const r of m.reactions) {
        if (!reactionCounts[r.emote]) {
          reactionCounts[r.emote] = { count: 0, users: [], hasReacted: false };
        }
        reactionCounts[r.emote].count++;
        reactionCounts[r.emote].users.push(r.userId);
        if (user && r.userId === user.id) {
          reactionCounts[r.emote].hasReacted = true;
        }
      }

      return {
        id: m.id,
        roomId: m.roomId,
        body: m.deletedAt ? "Ushbu xabar o'chirildi" : m.body,
        type: m.type,
        isDeleted: !!m.deletedAt,
        attachmentUrl: m.attachmentUrl,
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              body: m.replyTo.body.slice(0, 80),
              username: m.replyTo.user.displayName || m.replyTo.user.username,
            }
          : null,
        user: {
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName || m.user.username,
          avatarUrl: m.user.avatarUrl,
          avatarFrame: m.user.avatarFrame,
          role: m.user.role,
          level: levelInfo.level,
          titleJa: levelInfo.titleJa,
          titleUz: levelInfo.titleUz,
          clubTag,
        },
        animeCard: m.animeId ? animesMap.get(m.animeId) || null : null,
        spoiler: hasSpoilerTag
          ? {
              animeId: m.animeId,
              episodeNo: m.episodeNo,
              hidden: spoilerHidden,
            }
          : null,
        poll: m.poll
          ? {
              id: m.poll.id,
              question: m.poll.question,
              options: JSON.parse(m.poll.options || "[]"),
              endsAt: m.poll.endsAt,
              votes: m.poll.votes.map((v) => ({ userId: v.userId, optionIdx: v.optionIdx })),
              userVoted: user ? m.poll.votes.find((v) => v.userId === user.id)?.optionIdx : undefined,
            }
          : null,
        reactions: reactionCounts,
        isPinned: m.pins.length > 0,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
      };
    });

    const nextCursor = hasMore && resultMessages.length > 0 ? resultMessages[0].id : null;

    return NextResponse.json({
      messages: formattedMessages,
      nextCursor,
      slowMode: room.slowMode,
    });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return NextResponse.json({ error: "Xabarlarni yuklashda xatolik yuz berdi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: rawRoomId } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Xabar yuborish uchun tizimga kiring" }, { status: 401 });
    }

    const access = await checkRoomAccess(rawRoomId, user.id);
    if (!access.allowed || !access.room) {
      return NextResponse.json({ error: access.reason || "Kirish ruxsati yo'q" }, { status: 403 });
    }
    const room = access.room;

    // Mute tekshiruvi
    const mute = await db.chatBan.findFirst({
      where: {
        userId: user.id,
        type: "mute",
        AND: [
          { OR: [{ roomId: room.id }, { roomId: null }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
    });
    if (mute) {
      return NextResponse.json(
        { error: `Siz ${mute.expiresAt ? new Date(mute.expiresAt).toLocaleTimeString() : ""} gacha ovozsiz qilingansiz: ${mute.reason || "Qoidalarni buzgansiz"}` },
        { status: 403 }
      );
    }

    // Rate limit
    if (!chatRateLimit(user.id, room.id)) {
      return NextResponse.json({ error: "Juda tez yozmoqdasiz. 10 soniya kuting.", retryAfter: 10 }, { status: 429 });
    }

    // Sekin rejim + universal 5 soniyalik minimal interval
    const POST_COOLDOWN_SECONDS = 5;
    const lastMsg = await db.chatMessage.findFirst({
      where: { roomId: room.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastMsg) {
      const isStaff = access.role === "owner" || access.role === "mod" || access.role === "admin";
      const waitSec = Math.max(POST_COOLDOWN_SECONDS, isStaff ? 0 : room.slowMode);
      const elapsedMs = Date.now() - new Date(lastMsg.createdAt).getTime();
      if (elapsedMs < waitSec * 1000) {
        const retryAfter = Math.ceil((waitSec * 1000 - elapsedMs) / 1000);
        return NextResponse.json(
          { error: `Sekin rejim. Keyingi xabar uchun ${retryAfter} soniya kuting.`, retryAfter },
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const {
      body: rawText,
      type = "text",
      replyToId,
      animeId,
      episodeNo,
      attachmentUrl,
      poll: rawPoll,
    } = body;

    const text = (rawText || "").trim();
    if (!text && !attachmentUrl && !rawPoll) {
      return NextResponse.json({ error: "Xabar matni bo'sh bo'lishi mumkin emas" }, { status: 400 });
    }

    if (text.length > 2000) {
      return NextResponse.json({ error: "Xabar hajmi 2000 belgidan oshmasligi kerak" }, { status: 400 });
    }

    if (attachmentUrl && (typeof attachmentUrl !== "string" || attachmentUrl.length > 500 || !isDurableMediaUrl(attachmentUrl))) {
      return NextResponse.json({ error: "Noto'g'ri fayl havolasi" }, { status: 400 });
    }

    if (replyToId) {
      const parent = await db.chatMessage.findFirst({
        where: { id: String(replyToId), roomId: room.id },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Javob berilayotgan xabar topilmadi" }, { status: 400 });
      }
    }

    // Level gate tekshiruvlari
    if (attachmentUrl) {
      const allowedImage = await checkLevelGate("send_image", access.level);
      if (!allowedImage) {
        return NextResponse.json({ error: "Rasm yuborish uchun kamida 5-daraja kerak" }, { status: 403 });
      }
    }

    if (rawPoll) {
      const allowedPoll = await checkLevelGate("create_poll", access.level);
      if (!allowedPoll) {
        return NextResponse.json({ error: "So'rovnoma yaratish uchun kamida 3-daraja kerak" }, { status: 403 });
      }
    }

    // XSS sanitizatsiya (oddiy qatlam)
    const sanitizedText = text
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Xabarni bazaga yozish
    const newMessage = await db.chatMessage.create({
      data: {
        roomId: room.id,
        userId: user.id,
        body: sanitizedText,
        type: rawPoll ? "poll" : animeId ? "anime_card" : type,
        replyToId: replyToId || null,
        animeId: animeId || null,
        episodeNo: episodeNo ? parseInt(String(episodeNo), 10) : null,
        attachmentUrl: attachmentUrl || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarFrame: true,
            role: true,
            clubMemberships: {
              select: { club: { select: { tag: true, name: true } } },
              take: 1,
            },
            xpEvents: { select: { amount: true } },
          },
        },
        replyTo: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
    });

    // So'rovnoma qo'shish
    let createdPollData: any = null;
    if (rawPoll && rawPoll.question && Array.isArray(rawPoll.options) && rawPoll.options.length >= 2) {
      const createdPoll = await db.poll.create({
        data: {
          messageId: newMessage.id,
          question: String(rawPoll.question).slice(0, 200),
          options: JSON.stringify(rawPoll.options.slice(0, 6).map((o: any) => String(o).slice(0, 80))),
          endsAt: rawPoll.endsAt ? new Date(rawPoll.endsAt) : null,
        },
        include: { votes: true },
      });
      createdPollData = {
        id: createdPoll.id,
        question: createdPoll.question,
        options: JSON.parse(createdPoll.options),
        endsAt: createdPoll.endsAt,
        votes: [],
      };
    }

    // Klub XP mukofoti
    if (room.type === "club" && (room.clubId || room.refId)) {
      const clubId = room.clubId || room.refId!;
      await awardClubXp(clubId, user.id, 5, "message");
    }

    // Anime kartasini yuklash
    let animeCardData: any = null;
    if (newMessage.animeId) {
      animeCardData = await db.anime.findUnique({
        where: { id: newMessage.animeId },
        select: {
          id: true,
          title: true,
          altTitle: true,
          coverImage: true,
          price: true,
          rating: true,
        },
      });
    }

    const totalXp = newMessage.user.xpEvents.reduce((s, e) => s + e.amount, 0);
    const levelInfo = calculateLevel(totalXp);
    const clubTag = newMessage.user.clubMemberships[0]?.club?.tag ?? null;

    const formattedMessage = {
      id: newMessage.id,
      roomId: newMessage.roomId,
      body: newMessage.body,
      type: newMessage.type,
      isDeleted: false,
      attachmentUrl: newMessage.attachmentUrl,
      replyTo: newMessage.replyTo
        ? {
            id: newMessage.replyTo.id,
            body: newMessage.replyTo.body.slice(0, 80),
            username: newMessage.replyTo.user.displayName || newMessage.replyTo.user.username,
          }
        : null,
      user: {
        id: newMessage.user.id,
        username: newMessage.user.username,
        displayName: newMessage.user.displayName || newMessage.user.username,
        avatarUrl: newMessage.user.avatarUrl,
        avatarFrame: newMessage.user.avatarFrame,
        role: newMessage.user.role,
        level: levelInfo.level,
        titleJa: levelInfo.titleJa,
        titleUz: levelInfo.titleUz,
        clubTag,
      },
      animeCard: animeCardData,
      spoiler: newMessage.animeId && newMessage.episodeNo
        ? {
            animeId: newMessage.animeId,
            episodeNo: newMessage.episodeNo,
            hidden: false,
          }
        : null,
      poll: createdPollData,
      reactions: {},
      isPinned: false,
      createdAt: newMessage.createdAt,
      editedAt: null,
    };

    // Worker orqali barcha ulangan WebSocket mijozlariga tarqatish
    await pushToRoom(rawRoomId, {
      type: "message",
      message: formattedMessage,
    });

    // Telegram bildirishnomasi: Mention (@username) yoki javob bo'lsa
    try {
      const safeName = escapeHtml(user.displayName || user.username);
      const safeSnippet = escapeHtml(sanitizedText.slice(0, 100));
      if (newMessage.replyTo && newMessage.replyTo.userId !== user.id) {
        await notifyTelegramUser(
          newMessage.replyTo.userId,
          rawRoomId,
          `<b>${safeName}</b> sizning xabaringizga javob berdi:\n\n<i>"${safeSnippet}..."</i>`
        );
      }
      const mentionMatches = sanitizedText.match(/@([a-zA-Z0-9_]{3,30})/g);
      if (mentionMatches) {
        for (const mention of mentionMatches.slice(0, 3)) {
          const uName = mention.slice(1);
          if (uName !== user.username) {
            const targetUser = await db.user.findUnique({
              where: { username: uName },
              select: { id: true },
            });
            if (targetUser) {
              await notifyTelegramUser(
                targetUser.id,
                rawRoomId,
                `<b>${safeName}</b> sizni eslatib o'tdi:\n\n<i>"${safeSnippet}..."</i>`
              );
            }
          }
        }
      }
    } catch (e) {
      console.error("Telegram notification send error:", e);
    }

    // Event bus orqali vazifa va streak progressini yangilash
    await emitEvent(user, "chat_message_sent", { roomId: rawRoomId, body: sanitizedText });

    return NextResponse.json({ message: formattedMessage });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Xabar yuborishda xatolik yuz berdi" }, { status: 500 });
  }
}
