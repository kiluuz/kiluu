import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

// Complete onboarding (role selection) or update profile
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data: Record<string, string> = {};

    // Onboarding: role selection
    if (typeof body.role === "string") {
      if (!["CREATOR", "VIEWER"].includes(body.role)) {
        return NextResponse.json({ error: "Role must be CREATOR or VIEWER" }, { status: 400 });
      }
      data.role = body.role;
      data.onboardingDone = true;
    }

    if (typeof body.displayName === "string") {
      if (body.displayName.trim().length < 1 || body.displayName.trim().length > 32) {
        return NextResponse.json({ error: "Display name must be 1-32 characters" }, { status: 400 });
      }
      data.displayName = body.displayName.trim();
    }
    if (typeof body.bio === "string") {
      if (body.bio.length > 300) {
        return NextResponse.json({ error: "Bio must be under 300 characters" }, { status: 400 });
      }
      data.bio = body.bio;
    }
    if (typeof body.avatarUrl === "string" && body.avatarUrl.length < 500) {
      data.avatarUrl = body.avatarUrl || "";
    }
    if (typeof body.bannerUrl === "string" && body.bannerUrl.length < 500) {
      data.bannerUrl = body.bannerUrl || "";
    }
    if (typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)) {
      data.accentColor = body.accentColor;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
    });
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (e) {
    console.error("profile update error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
