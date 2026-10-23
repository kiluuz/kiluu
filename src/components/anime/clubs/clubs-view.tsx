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
  Copy,
  LogOut,
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
import { FramedAvatar, SmartImage } from "../ui-bits";
import { ChatPanel } from "../chat/chat-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export function ClubsView() {
  const { user, setAuthOpen } = useAppStore();
  const openProfile = useOpenProfile();

  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("popular");
  const [search, setSearch] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [clubDetail, setClubDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"chat" | "members" | "settings">("chat");

  // Create club modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Invite code generation states
  const [inviteCode, setInviteCode] = useState<string | null>(null);

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
    if (!selectedClubId) {
      setClubDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/clubs/${selectedClubId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.club) {
          setClubDetail(d.club);
          setDetailTab("chat");
        } else {
          toast.error(d.error || "Klub topilmadi");
          setSelectedClubId(null);
        }
      })
      .catch(() => {
        toast.error("Klub ma'lumotlarini yuklashda xatolik");
      })
      .finally(() => setDetailLoading(false));
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
        setSelectedClubId(clubId);
      } else {
        toast.info("Klubga a'zo bo'lish so'rovi yuborildi");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    if (!confirm("Haqiqatan ham klubdan chiqmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/join`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      toast.success("Klubdan chiqdingiz");
      setSelectedClubId(null);
      fetchClubs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleGenerateInvite = async (clubId: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses: 50, expiresInDays: 7 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setInviteCode(d.invite.code);
      navigator.clipboard.writeText(d.invite.code);
      toast.success("Taklif kodi nusxalandi: " + d.invite.code);
    } catch (e: any) {
      toast.error(e.message);
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
  if (selectedClubId && clubDetail) {
    const isStaff =
      clubDetail.myRole === "owner" ||
      clubDetail.myRole === "mod" ||
      user?.role === "ADMIN";

    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedClubId(null)}
          className="gap-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Barcha klublarga qaytish
        </Button>

        {/* Club Banner & Header */}
        <div className="relative rounded-3xl overflow-hidden border bg-card shadow-sm">
          {/* Banner */}
          <div className="h-36 sm:h-48 w-full bg-linear-to-r from-primary/20 via-primary/5 to-secondary/30 relative">
            {clubDetail.bannerUrl && (
              <img
                src={clubDetail.bannerUrl}
                alt={clubDetail.name}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/30 to-transparent" />
          </div>

          {/* Info bar */}
          <div className="px-6 pb-6 pt-0 relative -mt-12 sm:-mt-16 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4 min-w-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-4 border-background bg-secondary flex items-center justify-center text-3xl font-black text-primary shadow-lg shrink-0">
                {clubDetail.avatarUrl ? (
                  <img
                    src={clubDetail.avatarUrl}
                    alt={clubDetail.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  clubDetail.tag
                )}
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black truncate">{clubDetail.name}</h2>
                  <span className="px-2 py-0.5 rounded-lg bg-primary text-primary-foreground font-black text-xs tracking-wider">
                    [{clubDetail.tag}]
                  </span>
                  <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
                    <Trophy className="w-3 h-3" /> Lv.{clubDetail.level}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {clubDetail.memberCount} a&apos;zo
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-500">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {clubDetail.onlineCount ?? 1} online
                  </span>
                  <span>•</span>
                  <span>XP: {clubDetail.xp}</span>
                  <span>•</span>
                  <span>{clubDetail.isPublic ? "Ochiq klub" : "Yopiq klub"}</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {clubDetail.myRole ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs gap-1.5"
                    onClick={() => handleGenerateInvite(clubDetail.id)}
                  >
                    <Share2 className="w-3.5 h-3.5" /> Taklif kodi
                  </Button>
                  {clubDetail.myRole !== "owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => handleLeaveClub(clubDetail.id)}
                    >
                      <LogOut className="w-3.5 h-3.5 mr-1" /> Chiqish
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleJoinClub(clubDetail.id)}
                  className="rounded-xl text-xs font-bold"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Klubga qo'shilish
                </Button>
              )}
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="px-6 border-t bg-secondary/20 flex gap-4">
            <button
              onClick={() => setDetailTab("chat")}
              className={cn(
                "py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition",
                detailTab === "chat"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-4 h-4" /> Jamoaviy Chat
            </button>
            <button
              onClick={() => setDetailTab("members")}
              className={cn(
                "py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition",
                detailTab === "members"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-4 h-4" /> A&apos;zolar ({clubDetail.memberCount})
              {clubDetail.onlineCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                  {clubDetail.onlineCount} online
                </span>
              )}
            </button>
            {isStaff && (
              <button
                onClick={() => setDetailTab("settings")}
                className={cn(
                  "py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition",
                  detailTab === "settings"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings className="w-4 h-4" /> Boshqaruv
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {detailTab === "chat" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <ChatPanel
                roomId={`club:${clubDetail.id}`}
                title={`[${clubDetail.tag}] ${clubDetail.name} chati`}
                subtitle={`${clubDetail.memberCount} ta a'zo • ${clubDetail.onlineCount ?? 1} online`}
              />
            </div>
            <div className="space-y-4">
              <div className="glass rounded-3xl p-5 border space-y-3">
                <h4 className="font-bold text-sm">Klub qoidalari</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {clubDetail.description ||
                    "Ushbu klub a'zolari bir-biriga hurmat bilan munosabatda bo'lishadi. Reklama va haqorat taqiqlanadi."}
                </p>
              </div>

              <div className="glass rounded-3xl p-5 border space-y-3">
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" /> Klub Darajasi: {clubDetail.level}
                </h4>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, (clubDetail.xp % 500) / 5)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A'zolar chatda yozishi, anime ko'rishi va xarid qilishi klubga XP beradi!
                </p>
              </div>
            </div>
          </div>
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

        {detailTab === "settings" && isStaff && (
          <div className="glass rounded-3xl p-6 border space-y-6 max-w-xl">
            <h3 className="font-bold text-base">Klub sozlamalari</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tavsif / Qoidalar</label>
                <Textarea
                  defaultValue={clubDetail.description || ""}
                  rows={3}
                  className="mt-1 rounded-2xl"
                  placeholder="Klub qoidalarini kiriting..."
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button size="sm" className="rounded-xl">
                  Saqlash
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Klublar Asosiy Ro'yxati ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
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
                    onClick={() => setSelectedClubId(c.id)}
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
