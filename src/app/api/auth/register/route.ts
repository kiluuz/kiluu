import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, createSession, toPublicUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";
import { sendVerificationEmail, isEmailEnabled } from "@/lib/email";
import { z } from "zod";
import { normalizeDisplayName } from "@/lib/display-name";
import { bindReferralOnRegistration } from "@/lib/referrals";

const Body = z.object({
  email: z.string().email().max(200),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/).optional(),
  displayName: z.string().max(20).optional(),
  password: z.string().min(6).max(200),
  referralCode: z.string().max(30).optional(),
});

const RESERVED_HANDLES = new Set([
  "admin", "administrator", "kiluu", "support", "moderator", "mod", "staff", "official", "creator", "viewer",
]);

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Handle ixtiyoriy: berilmasa, ism yoki emaildan vaqtinchalik unique handle yasaladi. */
function handleBase(email: string, displayName: string | null): string {
  const source = (displayName || email.split("@")[0] || "user")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = source.slice(0, 16) || "user";
  return base.length >= 3 ? base : `user_${base}`.slice(0, 20);
}

async function uniqueHandle(base: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0
      ? base
      : `${base.slice(0, 14)}_${randomInt(1000, 99999)}`.slice(0, 20);
    const taken = await db.user.findFirst({ where: { username: candidate }, select: { id: true } });
    if (!taken && !RESERVED_HANDLES.has(candidate)) return candidate;
  }
  return `user_${randomInt(100000, 999999)}`;
}

export async function POST(req: NextRequest) {
  if (!rateLimit(rateKey(req, "register"), 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email, username or password" }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const requestedUsername = parsed.data.username;
    const displayName = normalizeDisplayName(parsed.data.displayName ?? requestedUsername ?? email.split("@")[0]);
    if (!displayName) {
      return NextResponse.json({ error: "Display name must be 2-20 characters and contain no control characters" }, { status: 400 });
    }

    const existingEmail = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, emailVerified: true, username: true },
    });

    if (existingEmail) {
      if (existingEmail.emailVerified) {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      if (isEmailEnabled()) {
        // OTP yangilash
        const code = generateOtp();
        const exp = new Date(Date.now() + 10 * 60 * 1000);
        await db.user.update({
          where: { id: existingEmail.id },
          data: { verifyCode: code, verifyCodeExp: exp },
        });
        await sendVerificationEmail({ to: email, username: existingEmail.username, code });
        return NextResponse.json({ requiresVerification: true, email: email.toLowerCase() }, { status: 200 });
      } else {
        // Email yo'q — to'g'ridan-to'g'ri tasdiqlash
        const verified = await db.user.update({
          where: { id: existingEmail.id },
          data: { emailVerified: true, verifyCode: null, verifyCodeExp: null },
        });
        await createSession(verified.id);
        const ownedCount = await db.purchase.count({ where: { userId: verified.id } });
        return NextResponse.json({ user: { ...toPublicUser(verified), ownedCount } }, { status: 200 });
      }
    }

    let username: string;
    if (requestedUsername) {
      const existingUsername = await db.user.findUnique({ where: { username: requestedUsername }, select: { id: true } });
      if (existingUsername) {
        return NextResponse.json({ error: "This username is already taken" }, { status: 409 });
      }
      username = requestedUsername;
    } else {
      username = await uniqueHandle(handleBase(email, displayName));
    }

    if (isEmailEnabled()) {
      // OTP bilan ro'yxatdan o'tish
      const code = generateOtp();
      const exp = new Date(Date.now() + 10 * 60 * 1000);
      const user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            username,
            password: hashPassword(password),
            credits: 100,
            displayName,
            role: "user",
            locale: "en",
            emailVerified: false,
            verifyCode: code,
            verifyCodeExp: exp,
          },
        });
        await tx.creditTransaction.create({
          data: {
            userId: created.id,
            amount: 100,
            type: "BONUS",
            description: "Welcome bonus - 100 free credits",
            idempotencyKey: `welcome-${created.id}`,
          },
        });
        return created;
      });

      if (parsed.data.referralCode) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const userAgent = req.headers.get("user-agent") || undefined;
        try {
          await bindReferralOnRegistration(user.id, parsed.data.referralCode, ip, userAgent);
        } catch (e) {
          log.warn("failed to bind referral on registration", { err: String(e) });
        }
      }

      await sendVerificationEmail({ to: email, username, code });
      return NextResponse.json({ requiresVerification: true, email: email.toLowerCase() }, { status: 201 });
    } else {
      // Email sozlanmagan — OTP o'tkazib, to'g'ridan-to'g'ri kirish
      const user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            username,
            password: hashPassword(password),
            credits: 100,
            displayName,
            role: "user",
            locale: "en",
            emailVerified: true,
          },
        });
        await tx.creditTransaction.create({
          data: {
            userId: created.id,
            amount: 100,
            type: "BONUS",
            description: "Welcome bonus - 100 free credits",
            idempotencyKey: `welcome-${created.id}`,
          },
        });
        return created;
      });

      if (parsed.data.referralCode) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const userAgent = req.headers.get("user-agent") || undefined;
        try {
          await bindReferralOnRegistration(user.id, parsed.data.referralCode, ip, userAgent);
        } catch (e) {
          log.warn("failed to bind referral on registration", { err: String(e) });
        }
      }

      await createSession(user.id);
      const ownedCount = await db.purchase.count({ where: { userId: user.id } });
      return NextResponse.json({ user: { ...toPublicUser(user), ownedCount } }, { status: 201 });
    }
  } catch (e) {
    log.error("register failed", { err: String(e) });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
