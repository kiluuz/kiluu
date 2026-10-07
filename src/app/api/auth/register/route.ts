import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, toPublicUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, password } = body;

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username and password are required" },
        { status: 400 }
      );
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existingEmail = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json({ error: "This username is already taken" }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        password: hashPassword(password),
        credits: 100, // welcome bonus
        displayName: username,
      },
    });

    await db.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 100,
        type: "BONUS",
        description: "Welcome bonus - 100 free credits",
      },
    });

    await createSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
