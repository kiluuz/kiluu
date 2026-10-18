import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, toPublicUser, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";
import { z } from "zod";

const Body = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(rateKey(req, "login"), 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession(user.id);
    const ownedCount = await db.purchase.count({ where: { userId: user.id } });
    return NextResponse.json({ user: { ...toPublicUser(user), ownedCount } });
  } catch (e) {
    log.error("login failed", { err: String(e) });
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
