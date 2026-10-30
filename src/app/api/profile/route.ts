import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { parseOnboardingRole } from "@/lib/rbac";
import { sanitizeText } from "@/lib/sanitize";
import { parseProfilePrivacy } from "@/lib/profile-privacy";
import { ANIME_GENRES, parseFavoriteGenres } from "@/lib/anime-preferences";
import { presetBannerUrl } from "@/components/anime/profile-assets";
import { normalizeDisplayName } from "@/lib/display-name";
import { ensureTeamClub } from "@/lib/dub-teams";

const HEX = /^#[0-9a-fA-F]{6}$/;
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED_HANDLES = new Set([
  "admin", "administrator", "kiluu", "support", "moderator", "mod", "staff", "official", "creator", "viewer",
]);

// PATCH /api/profile — update profile customization fields
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data: Record<string, string | boolean | null> = {};

    // Onboarding: role selection
    if (typeof body.role === "string") {
      if (user.onboardingDone) {
        return NextResponse.json({ error: "Role can only be set once" }, { status: 400 });
      }
      const mapped = parseOnboardingRole(body.role);
      if (!mapped) {
        return NextResponse.json({ error: "Role must be CREATOR or VIEWER" }, { status: 400 });
      }
      data.role = mapped;
      data.onboardingDone = true;
    }

    // ---- Onboarding handle / creator team account ----
    let teamSetup: { slug: string; name: string } | null = null;
    if (!user.onboardingDone && data.role !== undefined) {
      const creatorFlow = data.role === "creator" || typeof body.teamUsername === "string";
      if (creatorFlow) {
        const teamSlug = typeof body.teamUsername === "string" ? body.teamUsername.trim().toLowerCase() : "";
        if (!HANDLE_RE.test(teamSlug)) {
          return NextResponse.json({ error: "Team handle must be 3-20 lowercase letters, numbers or underscores", code: "INVALID_HANDLE" }, { status: 400 });
        }
        if (RESERVED_HANDLES.has(teamSlug)) {
          return NextResponse.json({ error: "This handle is reserved", code: "HANDLE_RESERVED" }, { status: 400 });
        }
        const teamName = normalizeDisplayName(typeof body.teamDisplayName === "string" ? body.teamDisplayName : "");
        if (!teamName) {
          return NextResponse.json({ error: "Team display name must be 2-20 characters", code: "INVALID_TEAM_NAME" }, { status: 400 });
        }
        const handleConflict = await db.user.findFirst({
          where: { username: teamSlug, NOT: { id: user.id } },
          select: { id: true },
        });
        if (handleConflict) {
          return NextResponse.json({ error: "This handle is already taken", code: "HANDLE_TAKEN" }, { status: 409 });
        }
        const slugConflict = await db.dubTeam.findUnique({
          where: { slug: teamSlug },
          select: { id: true, ownerId: true },
        });
        if (slugConflict && slugConflict.ownerId !== user.id) {
          return NextResponse.json({ error: "This team handle is already taken", code: "TEAM_HANDLE_TAKEN" }, { status: 409 });
        }
        data.username = teamSlug;
        data.displayName = teamName;
        teamSetup = { slug: teamSlug, name: teamName };
      } else if (typeof body.username === "string") {
        const handle = body.username.trim().toLowerCase();
        if (!HANDLE_RE.test(handle)) {
          return NextResponse.json({ error: "Handle must be 3-20 lowercase letters, numbers or underscores", code: "INVALID_HANDLE" }, { status: 400 });
        }
        if (RESERVED_HANDLES.has(handle)) {
          return NextResponse.json({ error: "This handle is reserved", code: "HANDLE_RESERVED" }, { status: 400 });
        }
        const handleConflict = await db.user.findFirst({
          where: { username: handle, NOT: { id: user.id } },
          select: { id: true },
        });
        if (handleConflict) {
          return NextResponse.json({ error: "This handle is already taken", code: "HANDLE_TAKEN" }, { status: 409 });
        }
        data.username = handle;
      }
    }

    // ---- Identity ----
    if (!teamSetup && typeof body.displayName === "string") {
      const displayName = normalizeDisplayName(body.displayName);
      if (!displayName) {
        return NextResponse.json({ error: "Display name must be 2-20 characters and contain no control characters" }, { status: 400 });
      }
      data.displayName = displayName;
    }
    for (const [field, type] of [
      ["equippedAvatarFrameId", "avatar"],
      ["equippedNameFrameId", "name"],
    ] as const) {
      if (!(field in body)) continue;
      const value: unknown = body[field];
      if (value === null || value === "") {
        data[field] = null;
        continue;
      }
      if (typeof value !== "string") {
        return NextResponse.json({ error: "Invalid frame selection" }, { status: 400 });
      }
      const frame = await db.frame.findFirst({
        where: { id: value, type, isActive: true },
        select: { id: true },
      });
      if (!frame) return NextResponse.json({ error: "Choose an active frame of the correct type" }, { status: 400 });
      const owned = await db.userFrame.findUnique({
        where: { userId_frameId: { userId: user.id, frameId: frame.id } },
        select: { frameId: true },
      });
      if (!owned) return NextResponse.json({ error: "You must own this frame before equipping it" }, { status: 403 });
      data[field] = frame.id;
    }
    if (body.favoriteGenres !== undefined) {
      const favoriteGenres = parseFavoriteGenres(body.favoriteGenres);
      if (!favoriteGenres) {
        return NextResponse.json({ error: "Choose at least one valid anime genre" }, { status: 400 });
      }
      data.favoriteGenres = favoriteGenres.join(",");
    }
    if (typeof body.bio === "string") {
      if (body.bio.length > 500) {
        return NextResponse.json({ error: "About me must be under 500 characters" }, { status: 400 });
      }
      data.bio = sanitizeText(body.bio, 500);
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
      } else if (typeof links === "object" && !Array.isArray(links)) {
        const clean: Record<string, string> = {};
        for (const key of ["telegram", "instagram", "youtube", "x"]) {
          const v = (links as Record<string, unknown>)[key];
          if (typeof v === "string" && v.length <= 120) {
            const value = v.trim();
            if (!value || /^[\w.@/-]+$/.test(value) || /^https:\/\/(www\.)?(t\.me|instagram\.com|youtube\.com|youtu\.be|x\.com)\//i.test(value)) {
              clean[key] = value;
            }
          }
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
      if (["gold", "neon", "sakura"].includes(body.avatarFrame)) {
        let unlocked: unknown = [];
        try {
          const showcase = user.showcase ? JSON.parse(user.showcase) as { unlocked?: unknown } : {};
          unlocked = showcase.unlocked;
        } catch {
          unlocked = [];
        }
        if (!Array.isArray(unlocked) || !unlocked.includes(`frame:${body.avatarFrame}`)) {
          return NextResponse.json({ error: "Unlock this premium frame before using it" }, { status: 403 });
        }
      }
      data.avatarFrame = body.avatarFrame === "none" ? "" : body.avatarFrame;
    }

    // ---- Banner preset ----
    if (typeof body.bannerPreset === "string") {
      const presetId = body.bannerPreset.trim();
      if (presetId) {
        const bannerUrl = presetBannerUrl(presetId);
        if (!bannerUrl) return NextResponse.json({ error: "Choose a banner from the preset gallery" }, { status: 400 });
        if (typeof body.bannerUrl === "string" && body.bannerUrl !== bannerUrl) {
          return NextResponse.json({ error: "Choose a banner from the preset gallery" }, { status: 400 });
        }
        data.bannerPreset = presetId;
        data.bannerUrl = bannerUrl;
      } else {
        data.bannerPreset = "";
      }
    }

    // ---- Showcase (JSON) ----
    if (body.showcase !== undefined) {
      let sc = body.showcase;
      if (typeof sc === "string") {
        try { sc = JSON.parse(sc); } catch { sc = null; }
      }
      if (sc === null) {
        data.showcase = "";
      } else if (typeof sc === "object" && !Array.isArray(sc)) {
        if (JSON.stringify(sc).length > 4000) {
          return NextResponse.json({ error: "Showcase config too large" }, { status: 400 });
        }
        const config = sc as Record<string, unknown>;
        const sections = ["topFive", "currentlyWatching", "favorites", "collection", "pinned", "achievements"];
        const topFive = Array.isArray(config.topFive)
          ? [...new Set(config.topFive.filter((id): id is string => typeof id === "string"))].slice(0, 5)
          : [];
        if (config.pinnedPostId !== null && config.pinnedPostId !== undefined && typeof config.pinnedPostId !== "string") {
          return NextResponse.json({ error: "Invalid pinned post" }, { status: 400 });
        }
        if (typeof config.pinnedPostId === "string") {
          const pinned = await db.post.findFirst({ where: { id: config.pinnedPostId, userId: user.id } });
          if (!pinned) return NextResponse.json({ error: "Pinned post must belong to you" }, { status: 400 });
        }
        if (topFive.length) {
          const previousOrders = await db.order.findMany({
            where: { site_user_id: user.id, status: { in: ["COMPLETED", "PAID_PENDING_GRANT"] } },
            select: { anime_slug: true },
          });
          const eligible = await db.anime.findMany({
            where: {
              id: { in: topFive },
              OR: [
                { favorites: { some: { userId: user.id } } },
                { purchases: { some: { userId: user.id } } },
                { slug: { in: previousOrders.map((order) => order.anime_slug) } },
              ],
            },
            select: { id: true },
          });
          if (eligible.length !== topFive.length) {
            return NextResponse.json({ error: "Top 5 can only include anime in your collection or favorites" }, { status: 400 });
          }
        }
        const genres = Array.isArray(config.genres)
          ? [...new Set(config.genres.filter((genre): genre is string =>
              typeof genre === "string" && (ANIME_GENRES as readonly string[]).includes(genre)
            ))]
          : [];
        const order = Array.isArray(config.order)
          ? [...new Set(config.order.filter((section): section is string =>
              typeof section === "string" && sections.includes(section)
            ))]
          : sections;
        const hiddenInput = config.hidden && typeof config.hidden === "object" && !Array.isArray(config.hidden)
          ? config.hidden as Record<string, unknown>
          : {};
        const hidden = Object.fromEntries(sections.map((section) => [section, hiddenInput[section] === true]));
        let currentShowcase: Record<string, unknown> = {};
        try { currentShowcase = user.showcase ? JSON.parse(user.showcase) : {}; } catch { /* invalid old config is ignored */ }
        const unlocked = Array.isArray(currentShowcase.unlocked)
          ? currentShowcase.unlocked.filter((item): item is string => typeof item === "string")
          : [];
        data.showcase = JSON.stringify({
          topFive,
          pinnedPostId: typeof config.pinnedPostId === "string" ? config.pinnedPostId : null,
          genres,
          achievementIds: Array.isArray(config.achievementIds)
            ? [...new Set(config.achievementIds.filter((id): id is string => typeof id === "string"))].slice(0, 6)
            : [],
          order,
          hidden,
          unlocked,
        });
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
      } else if (typeof pv === "object" && !Array.isArray(pv)) {
        if (JSON.stringify(pv).length > 1000) {
          return NextResponse.json({ error: "Privacy config too large" }, { status: 400 });
        }
        data.privacy = JSON.stringify(parseProfilePrivacy(JSON.stringify(pv)));
      }
    }

    // ---- Legacy avatar/banner URL setters (presets from gallery) ----
    if (typeof body.avatarUrl === "string" && body.avatarUrl.length < 500) {
      data.avatarUrl = body.avatarUrl || "";
    }
    if (body.bannerUrl !== undefined) {
      const presetId = typeof body.bannerPreset === "string" ? body.bannerPreset.trim() : "";
      if (!presetId || presetBannerUrl(presetId) !== body.bannerUrl) {
        return NextResponse.json({ error: "Choose a banner from the preset gallery" }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.user.update({ where: { id: user.id }, data });
    if (teamSetup) {
      const ownedTeam = await db.dubTeam.findFirst({
        where: { ownerId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (ownedTeam) {
        await db.dubTeam.update({ where: { id: ownedTeam.id }, data: { name: teamSetup.name } });
      } else {
        const team = await db.dubTeam.create({
          data: { name: teamSetup.name, slug: teamSetup.slug, ownerId: user.id },
        });
        try {
          await ensureTeamClub(team.id);
        } catch (error) {
          console.error("team club setup failed", error);
        }
      }
    }
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (e) {
    console.error("profile update error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
