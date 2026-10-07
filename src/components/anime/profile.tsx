"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, Crown, CalendarDays, Heart, Film, Star, Timer, Package, Users,
  Pencil, Loader2, Image as ImageIcon, Smile, Sparkles, Lock, MessageSquareOff, Check, Link2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "./store";
import type { PublicProfile, AuthUser } from "./types";
import { Avatar, SmartImage, formatDuration, timeAgo } from "./ui-bits";
import { BANNER_PRESETS, AVATAR_PRESETS, COVER_BANNER_PRESETS, ACCENT_PRESETS } from "./profile-assets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ============ ACHIEVEMENTS (special AniVerse touch) ============ */
function getAchievements(p: PublicProfile | AuthUser) {
  const isCreator = p.role === "CREATOR";
  const purchaseCount = "stats" in p ? p.stats.purchaseCount : 0;
  const watchSeconds = "stats" in p ? p.stats.watchSeconds : 0;
  const postCount = "stats" in p ? p.stats.postCount : 0;
  return [
    { id: "join", emoji: "🎬", name: "AniVerse Citizen", desc: "Joined AniVerse", earned: true },
    { id: "first", emoji: "💎", name: "First Purchase", desc: "Bought 1 anime", earned: purchaseCount >= 1 },
    { id: "collector", emoji: "📚", name: "Collector", desc: "Owns 10 animes", earned: purchaseCount >= 10 },
    { id: "exchange", emoji: "🔄", name: "Exchange Master", desc: "Owns 20 animes & trades", earned: purchaseCount >= 20 },
    { id: "binge", emoji: "🍿", name: "Binge Watcher", desc: "5+ hours watched", earned: watchSeconds >= 5 * 3600 },
    { id: "star", emoji: "⭐", name: "Community Star", desc: "Posted 5 times", earned: postCount >= 5 },
    { id: "creator", emoji: "👑", name: "Creator", desc: "Publishes animes", earned: isCreator },
  ];
}

/* ============ SHARED PROFILE PIECES ============ */

function ProfileBadges({ p }: { p: PublicProfile }) {
  return (
    <div className="flex items-center gap-1.5">
      {p.role === "CREATOR" ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 rounded-full px-2.5 py-1">
          <Crown className="w-3 h-3" /> Creator
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 rounded-full px-2.5 py-1">
          <BadgeCheck className="w-3 h-3" /> Viewer
        </span>
      )}
      {p.stats.exchangeUnlocked && (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-full px-2.5 py-1">
          <Sparkles className="w-3 h-3" /> Trader
        </span>
      )}
    </div>
  );
}

function StatsGrid({ p }: { p: PublicProfile }) {
  const stats = [
    { icon: <Package className="w-3.5 h-3.5" />, label: "Owned", value: p.stats.purchaseCount },
    { icon: <Timer className="w-3.5 h-3.5" />, label: "Watch time", value: formatDuration(p.stats.watchSeconds) },
    { icon: <Users className="w-3.5 h-3.5" />, label: "Followers", value: p.stats.followers },
    { icon: <Film className="w-3.5 h-3.5" />, label: "Posts", value: p.stats.postCount },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl bg-secondary/50 border px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
            {s.icon} {s.label}
          </p>
          <p className="text-lg font-black tabular-nums mt-0.5">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function AchievementBadges({ p }: { p: PublicProfile }) {
  const achievements = getAchievements(p);
  const earned = achievements.filter((a) => a.earned);
  return (
    <div className="flex flex-wrap gap-1.5">
      {earned.map((a) => (
        <span
          key={a.id}
          title={`${a.name} — ${a.desc}`}
          className="w-9 h-9 rounded-xl bg-secondary/70 border flex items-center justify-center text-lg hover:scale-110 transition cursor-help"
        >
          {a.emoji}
        </span>
      ))}
      <span className="text-[10px] text-muted-foreground self-center ml-1">
        {earned.length}/{achievements.length} achievements
      </span>
    </div>
  );
}

/* ============ DESKTOP PROFILE MODAL (Discord-style small mirror) ============ */
export function ProfileModal() {
  const { profileModalOpen, setProfileModalOpen, user, navigate } = useAppStore();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (profileModalOpen && user) {
      fetch(`/api/users/${user.username}`)
        .then((r) => r.json())
        .then((d) => d.profile && setProfile(d.profile))
        .catch(() => {});
    }
  }, [profileModalOpen, user]);

  return (
    <>
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent
          className="sm:max-w-[720px] p-0 gap-0 overflow-hidden rounded-3xl border-primary/20 hidden sm:block max-h-[86vh]"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{profile ? `${profile.displayName || profile.username} profile` : "Profile"}</DialogTitle>
          {profile ? (
            <div className="grid grid-cols-[280px_1fr] h-[560px] max-h-[86vh]">
              {/* LEFT — identity */}
              <div className="overflow-y-auto fancy-scroll bg-sidebar/60 border-r">
                <div className="relative banner-shine">
                  <div className="h-28 w-full">
                    <SmartImage
                      src={profile.bannerUrl || profile.avatarUrl}
                      alt="Profile banner"
                      className="w-full h-full object-cover"
                      accentFrom={profile.accentColor}
                      accentTo="#1e1b4b"
                    />
                  </div>
                  <div
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-full p-1"
                    style={{ background: "var(--card)" }}
                  >
                    <Avatar
                      src={profile.avatarUrl}
                      name={profile.displayName || profile.username}
                      accent={profile.accentColor}
                      size={72}
                    />
                  </div>
                </div>

                <div className="pt-11 px-4 pb-5 text-center">
                  <h2 className="font-black text-lg truncate">{profile.displayName || profile.username}</h2>
                  <p className="text-xs text-muted-foreground mb-2">@{profile.username}</p>
                  <div className="flex justify-center mb-4">
                    <ProfileBadges p={profile} />
                  </div>

                  <Button
                    size="sm"
                    className="w-full rounded-xl h-9 font-bold"
                    variant="secondary"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Customize Profile
                  </Button>
                  <Button
                    size="sm"
                    className="w-full rounded-xl h-9 font-bold mt-2"
                    variant="outline"
                    onClick={() => {
                      setProfileModalOpen(false);
                      navigate("user-profile", { username: profile.username });
                    }}
                  >
                    View Full Profile
                  </Button>

                  <div className="mt-5 text-left space-y-4">
                    {profile.bio && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">About me</p>
                        <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line">{profile.bio}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Member since
                      </p>
                      <p className="text-xs">
                        {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Achievements</p>
                      <AchievementBadges p={profile} />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT — content tabs */}
              <div className="overflow-y-auto fancy-scroll p-5">
                <ProfileRightPanel profile={profile} />
              </div>
            </div>
          ) : (
            <div className="p-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog (works for both modal & mobile contexts) */}
      {profile && <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} onSaved={setProfile} />}
    </>
  );
}

export function ProfileRightPanel({ profile }: { profile: PublicProfile }) {
  const { navigate } = useAppStore();
  return (
    <div className="space-y-6">
      <StatsGrid p={profile} />

      {profile.recentAnimes.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Film className="w-3 h-3" /> Recent pickups
          </p>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {profile.recentAnimes.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("detail", { animeId: a.slug })}
                className="w-[84px] shrink-0 group text-left"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden border">
                  <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                </div>
                <p className="text-[10px] font-semibold mt-1 line-clamp-2 group-hover:text-primary transition">{a.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {profile.favoriteAnimes.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-400" /> Favorite animes
          </p>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {profile.favoriteAnimes.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("detail", { animeId: a.slug })}
                className="w-[84px] shrink-0 group text-left"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden border">
                  <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                </div>
                <p className="text-[10px] font-semibold mt-1 line-clamp-2 group-hover:text-primary transition">{a.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {profile.favoriteUsers.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="w-3 h-3" /> Favorite members
          </p>
          <div className="space-y-1.5">
            {profile.favoriteUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => navigate("user-profile", { username: u.username })}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-accent transition text-left group"
              >
                <Avatar src={u.avatarUrl} name={u.displayName} accent={u.accentColor} size={32} />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate group-hover:text-primary transition">{u.displayName || u.username}</p>
                  <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed p-3.5 flex items-start gap-2.5">
        <MessageSquareOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          AniVerse has no direct messages — connect through community posts, watch parties and favorites instead.
        </p>
      </div>
    </div>
  );
}

/* ============ MOBILE / FULL PAGE PROFILE ============ */
export function ProfileFullView({ username }: { username: string }) {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const isMe = user && profile && user.username === profile.username;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${username}`)
      .then((r) => r.json())
      .then((d) => setProfile(d.profile || null))
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [username, user]);

  async function toggleFollow() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!profile || isMe) return;
    setFavBusy(true);
    try {
      const res = await fetch(`/api/users/${profile.username}/favorite`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setProfile({
          ...profile,
          isFollowing: d.following,
          stats: { ...profile.stats, followers: profile.stats.followers + (d.following ? 1 : -1) },
        });
        toast.success(d.following ? `Added ${profile.displayName} to favorites ♥` : "Removed from favorites");
      }
    } finally {
      setFavBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-6">
        <div className="h-40 rounded-3xl skeleton mb-4" />
        <div className="flex gap-4 items-end -mt-12 mb-4">
          <div className="w-24 h-24 rounded-full skeleton" />
          <div className="flex-1 space-y-2 pb-2">
            <div className="h-5 w-40 rounded skeleton" />
            <div className="h-3 w-28 rounded skeleton" />
          </div>
        </div>
        <div className="h-24 rounded-2xl skeleton" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">👻</p>
        <p className="font-bold text-lg">User not found</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("home")}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-8 py-4 sm:py-6 pb-10">
      {/* Banner + avatar */}
      <div className="relative banner-shine rounded-3xl overflow-hidden">
        <div className="h-40 sm:h-56">
          <SmartImage
            src={profile.bannerUrl || profile.avatarUrl}
            alt="Profile banner"
            className="w-full h-full object-cover"
            accentFrom={profile.accentColor}
            accentTo="#1e1b4b"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>

      <div className="flex items-end gap-4 -mt-12 sm:-mt-14 px-2">
        <div className="rounded-full p-1 bg-background shrink-0 shadow-xl">
          <Avatar
            src={profile.avatarUrl}
            name={profile.displayName || profile.username}
            accent={profile.accentColor}
            size={96}
          />
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <h1 className="text-xl sm:text-2xl font-black truncate">{profile.displayName || profile.username}</h1>
          <p className="text-xs text-muted-foreground">@{profile.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 px-1 flex-wrap">
        <ProfileBadges p={profile} />
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5 mt-4 flex-wrap">
        {isMe ? (
          <>
            <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Customize Profile
            </Button>
            {user?.role === "CREATOR" && (
              <Button variant="secondary" className="rounded-full font-bold" onClick={() => navigate("studio")}>
                <Crown className="w-4 h-4" /> Creator Studio
              </Button>
            )}
          </>
        ) : (
          <Button
            disabled={favBusy}
            onClick={toggleFollow}
            className={cn(
              "rounded-full font-bold",
              profile.isFollowing ? "bg-secondary hover:bg-secondary/80" : "brand-gradient text-white"
            )}
          >
            <Heart className={cn("w-4 h-4", profile.isFollowing && "fill-current")} />
            {profile.isFollowing ? "Favorited" : "Favorite"}
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="mt-6 space-y-6">
        {profile.bio && (
          <section className="glass rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5" /> About me
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </section>
        )}

        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">Stats</p>
          <StatsGrid p={profile} />
          <div className="mt-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Achievements</p>
            <AchievementBadges p={profile} />
          </div>
        </section>

        {profile.favoriteAnimes.length > 0 && (
          <section className="glass rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> Favorite animes
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {profile.favoriteAnimes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("detail", { animeId: a.slug })}
                  className="group text-left"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden border">
                    <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <p className="text-[10px] font-semibold mt-1.5 line-clamp-2 group-hover:text-primary transition">{a.title}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {profile.recentAnimes.length > 0 && (
          <section className="glass rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" /> Collection highlights
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {profile.recentAnimes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("detail", { animeId: a.slug })}
                  className="group text-left"
                  title={a.title}
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden border">
                    <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Favorite users */}
        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Favorite members
            <span className="text-muted-foreground/60 font-normal normal-case">({profile.stats.following})</span>
          </p>
          {profile.favoriteUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profile.favoriteUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => navigate("user-profile", { username: u.username })}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition text-left group border border-transparent hover:border-primary/30"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} accent={u.accentColor} size={40} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate group-hover:text-primary transition">{u.displayName || u.username}</p>
                    <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No favorites yet</p>
          )}
        </section>

        {/* Followers */}
        {profile.followersList.length > 0 && (
          <section className="glass rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400" /> Favorited by
              <span className="text-muted-foreground/60 font-normal normal-case">({profile.stats.followers})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.followersList.map((u) => (
                <button
                  key={u.id}
                  onClick={() => navigate("user-profile", { username: u.username })}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-secondary/60 border hover:border-primary/40 transition"
                  title={`@${u.username}`}
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} accent={u.accentColor} size={22} />
                  <span className="text-xs font-semibold">{u.displayName || u.username}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-2xl border border-dashed p-4 flex items-start gap-2.5">
          <MessageSquareOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            AniVerse keeps things friendly — no DMs. Interact through community posts, watch parties and favorites.
          </p>
        </div>
      </div>

      {isMe && user && <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} onSaved={setProfile} me={user} />}
    </div>
  );
}

/* ============ EDIT PROFILE DIALOG ============ */
export function EditProfileDialog({
  open, onOpenChange, onSaved, me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: PublicProfile) => void;
  me?: AuthUser;
}) {
  const { user, updateUser } = useAppStore();
  const base = me || user;
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [accent, setAccent] = useState("#a855f7");
  const [tab, setTab] = useState<"avatar" | "banner" | "color">("avatar");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && base) {
      setDisplayName(base.displayName || "");
      setBio(base.bio || "");
      setAvatarUrl(base.avatarUrl || "");
      setBannerUrl(base.bannerUrl || "");
      setAccent(base.accentColor || "#a855f7");
    }
  }, [open, base]);

  async function save() {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), bio, avatarUrl, bannerUrl, accentColor: accent }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to save");
        return;
      }
      updateUser(d.user);
      toast.success("Profile updated ✨");
      onOpenChange(false);
      // Refresh profile data
      fetch(`/api/users/${d.user.username}`)
        .then((r) => r.json())
        .then((pd) => pd.profile && onSaved(pd.profile))
        .catch(() => {});
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!base) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl max-h-[88vh] overflow-y-auto fancy-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4.5 h-4.5 text-primary" /> Customize Profile
          </DialogTitle>
          <DialogDescription>Make it yours — banner, avatar, accent color and bio</DialogDescription>
        </DialogHeader>

        {/* Live preview */}
        <div className="rounded-2xl overflow-hidden border">
          <div className="h-24 relative banner-shine">
            <SmartImage
              src={bannerUrl || avatarUrl}
              alt="banner preview"
              className="w-full h-full object-cover"
              accentFrom={accent}
              accentTo="#1e1b4b"
            />
          </div>
          <div className="px-4 pb-4 -mt-7 relative">
            <div className="rounded-full p-1 inline-block" style={{ background: "var(--card)" }}>
              <Avatar src={avatarUrl} name={displayName || base.username} accent={accent} size={56} />
            </div>
            <p className="font-black mt-1.5">{displayName || base.username}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
              />
              <span className="text-[11px] text-muted-foreground">@{base.username} · {base.role.toLowerCase()}</span>
            </div>
          </div>
        </div>

        {/* Name & bio */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Bio <span className="text-muted-foreground font-normal">({bio.length}/300)</span></Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              placeholder="Tell the world about your anime journey..."
              className="rounded-xl min-h-16"
            />
          </div>
        </div>

        {/* Asset picker */}
        <div className="space-y-2.5">
          <div className="flex gap-1.5">
            {(["avatar", "banner", "color"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold capitalize transition",
                  tab === t ? "brand-gradient text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "color" ? "Accent" : t}
              </button>
            ))}
          </div>

          {tab === "avatar" && (
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.map((url) => (
                  <button
                    key={url}
                    onClick={() => setAvatarUrl(url)}
                    className={cn(
                      "aspect-square rounded-full overflow-hidden border-2 transition",
                      avatarUrl === url ? "border-primary scale-105" : "border-transparent hover:scale-105"
                    )}
                    aria-label="Avatar preset"
                  >
                    { }
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="...or paste a custom image URL"
                  className="pl-9 h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {tab === "banner" && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto fancy-scroll p-0.5">
                {BANNER_PRESETS.map((url) => (
                  <button
                    key={url}
                    onClick={() => setBannerUrl(url)}
                    className={cn(
                      "aspect-video rounded-lg overflow-hidden border-2 transition",
                      bannerUrl === url ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                    aria-label="Banner preset"
                  >
                    { }
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
                {COVER_BANNER_PRESETS.map((c) => (
                  <button
                    key={c.url}
                    onClick={() => setBannerUrl(c.url)}
                    className={cn(
                      "aspect-video rounded-lg overflow-hidden border-2 transition",
                      bannerUrl === c.url ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                    aria-label={`Banner: ${c.title}`}
                    title={c.title}
                  >
                    { }
                    <img src={c.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="...or paste a custom image URL"
                  className="pl-9 h-9 rounded-xl text-xs"
                />
              </div>
              {bannerUrl && (
                <button
                  onClick={() => setBannerUrl("")}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition"
                >
                  Remove banner
                </button>
              )}
            </div>
          )}

          {tab === "color" && (
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  className={cn(
                    "w-9 h-9 rounded-full transition hover:scale-110 border-2",
                    accent === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ background: c, boxShadow: accent === c ? `0 0 12px ${c}` : undefined }}
                  aria-label={`Accent ${c}`}
                />
              ))}
              <label className="w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer hover:scale-110 transition" title="Custom color">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="sr-only"
                  aria-label="Custom accent color"
                />
                <span className="text-xs font-bold">+</span>
              </label>
            </div>
          )}
        </div>

        <Button disabled={saving} onClick={save} className="w-full h-11 rounded-xl brand-gradient text-white font-bold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Profile
        </Button>
      </DialogContent>
    </Dialog>
  );
}
