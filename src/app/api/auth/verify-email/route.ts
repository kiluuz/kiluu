import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  createSessionRecord,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/email";
import { z } from "zod";

const VERIFY_WINDOW_MS = 10 * 60 * 1000;

const VerifyBody = z.object({
  email: z.string().email().max(200),
  code: z.string().length(6),
});

const ResendBody = z.object({
  email: z.string().email().max(200),
});

// POST /api/auth/verify-email — OTP tekshirish
export async function POST(req: NextRequest) {
  if (!rateLimit(rateKey(req, "verify-email"), 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  try {
    const parsed = VerifyBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and 6-digit code required" }, { status: 400 });
    }
    const { email, code } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    if (!rateLimit(`verify-email:email:${normalizedEmail}`, 10, VERIFY_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many attempts for this email" }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (user.emailVerified) {
      // Verifikatsiya sessiya ochish yo'li emas — parol bilan kiring.
      return NextResponse.json(
        { error: "Email already verified. Please sign in." },
        { status: 409 },
      );
    }
    if (!user.verifyCode || !user.verifyCodeExp) {
      return NextResponse.json({ error: "No verification code found. Please register again." }, { status: 400 });
    }
    if (new Date() > user.verifyCodeExp) {
      return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
    }
    if (user.verifyCode !== code) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Bir martalik kod: shartli update faqat kod hali amal qilganda bajariladi.
    const consumed = await db.user.updateMany({
      where: {
        id: user.id,
        emailVerified: false,
        verifyCode: code,
        verifyCodeExp: { gt: new Date() },
      },
      data: {
        emailVerified: true,
        verifyCode: null,
        verifyCodeExp: null,
      },
    });
    if (consumed.count !== 1) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const verified = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const { token, expiresAt } = await createSessionRecord(verified.id);
    const ownedCount = await db.purchase.count({ where: { userId: verified.id } });
    const res = NextResponse.json({ user: { ...toPublicUser(verified), ownedCount } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (e) {
    log.error("verify-email failed", { err: String(e) });
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

// PATCH /api/auth/verify-email — OTP qayta yuborish
export async function PATCH(req: NextRequest) {
  if (!rateLimit(rateKey(req, "resend-otp"), 3, 60_000)) {
    return NextResponse.json({ error: "Too many resend attempts. Wait 1 minute." }, { status: 429 });
  }
  try {
    const parsed = ResendBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    if (!rateLimit(`resend-otp:email:${normalizedEmail}`, 3, VERIFY_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many resend attempts for this email" }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exp = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: { verifyCode: code, verifyCodeExp: exp },
    });

    await sendVerificationEmail({ to: email, username: user.username, code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    log.error("resend-otp failed", { err: String(e) });
    return NextResponse.json({ error: "Failed to resend code" }, { status: 500 });
  }
}
