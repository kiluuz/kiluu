"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Crown, BadgeCheck, CalendarDays, Loader2, Check, Users, Trophy, Heart } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "./store";
import type { PublicProfile, AnimeSummary } from "./types";
import { FramedAvatar, NameWithFrame, nameFrameContentInset, SmartImage, timeAgo } from "./ui-bits";
import {
  userAccentVars, textOn, Equalizer, getAchievementStates, SocialLinksRow,
} from "./profile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ================================================================
   PROFILE POPUP CARD — responsive Discord-style
   Used by the global modal AND the editor live preview.
   ================================================================ */
export function ProfilePopupCard({
  profile,
  onFollowChange,
  onClose,
  compact,
}: {
  profile: PublicProfile;
  onFollowChange?: (following: boolean) => void;
  onClose?: () => void;
  compact?: boolean;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const [following, setFollowing] = useState(profile.isFollowing);
  const [busy, setBusy] = useState(false);
  const user = useAppStore((s) => s.user);

  const states = useMemo(() => getAchievementStates(profile), [profile]);
  const earned = states.filter((s) => s.earned);
  const showcaseIds = profile.showcase?.achievementIds ?? [];
  const topAch = (showcaseIds.length
    ? showcaseIds.map((id) => states.find((s) => s.def.id === id)).filter(Boolean)
    : earned.slice(0, 3)
  ).slice(0, 3) as typeof earned;

  const topFiveIds = profile.showcase?.topFive ?? [];
  const top3Animes = topFiveIds.length
    ? topFiveIds.map((id) => profile.ownedAnimes.find((a) => a.id === id) || profile.favoriteAnimes.find((a) => a.id === id)).filter(Boolean).slice(0, 3) as AnimeSummary[]
    : (profile.favoriteAnimes.length ? profile.favoriteAnimes.slice(0, 3) : profile.ownedAnimes.slice(0, 3));

  const watching = profile.currentlyWatching;
  const joinDate = new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  async function toggleFollow() {
    if (!user) { useAppStore.getState().setAuthOpen(true); return; }
    const nextFollowing = !following;
    // 1. Instant optimistic UI update
    setFollowing(nextFollowing);
    onFollowChange?.(nextFollowing);
    toast.success(nextFollowing ? `Following @${profile.username}` : "Unfollowed");

    // 2. Perform network request in background
    try {
      const res = await fetch(`/api/users/${profile.username}/favorite`, { method: nextFollowing ? "POST" : "DELETE" });
      if (!res.ok) {
        setFollowing(!nextFollowing);
        onFollowChange?.(!nextFollowing);
        toast.error("Failed to update follow");
      }
    } catch {
      setFollowing(!nextFollowing);
      onFollowChange?.(!nextFollowing);
      toast.error("Failed to update follow");
    }
  }

  return (
    <div
      className={cn(
        "relative w-full max-w-[420px] overflow-visible rounded-3xl border bg-card text-card-foreground shadow-2xl",
        "border-[color-mix(in_srgb,var(--user-accent)_35%,transparent)]"
      )}
      style={userAccentVars(profile.accentColor, profile.accentTo)}
      role="dialog"
      aria-label={`Profile card — ${profile.displayName || profile.username}`}
    >
      {/* close button — accent focus ring, never default red */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full bg-black/35 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/55 transition focus-ring-accent"
          aria-label="Close profile card"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Banner — 5:2 compact crop of the user banner */}
      <div
        className={cn(
          "relative h-[152px] overflow-hidden grain",
          "bg-gradient-to-br from-[color-mix(in_srgb,var(--user-accent)_45%,var(--card))] to-[color-mix(in_srgb,var(--user-accent-to)_30%,var(--card))]"
        )}
      >
        {profile.bannerUrl ? (
          <SmartImage
            src={profile.bannerUrl}
            alt=""
            className="w-full h-full object-cover"
            accentFrom={profile.accentColor}
            accentTo={profile.accentTo || profile.accentColor}
          />
        ) : (
          <div className="absolute inset-0 aurora" aria-hidden />
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/95 to-transparent" />
      </div>

      {/* Avatar + identity */}
      <div className="px-6 pb-6">
        <div className="flex items-end justify-between -mt-14 relative z-10">
          <div className="rounded-full bg-card p-1 shadow-xl">
            <FramedAvatar user={profile} size={88} />
          </div>
          {/* online dot */}
          <span
            className={cn(
              "mb-1 w-4 h-4 rounded-full border-[3px] border-card",
              (profile.isOnline ?? Boolean(watching)) ? "bg-emerald-500 live-dot" : "bg-muted-foreground/40"
            )}
            title={(profile.isOnline ?? Boolean(watching)) ? (watching ? "Online — tomosha qilmoqda" : "Online") : "Oflayn"}
          />
        </div>

        <div className="mt-4 min-w-0" style={{ "--profile-name-frame-inset": `${nameFrameContentInset(profile, 34)}px` } as React.CSSProperties}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="m-0 flex min-w-0 items-center font-display text-lg font-bold leading-none">
              <NameWithFrame user={profile} height={34} avatarSize={88} />
            </h3>
            {profile.isVerified && <BadgeCheck className="w-4 h-4 text-[var(--user-accent)] shrink-0" />}
            {profile.role === "CREATOR" && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                style={{ background: "linear-gradient(120deg, var(--user-accent), var(--user-accent-to))", color: textOn(profile.accentColor) }}
              >
                <Crown className="w-2.5 h-2.5" /> Creator
              </span>
            )}
          </div>
          <p className="profile-name-frame-follow text-xs text-muted-foreground">
            @{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ""}
            {profile.role !== "CREATOR" && profile.stats.level !== undefined && <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 font-bold">Lv.{profile.stats.level}</span>}
          </p>

          {/* status line */}
          <div className="profile-name-frame-follow mt-2 min-h-[24px]">
            {watching ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-accent rounded-full px-2.5 py-1 max-w-full">
                <Equalizer className="h-2.5" />
                <span className="text-muted-foreground">Watching</span>
                <span className="font-semibold text-[var(--user-accent)] truncate max-w-[140px]">{watching.anime.title}</span>
                <span className="text-muted-foreground">· Ep {watching.episode.number}</span>
              </span>
            ) : (profile.statusEmoji || profile.statusText) ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-accent rounded-full px-2.5 py-1 max-w-full">
                {profile.statusEmoji && <span>{profile.statusEmoji}</span>}
                {profile.statusText && <span className="text-muted-foreground truncate max-w-[200px]">{profile.statusText}</span>}
              </span>
            ) : null}
          </div>

          {profile.tagline && (
            <p className="text-[12px] font-medium text-foreground/75 mt-1.5 line-clamp-1">{profile.tagline}</p>
          )}
        </div>

        {/* Bio snippet */}
        {profile.bio && (
          <p className="text-sm text-foreground/80 mt-2.5 line-clamp-3 whitespace-pre-wrap break-words">
            {profile.bio}
          </p>
        )}

        {/* Member since + socials */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Member since {joinDate}</span>
          {Object.keys(profile.socialLinks ?? {}).filter((k) => profile.socialLinks?.[k]).length > 0 && (
            <SocialLinksRow links={profile.socialLinks} compact />
          )}
        </div>

        {/* Top 3 anime */}
        {!compact && top3Animes.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-[var(--user-accent)]" /> Top Anime
            </p>
            <div className="grid grid-cols-3 gap-2">
              {top3Animes.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => { onClose?.(); navigate("detail", { animeId: a.slug }); }}
                  className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-border/60 hover:border-[color-mix(in_srgb,var(--user-accent)_50%,transparent)] transition focus-ring-accent"
                  aria-label={`Open ${a.title}`}
                >
                  <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1.5 text-[13px] font-black text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    #{i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 3 achievements */}
        {!compact && topAch.length > 0 && (
          <div className="mt-3.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <Heart className="w-3 h-3 text-[var(--user-accent)]" /> Achievements
            </p>
            <div className="flex gap-2">
              {topAch.map((a) => (
                <div
                  key={a.def.id}
                  className={cn(
                    "flex-1 rounded-xl border px-2 py-1.5 text-center rarity-glow rarity-" + a.def.rarity,
                    "border-[color-mix(in_srgb,var(--rarity)_30%,transparent)] bg-[color-mix(in_srgb,var(--rarity)_10%,transparent)]"
                  )}
                  title={`${a.def.name} — ${a.def.desc}`}
                >
                  <span className="text-base leading-none">{a.def.emoji}</span>
                  <p className="text-[9px] font-bold truncate mt-0.5">{a.def.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats mini-row */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: profile.role === "CREATOR" ? "Created" : "Owned", value: profile.stats.purchaseCount },
            { label: "Followers", value: profile.stats.followers },
            { label: "Posts", value: profile.stats.postCount },
          ].filter((s) => s.value !== null).map((s) => (
          <div key={s.label} className="rounded-xl bg-accent/60 py-2">
              <p className="stat-numeral text-sm leading-none">{s.value?.toLocaleString()}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {!profile.isMe ? (
            <>
              {(profile.canFollow || following) && <Button
                size="sm"
                className="flex-1 h-9 rounded-full font-semibold"
                style={following
                  ? { background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }
                  : { background: "linear-gradient(120deg, var(--user-accent), var(--user-accent-to))", color: textOn(profile.accentColor) }}
                onClick={toggleFollow}
                disabled={busy}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : following ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {following ? "Following" : "Follow"}
              </Button>}
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1 h-9 rounded-full brand-gradient text-white font-semibold"
              onClick={() => { onClose?.(); navigate("user-profile", { username: profile.username }); }}
            >
              View My Profile
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full flex-1"
            onClick={() => { onClose?.(); navigate("user-profile", { username: profile.username }); }}
          >
            View Full Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   GLOBAL MODAL — centered floating card on every breakpoint.
   Esc close, click-outside, focus trap, accent focus ring.
   Mobile: centered popover (max-h guard + internal scroll on
   short viewports) instead of the old left-stuck bottom sheet.
   ================================================================ */
export function ProfileModal() {
  const { profileModalOpen, closeProfileCard, profileCardUser, user } = useAppStore();
  const cardRef = useRef<HTMLDivElement>(null);

  const username = profileCardUser || user?.username || null;
  const profileQuery = useQuery<PublicProfile>({
    queryKey: ["profile-card", username, user?.id ?? "anonymous"],
    enabled: profileModalOpen && Boolean(username),
    queryFn: async () => {
      const response = await fetch(`/api/users/${encodeURIComponent(username!)}?view=card`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load profile");
      if (!data.profile) throw new Error("Profile response was empty");
      return data.profile as PublicProfile;
    },
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const profile = profileQuery.data;

  useEffect(() => {
    if (profileQuery.error) {
      toast.error(profileQuery.error instanceof Error ? profileQuery.error.message : "Couldn't load profile");
    }
  }, [profileQuery.error]);

  // Esc to close
  useEffect(() => {
    if (!profileModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeProfileCard(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileModalOpen, closeProfileCard]);

  // Focus trap: focus the card on open, cycle tab inside
  useEffect(() => {
    if (!profileModalOpen) return;
    const node = cardRef.current;
    if (!node) return;
    const focusables = () => Array.from(
      node.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute("disabled"));
    const first = focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [profileModalOpen, profile]);

  if (!profileModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4"
      role="presentation"
      onClick={closeProfileCard}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" aria-hidden />
      <div
        ref={cardRef}
        className="relative w-[min(420px,calc(100vw-1.5rem))] sm:w-[420px] animate-in zoom-in-95 fade-in duration-200 max-h-[92dvh] overflow-y-auto no-scrollbar rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {profileQuery.isPending ? (
          <div className="w-full rounded-3xl border bg-card p-7 flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full skeleton" />
            <div className="h-5 w-36 rounded-lg skeleton" />
            <div className="h-3.5 w-24 rounded-lg skeleton" />
          </div>
        ) : profile ? (
          <ProfilePopupCard profile={profile} onClose={closeProfileCard} compact />
        ) : (
          <div className="w-[min(420px,calc(100vw-1.5rem))] rounded-3xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Couldn’t load profile. Close and try again.
          </div>
        )}
      </div>
    </div>
  );
}
