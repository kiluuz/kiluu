import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, toPublicUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";
import { sendVerificationEmail, isEmailEnabled } from "@/lib/email";
import { z } from "zod";

const Body = z.object({
  email: z.string().email().max(200),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/),
  password: z.string().min(6).max(200),
});

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
    const { email, username, password } = parsed.data;

    const [existingEmail, existingUsername] = await Promise.all([
      db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, emailVerified: true } }),
      db.user.findUnique({ where: { username }, select: { id: true } }),
    ]);

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
        await sendVerificationEmail({ to: email, username, code });
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

    if (existingUsername) {
      return NextResponse.json({ error: "This username is already taken" }, { status: 409 });
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
            displayName: username,
            role: "user",
            locale: "uz",
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
            displayName: username,
            role: "user",
            locale: "uz",
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
      await createSession(user.id);
      const ownedCount = await db.purchase.count({ where: { userId: user.id } });
      return NextResponse.json({ user: { ...toPublicUser(user), ownedCount } }, { status: 201 });
    }
  } catch (e) {
    log.error("register failed", { err: String(e) });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
