// src/components/anime/clubs/clubs-view.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Plus,
  Users,
  Trophy,
  Flame,
  Clock,
  Sparkles,
  Lock,
  Globe,
  Search,
  ArrowLeft,
  Settings,
  UserPlus,
  Share2,
  Trash2,
  Check,
  X,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAppStore, useOpenProfile } from "../store";
import { useI18n } from "@/components/i18n-provider";
import { FramedAvatar } from "../ui-bits";
import { ChatPanel } from "../chat/chat-panel";
import { ClubSettingsDrawer } from "./club-settings-drawer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ClubBannerScene() {
  return (
    <svg
      viewBox="0 0 1200 160"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="club-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--background)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="club-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <rect width="1200" height="160" fill="url(#club-sky)" />
      <circle cx="1000" cy="42" r="26" fill="#fde68a" opacity="0.85" />
      <circle cx="1000" cy="42" r="40" fill="#fde68a" opacity="0.15" />
      <path d="M0 132 L180 58 L320 128 Z" fill="url(#club-hill)" />
      <path d="M220 140 L430 44 L620 140 Z" fill="url(#club-hill)" opacity="0.8" />
      <path d="M520 142 L760 62 L980 142 Z" fill="url(#club-hill)" opacity="0.6" />
      <path d="M900 148 L1080 78 L1200 148 Z" fill="url(#club-hill)" opacity="0.5" />
      <g stroke="var(--primary)" strokeWidth="6" fill="none" opacity="0.85">
        <path d="M150 132 V84" />
        <path d="M210 132 V84" />
        <path d="M132 84 H228" strokeWidth="7" />
        <path d="M140 96 H220" strokeWidth="5" />
        <path d="M120 74 Q180 64 240 74" strokeWidth="6" />
      </g>
      <g stroke="var(--foreground)" strokeWidth="2" fill="none" opacity="0.35">
        <path d="M380 40 q6 -6 12 0 q6 -6 12 0" />
        <path d="M430 56 q5 -5 10 0 q5 -5 10 0" />
      </g>
    </svg>
  );
}

interface ClubItem {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isPublic: boolean;
  level: number;
  xp: number;
  createdAt: string;
  memberCount: number;
  onlineCount?: number;
  owner: { id: string; username: string; displayName?: string | null; avatarUrl?: string | null };
  chatRoomId: string;
  myRole?: string | null;
}

interface ClubMemberItem {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    avatarFrame?: string | null;
    level: number;
    isOnline?: boolean;
  };
}

export function ClubsView({ initialClubId }: { initialClubId?: string }) {
  const { user, setAuthOpen } = useAppStore();
  const openProfile = useOpenProfile();
  const { t } = useI18n();

  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("popular");
  const [search, setSearch] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId ?? null);
  const [clubDetail, setClubDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"chat" | "members">("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Create club modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Invite code generation states
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  // Dub jamoasi takliflari
  const [dubInvites, setDubInvites] = useState<
    {
      id: string;
      team: { id: string; name: string; avatarUrl?: string | null };
      invitedBy?: { username: string; displayName: string | null } | null;
    }[]
  >([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) {
        if (active) setDubInvites([]);
        return;
      }
      try {
        const res = await fetch("/api/dub-team-invites");
        const data = await res.json();
        if (active) setDubInvites(Array.isArray(data.invites) ? data.invites : []);
      } catch {
        if (active) setDubInvites([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const respondDubInvite = async (inviteId: string, accept: boolean) => {
    setInviteBusyId(inviteId);
    try {
      const res = await fetch(`/api/dub-team-invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("dub.inviteFailed"));
      setDubInvites((current) => current.filter((invite) => invite.id !== inviteId));
      if (accept) {
        toast.success(t("dub.inviteAccepted"));
        fetchClubs();
      } else {
        toast.info(t("dub.inviteDeclined"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik");
    } finally {
      setInviteBusyId(null);
    }
  };

  const fetchClubs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        tab,
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/clubs?${q}`);
      if (res.ok) {
        const d = await res.json();
        setClubs(d.clubs || []);
      }
    } catch {
      toast.error("Klublarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, [tab]);

  // Handle search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      fetchClubs();
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load single club details when opened
  useEffect(() => {
    if (!selectedClubId) return;
    let active = true;
    (async () => {
      setDetailLoading(true);
      try {
        const r = await fetch(`/api/clubs/${selectedClubId}`);
        const d = await r.json();
        if (!active) return;
        if (d.club) {
          setClubDetail(d.club);
          setDetailTab("chat");
        } else {
          toast.error(d.error || "Klub topilmadi");
          setSelectedClubId(null);
        }
      } catch {
        if (active) toast.error("Klub ma'lumotlarini yuklashda xatolik");
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedClubId]);

  const handleCreateClub = async () => {
    if (!user) return setAuthOpen(true);
    if (!newName.trim() || !newTag.trim()) {
      toast.error("Klub nomi va tegini kiriting");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          tag: newTag,
          description: newDesc,
          isPublic: newPublic,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Klub yaratilmadi");

      toast.success("Klub muvaffaqiyatli yaratildi!");
      setCreateOpen(false);
      setNewName("");
      setNewTag("");
      setNewDesc("");
      fetchClubs();
      if (d.club?.id) {
        setInviteCode(null);
        setSelectedClubId(d.club.id);
      }
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClub = async (clubId: string) => {
    if (!user) return setAuthOpen(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/join`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Qo'shilishda xatolik");

      if (d.status === "joined") {
        toast.success("Klubga qo'shildingiz!");
        fetchClubs();
        setInviteCode(null);
        setSelectedClubId(clubId);
      } else {
        toast.info("Klubga a'zo bo'lish so'rovi yuborildi");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/join`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      toast.success("Klubdan chiqdingiz");
      setSettingsOpen(false);
      setSelectedClubId(null);
      fetchClubs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleGenerateInvite = async (clubId: string) => {
    setInviteBusy(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses: 50, expiresInDays: 7 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setInviteCode(d.invite.code);
      try {
        await navigator.clipboard.writeText(d.invite.code);
        toast.success("Taklif kodi nusxalandi");
      } catch {
        toast.success("Taklif kodi yaratildi");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleKickMember = async (clubId: string, uid: string) => {
    if (!confirm("Ushbu a'zoni klubdan chiqarib yubormoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/members/${uid}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("A'zo klubdan chiqarildi");
      // Refresh details
      setClubDetail((prev: any) => ({
        ...prev,
        members: prev.members.filter((m: any) => m.userId !== uid),
        memberCount: Math.max(0, prev.memberCount - 1),
      }));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleChange = async (clubId: string, uid: string, newRole: "mod" | "member") => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/members/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("Rol o'zgartirildi");
      setClubDetail((prev: any) => ({
        ...prev,
        members: prev.members.map((m: any) =>
          m.userId === uid ? { ...m, role: newRole } : m
        ),
      }));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Klub Detal Ko'rinishi (Chat + A'zolar + Sozlamalar) ───────────────────
  if (selectedClubId && clubDetail && clubDetail.id === selectedClubId) {
    const isStaff =
      clubDetail.myRole === "owner" ||
      clubDetail.myRole === "mod" ||
      user?.role === "ADMIN";

    const onlineMembers = (clubDetail.members as ClubMemberItem[])
      .filter((m) => m.user.isOnline)
      .map((m) => m.user);

    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedClubId(null);
            setSettingsOpen(false);
            setInviteCode(null);
          }}
          className="gap-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Barcha klublarga qaytish
        </Button>
        {/* Club Header */}
        <div className="overflow-hidden rounded-[26px] border bg-card shadow-sm">
          {/* Banner */}
          <div className="relative h-[90px] w-full overflow-hidden bg-primary/10 sm:h-[118px]">
            {clubDetail.bannerUrl ? (
              <img src={clubDetail.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ClubBannerScene />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="club-petal absolute block h-1.5 w-1.5 rounded-full bg-primary/40"
                  style={{ left: `${10 + i * 16}%`, top: `${12 + (i % 3) * 20}%`, animationDelay: `${i * 1.7}s` }}
                />
              ))}
            </div>
            <span className="absolute right-3 top-3 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-bold text-foreground backdrop-blur-sm">
              {clubDetail.isPublic ? "Ochiq klub" : "Yopiq klub"}
            </span>
          </div>

          {/* Info */}
          <div className="px-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-3 sm:gap-4">
                <div className="-mt-10 shrink-0 sm:-mt-12">
                  <div className="relative">
                    <div className="club-hex bg-gradient-to-br from-primary via-primary to-amber-500 p-[2px] shadow-[0_0_24px_-6px_var(--primary)]">
                      <div className="club-hex flex h-[76px] w-[72px] items-center justify-center overflow-hidden bg-card sm:h-[92px] sm:w-[86px]">
                        {clubDetail.avatarUrl ? (
                          <img
                            src={clubDetail.avatarUrl}
                            alt={clubDetail.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="club-display text-xl text-primary sm:text-2xl">{clubDetail.tag}</span>
                        )}
                      </div>
                    </div>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-2 py-0.5 text-[9px] font-black text-black shadow sm:text-[10px]">
                      LV.{clubDetail.level}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 pb-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="club-display truncate text-[22px] leading-tight sm:text-[28px]">
                      {clubDetail.name}
                    </h2>
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-black tracking-wide text-primary">
                      [{clubDetail.tag}]
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {clubDetail.memberCount} a’zo
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-500">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      {clubDetail.onlineCount ?? 1} online
                    </span>
                    <span aria-hidden>·</span>
                    <span>{clubDetail.xp.toLocaleString()} XP</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pb-2 sm:pb-3">
                {clubDetail.myRole ? (
                  <>
                    {isStaff && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5 rounded-full text-xs font-bold"
                        onClick={() => handleGenerateInvite(clubDetail.id)}
                        disabled={inviteBusy}
                      >
                        {inviteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                        Taklif kodi
                      </Button>
                    )}
                    <button
                      onClick={() => setSettingsOpen(true)}
                      aria-label="Klub sozlamalari"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-primary-foreground shadow-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                    >
                      <Settings className="h-4.5 w-4.5" />
                    </button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleJoinClub(clubDetail.id)}
                    className="h-9 gap-1.5 rounded-full bg-gradient-to-r from-primary to-amber-500 text-xs font-bold text-primary-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Klubga qo’shilish
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-2 flex items-center gap-1 overflow-x-auto border-t px-2 sm:px-4">
            <button
              onClick={() => setDetailTab("chat")}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-bold transition",
                detailTab === "chat"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              aria-current={detailTab === "chat" ? "page" : undefined}
            >
              <MessageSquare className="h-4 w-4" /> Jamoaviy Chat
            </button>
            <button
              onClick={() => setDetailTab("members")}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-bold transition",
                detailTab === "members"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              aria-current={detailTab === "members" ? "page" : undefined}
            >
              <Users className="h-4 w-4" /> A’zolar
              <span className="rounded-full border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">
                {clubDetail.memberCount}
              </span>
            </button>
            {isStaff && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-[13px] font-bold text-muted-foreground transition hover:text-foreground"
              >
                <Settings className="h-4 w-4" /> Boshqaruv
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {detailTab === "chat" && (
          <ChatPanel
            roomId={`club:${clubDetail.id}`}
            title="jamoaviy-chat"
            subtitle={`${clubDetail.memberCount} a’zo`}
            onlineMembers={onlineMembers}
            memberCount={clubDetail.memberCount}
            slowModeSeconds={clubDetail.slowMode}
          />
        )}

        {detailTab === "members" && (
          <div className="glass rounded-3xl p-6 border space-y-4">
            <h3 className="font-bold text-base">A'zolar ro'yxati</h3>
            <div className="divide-y divide-border/40">
              {clubDetail.members.map((m: ClubMemberItem) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <FramedAvatar user={m.user as any} size={40} />
                      {m.user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background shadow-xs" title="Online" />
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => openProfile(m.user.username)}
                        className="font-bold text-sm hover:underline flex items-center gap-2"
                      >
                        {m.user.displayName}
                        {m.role === "owner" ? (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/30">
                            Egasi
                          </Badge>
                        ) : m.role === "mod" ? (
                          <Badge className="text-[10px] bg-blue-500/15 text-blue-500 border-blue-500/30">
                            Moderator
                          </Badge>
                        ) : null}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        @{m.user.username} • Lv.{m.user.level}
                      </p>
                    </div>
                  </div>

                  {/* Staff controls for member */}
                  {isStaff && m.userId !== user?.id && m.role !== "owner" && (
                    <div className="flex items-center gap-2">
                      {clubDetail.myRole === "owner" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] rounded-lg"
                          onClick={() =>
                            handleRoleChange(
                              clubDetail.id,
                              m.userId,
                              m.role === "mod" ? "member" : "mod"
                            )
                          }
                        >
                          {m.role === "mod" ? "Modlikdan olish" : "Mod qilish"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={() => handleKickMember(clubDetail.id, m.userId)}
                      >
                        Chiqarish
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {settingsOpen && (
          <ClubSettingsDrawer
            club={{
              id: clubDetail.id,
              name: clubDetail.name,
              tag: clubDetail.tag,
              description: clubDetail.description,
              isPublic: clubDetail.isPublic,
              level: clubDetail.level,
              xp: clubDetail.xp,
              memberCount: clubDetail.memberCount,
              onlineCount: clubDetail.onlineCount ?? 0,
              myRole: clubDetail.myRole,
              weeklyTop: clubDetail.weeklyTop,
              levelStartXp: clubDetail.levelStartXp,
              nextLevelXp: clubDetail.nextLevelXp,
              invites: clubDetail.invites,
            }}
            inviteCode={inviteCode}
            inviteBusy={inviteBusy}
            onClose={() => setSettingsOpen(false)}
            onCreateInvite={() => handleGenerateInvite(clubDetail.id)}
            onLeave={() => handleLeaveClub(clubDetail.id)}
          />
        )}
      </div>
    );
  }

  // ─── Klublar Asosiy Ro'yxati ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="hidden sm:block">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Klublar va Jamiyatlar
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            O'zingizga yoqqan klubga qo'shiling, jamoaviy chatda fikr almashing va klubingizni 1-o'ringa olib chiqing!
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl gap-2 font-bold shadow-md">
              <Plus className="w-4 h-4" /> Klub yaratish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">Yangi klub yaratish</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs space-y-1">
                <p className="font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> 1-chi klub mutlaqo bepul!
                </p>
                <p className="text-muted-foreground">
                  Minimal talab: 10-daraja. Qo'shimcha klub ochish narxi: 200 kredit.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Klub nomi</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Masalan: Anime Stars UZ"
                  className="mt-1 rounded-xl"
                  maxLength={40}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Noyob TAG (2-4 ta harf/raqam)
                </label>
                <div className="relative mt-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value.toUpperCase())}
                    placeholder="Masalan: UZ, PRO, KILU"
                    className="rounded-xl uppercase font-mono tracking-wider pl-8"
                    maxLength={4}
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                    [
                  </span>
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">
                    ]
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Klub tavsifi</label>
                <Textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Klub maqsadi va qoidalari..."
                  rows={3}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl border bg-secondary/30">
                <div>
                  <p className="text-xs font-bold">Ochiq klub</p>
                  <p className="text-[11px] text-muted-foreground">
                    Hamma to'g'ridan-to'g'ri qo'shila oladi
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={newPublic}
                  onChange={(e) => setNewPublic(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Bekor qilish
                </Button>
                <Button onClick={handleCreateClub} disabled={creating} className="rounded-xl">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yaratish"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="rounded-2xl h-11 p-1 bg-secondary/40">
            <TabsTrigger value="popular" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <Flame className="w-3.5 h-3.5" /> Ommabop
            </TabsTrigger>
            <TabsTrigger value="level" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Reyting
            </TabsTrigger>
            <TabsTrigger value="new" className="rounded-xl text-xs font-bold px-4 gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Yangi
            </TabsTrigger>
            {user && (
              <TabsTrigger value="my" className="rounded-xl text-xs font-bold px-4 gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Mening klublarim
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Klub nomi yoki tegi bo'yicha qidiruv..."
            className="pl-9 rounded-2xl h-10 bg-secondary/30 text-xs"
          />
        </div>
      </div>

      {dubInvites.length > 0 && (
        <div className="space-y-2">
          {dubInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5"
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">
                  {t("dub.inviteBannerTeam", { team: invite.team.name })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("dub.inviteBannerHint")}
                  {invite.invitedBy ? ` · ${t("dub.inviteBannerBy", { name: invite.invitedBy.displayName || invite.invitedBy.username })}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => respondDubInvite(invite.id, true)}
                  disabled={inviteBusyId === invite.id}
                  className="rounded-full font-bold"
                >
                  {inviteBusyId === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {t("dub.inviteAccept")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => respondDubInvite(invite.id, false)}
                  disabled={inviteBusyId === invite.id}
                  className="rounded-full"
                >
                  <X className="w-3.5 h-3.5" /> {t("dub.inviteDecline")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clubs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-56 rounded-3xl skeleton" />
          ))}
        </div>
      ) : clubs.length === 0 ? (
        <div className="text-center p-12 rounded-3xl border border-dashed border-border/60 bg-secondary/10">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-bold text-base">Klublar topilmadi</p>
          <p className="text-xs text-muted-foreground mt-1">
            Birinchi bo'lib o'z anime klubingizni yarating!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clubs.map((c) => (
            <div
              key={c.id}
              className="glass rounded-3xl border overflow-hidden hover:border-primary/50 transition-all flex flex-col group"
            >
              {/* Banner */}
              <div className="h-24 bg-linear-to-r from-primary/15 via-primary/5 to-secondary/40 relative">
                {c.bannerUrl && (
                  <img src={c.bannerUrl} alt={c.name} className="w-full h-full object-cover" />
                )}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <Badge className="bg-background/80 text-foreground border shadow-xs text-[10px] backdrop-blur-xs">
                    {c.isPublic ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                    {c.isPublic ? "Ochiq" : "Yopiq"}
                  </Badge>
                  <Badge className="bg-primary/90 text-primary-foreground font-black text-[10px]">
                    Lv.{c.level}
                  </Badge>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 pt-0 relative flex-1 flex flex-col justify-between">
                <div>
                  {/* Avatar & Tag */}
                  <div className="flex items-end justify-between -mt-8 mb-2">
                    <div className="w-14 h-14 rounded-2xl border-2 border-background bg-secondary flex items-center justify-center font-black text-primary text-xl shadow-md">
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt={c.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        c.tag
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-black text-xs">
                      [{c.tag}]
                    </span>
                  </div>

                  <h3 className="font-bold text-base truncate group-hover:text-primary transition">
                    {c.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[32px]">
                    {c.description || "Ushbu klub a'zolari birgalikda anime tomosha qilishadi."}
                  </p>
                </div>

                <div className="pt-4 border-t mt-4 flex items-center justify-between">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span><strong className="text-foreground">{c.memberCount}</strong> a&apos;zo</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {c.onlineCount ?? 1} online
                    </span>
                    <span>•</span>
                    <span>XP: {c.xp}</span>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      setInviteCode(null);
                      setSelectedClubId(c.id);
                    }}
                    className="rounded-xl text-xs font-bold h-8 px-3"
                  >
                    {c.myRole ? "Chatga kirish" : "Ko'rish"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
