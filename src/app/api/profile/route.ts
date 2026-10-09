import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

const HEX = /^#[0-9a-fA-F]{6}$/;

// PATCH /api/profile — update profile customization fields
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data: Record<string, string | boolean> = {};

    // Onboarding: role selection
    if (typeof body.role === "string") {
      if (!["CREATOR", "VIEWER"].includes(body.role)) {
        return NextResponse.json({ error: "Role must be CREATOR or VIEWER" }, { status: 400 });
      }
      data.role = body.role;
      data.onboardingDone = true;
    }

    // ---- Identity ----
    if (typeof body.displayName === "string") {
      if (body.displayName.trim().length < 1 || body.displayName.trim().length > 32) {
        return NextResponse.json({ error: "Display name must be 1-32 characters" }, { status: 400 });
      }
      data.displayName = body.displayName.trim();
    }
    if (typeof body.bio === "string") {
      if (body.bio.length > 500) {
        return NextResponse.json({ error: "About me must be under 500 characters" }, { status: 400 });
      }
      data.bio = body.bio;
    }
    if (typeof body.pronouns === "string") {
      if (body.pronouns.length > 24) return NextResponse.json({ error: "Pronouns too long" }, { status: 400 });
      data.pronouns = body.pronouns.trim() || "";
    }
    if (typeof body.tagline === "string") {
      if (body.tagline.length > 80) return NextResponse.json({ error: "Tagline must be under 80 characters" }, { status: 400 });
      data.tagline = body.tagline.trim() || "";
    }
    if (typeof body.country === "string") {
      if (body.country.length > 40) return NextResponse.json({ error: "Country too long" }, { status: 400 });
      data.country = body.country.trim() || "";
    }
    if (typeof body.timezone === "string") {
      if (body.timezone.length > 64) return NextResponse.json({ error: "Timezone too long" }, { status: 400 });
      data.timezone = body.timezone.trim() || "";
    }

    // ---- Social links (JSON) ----
    if (body.socialLinks !== undefined) {
      let links = body.socialLinks;
      if (typeof links === "string") {
        try { links = JSON.parse(links); } catch { links = null; }
      }
      if (links === null) {
        data.socialLinks = "";
      } else if (typeof links === "object") {
        const clean: Record<string, string> = {};
        for (const key of ["telegram", "instagram", "youtube", "x"]) {
          const v = (links as Record<string, unknown>)[key];
          if (typeof v === "string" && v.length <= 120) clean[key] = v.trim().slice(0, 120);
        }
        data.socialLinks = JSON.stringify(clean);
      }
    }

    // ---- Custom status ----
    if (typeof body.statusEmoji === "string") {
      if ([...body.statusEmoji].length > 4) return NextResponse.json({ error: "Pick a single emoji" }, { status: 400 });
      data.statusEmoji = body.statusEmoji.trim() || "";
    }
    if (typeof body.statusText === "string") {
      if (body.statusText.length > 64) return NextResponse.json({ error: "Status must be under 64 characters" }, { status: 400 });
      data.statusText = body.statusText.trim() || "";
    }

    // ---- Accent theme ----
    if (typeof body.accentColor === "string" && HEX.test(body.accentColor)) {
      data.accentColor = body.accentColor;
    }
    if (body.accentTo === null || body.accentTo === "") {
      data.accentTo = "";
    } else if (typeof body.accentTo === "string" && HEX.test(body.accentTo)) {
      data.accentTo = body.accentTo;
    }

    // ---- Avatar frame (unlockable) ----
    if (typeof body.avatarFrame === "string") {
      const allowed = ["none", "gold", "ember", "neon", "sakura"];
      if (!allowed.includes(body.avatarFrame)) {
        return NextResponse.json({ error: "Unknown frame" }, { status: 400 });
      }
      data.avatarFrame = body.avatarFrame === "none" ? "" : body.avatarFrame;
    }

    // ---- Banner preset ----
    if (typeof body.bannerPreset === "string") {
      if (body.bannerPreset.length > 400) return NextResponse.json({ error: "Bad preset" }, { status: 400 });
      data.bannerPreset = body.bannerPreset.trim() || "";
    }

    // ---- Showcase (JSON) ----
    if (body.showcase !== undefined) {
      let sc = body.showcase;
      if (typeof sc === "string") {
        try { sc = JSON.parse(sc); } catch { sc = null; }
      }
      if (sc === null) {
        data.showcase = "";
      } else if (typeof sc === "object") {
        if (JSON.stringify(sc).length > 4000) {
          return NextResponse.json({ error: "Showcase config too large" }, { status: 400 });
        }
        data.showcase = JSON.stringify(sc);
      }
    }

    // ---- Privacy (JSON) ----
    if (body.privacy !== undefined) {
      let pv = body.privacy;
      if (typeof pv === "string") {
        try { pv = JSON.parse(pv); } catch { pv = null; }
      }
      if (pv === null) {
        data.privacy = "";
      } else if (typeof pv === "object") {
        if (JSON.stringify(pv).length > 1000) {
          return NextResponse.json({ error: "Privacy config too large" }, { status: 400 });
        }
        data.privacy = JSON.stringify(pv);
      }
    }

    // ---- Legacy avatar/banner URL setters (presets from gallery) ----
    if (typeof body.avatarUrl === "string" && body.avatarUrl.length < 500) {
      data.avatarUrl = body.avatarUrl || "";
    }
    if (typeof body.bannerUrl === "string" && body.bannerUrl.length < 500) {
      data.bannerUrl = body.bannerUrl || "";
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (e) {
    console.error("profile update error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
