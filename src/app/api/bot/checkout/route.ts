import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBotAnime, updateBotAnime, createStarsInvoice, getUserStatus } from "@/lib/bot-api";
import { db } from "@/lib/db";

/**
 * POST /api/bot/checkout
 * Body: { anime_slug: string }
 *
 * Creates an order (PENDING) and returns a Telegram Stars invoice link.
 * The actual payment confirmation happens via the bot's successful_payment webhook
 * which calls POST /api/webhooks/telegram-stars on this server.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { anime_slug } = body as { anime_slug?: string };

    if (!anime_slug || !/^[a-z0-9_-]+$/i.test(anime_slug)) {
      return NextResponse.json({ error: "anime_slug noto'g'ri" }, { status: 400 });
    }

    // ── Verify anime exists and get price from Bot API (never trust client) ──
    let botAnime: { price: number; is_active: boolean; title: string };
    try {
      botAnime = await getBotAnime(anime_slug);
    } catch {
      // Graceful fallback: check local DB and auto-register on the bot
      const localAnime = await db.anime.findFirst({
        where: { OR: [{ slug: anime_slug }, { id: anime_slug }] },
      });
      if (localAnime) {
        try {
          await updateBotAnime(localAnime.slug, {
            title: localAnime.title,
            price: localAnime.price || 100,
            is_active: true,
            description: localAnime.description || "",
            poster: localAnime.coverImage || "",
          });
        } catch {}
        botAnime = {
          price: localAnime.price || 100,
          is_active: true,
          title: localAnime.title,
        };
      } else {
        return NextResponse.json({ error: "Anime katalogda topilmadi" }, { status: 404 });
      }
    }

    if (!botAnime?.is_active) {
      return NextResponse.json({ error: "Anime hozirda mavjud emas" }, { status: 400 });
    }

    if (typeof botAnime.price !== "number" || botAnime.price < 0) {
      return NextResponse.json({ error: "Narx noto'g'ri" }, { status: 400 });
    }

    // ── Check if user has linked their Telegram account with the bot ───────
    let userStatus: { linked: boolean } = { linked: false };
    try {
      userStatus = await getUserStatus(user.id);
    } catch {}

    if (!userStatus?.linked) {
      return NextResponse.json(
        {
          error: "Telegram hisobingiz hali ulanmagan! Avval «Botni ulash» orqali Telegram akkauntingizni ulang.",
          needsLink: true,
        },
        { status: 400 }
      );
    }

    // ── Create a PENDING order first ───────────────────────────────────────
    const order = await db.order.create({
      data: {
        site_user_id: user.id,
        anime_slug,
        amount: botAnime.price,
        provider: "stars",
        status: "PENDING",
      },
    });

    // ── Ask bot API to create a Stars invoice link ─────────────────────────
    // Bot API: POST /api/invoice → { invoice_link, order_payload }
    // order_payload will be echoed back in successful_payment so the bot
    // can forward it to /api/webhooks/telegram-stars with the order id.
    let invoiceLink: string;
    try {
      const invoiceRes = await createStarsInvoice({
        site_user_id: user.id,
        kind: "ANIME",
        title: botAnime.title || anime_slug,
        description: `Anime: ${anime_slug}`,
        stars: Math.max(1, Math.ceil((botAnime.price || 1) / 100)),
        payload: order.id,
        anime_slug,
      });
      invoiceLink = invoiceRes.invoice_link;

      // Store the order_payload (or order id) as provider_tx_id for tracking
      if (invoiceRes.order_payload) {
        await db.order.update({
          where: { id: order.id },
          data: { provider_tx_id: invoiceRes.order_payload },
        });
      }
    } catch (err: any) {
      // If bot fails, delete the pending order and surface informative error
      await db.order.delete({ where: { id: order.id } }).catch(() => {});
      console.error("createStarsInvoice error:", err);
      const isNotLinked = err?.message?.toLowerCase().includes("not linked") || err?.message?.toLowerCase().includes("user not found");
      return NextResponse.json(
        {
          error: isNotLinked
            ? "Telegram hisobingiz ulanmagan. Avval «Botni ulash» tugmasini bosing."
            : `Invoice yaratishda xatolik: ${err?.message || "Bot javob bermayapti"}`,
          needsLink: isNotLinked,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ orderId: order.id, invoiceLink });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
