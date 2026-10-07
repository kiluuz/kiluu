import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, toPublicUser, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase() },
    });

    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
