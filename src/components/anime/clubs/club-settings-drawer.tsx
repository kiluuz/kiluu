"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Copy, LogOut, Bell, ShieldQuestion, Sparkles, Trophy, Users,
  Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FramedAvatar } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ClubWeeklyTop {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  xp: number;
}

interface ClubSettingsDrawerProps {
  club: {
    id: string;
    name: string;
    tag: string;
    description?: string | null;
    isPublic: boolean;
    level: number;
    xp: number;
    memberCount: number;
    onlineCount: number;
    myRole?: string | null;
    weeklyTop?: ClubWeeklyTop[];
    levelStartXp?: number;
    nextLevelXp?: number;
    invites?: { code: string }[] | null;
  };
  inviteCode: string | null;
  inviteBusy?: boolean;
  onClose: () => void;
  onCreateInvite: () => void;
  onLeave: () => void;
}

function SectionLabel({ ja, children }: { ja: string; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[3px] text-primary">
      {children}
      <span className="font-medium tracking-[0.18em] text-muted-foreground/60">{ja}</span>
    </p>
  );
}

export function ClubSettingsDrawer({
  club,
  inviteCode,
  inviteBusy = false,
  onClose,
  onCreateInvite,
  onLeave,
}: ClubSettingsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const notifyKey = `kiluu.club.notify.${club.id}`;
  const [notify, setNotify] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(notifyKey) !== "off";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    focusables()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  function toggleNotify() {
    const next = !notify;
    setNotify(next);
    try {
      window.localStorage.setItem(notifyKey, next ? "on" : "off");
    } catch {}
    toast.success(next ? "Bildirishnomalar yoqildi" : "Bildirishnomalar o’chirildi");
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Nusxalandi");
    } catch {
      toast.error("Nusxalab bo’lmadi. Kodni qo’lda ko’chiring.");
    }
  }

  const level = Math.max(1, club.level || 1);
  const levelStart = club.levelStartXp ?? 0;
  const levelNext = club.nextLevelXp ?? club.xp;
  const currentXp = Math.max(0, club.xp - levelStart);
  const neededXp = Math.max(1, levelNext - levelStart);
  const ratio = Math.min(1, currentXp / neededXp);
  const dashOffset = 264 * (1 - ratio);
  const isMaxLevel = level >= 20;
  const code = inviteCode ?? club.invites?.[0]?.code ?? null;
  const isOwner = club.myRole === "owner";
  const isMember = Boolean(club.myRole);
  const canInvite = isOwner || club.myRole === "mod";

  return (
    <div className="fixed inset-0 z-[95]" role="presentation">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Klub sozlamalari"
        className="absolute right-0 top-0 flex h-full w-full sm:w-[440px] flex-col border-l bg-card shadow-2xl animate-in slide-in-from-right duration-200 motion-reduce:animate-none"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.34em] text-muted-foreground/70">設定</p>
            <h2 className="club-display mt-1 text-xl leading-none">Klub sozlamalari</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 fancy-scroll">
          {/* Stats */}
          <section>
            <SectionLabel ja="統計">Jamoa</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "A’ZOLAR", value: club.memberCount, icon: Users, tone: "text-foreground" },
                { label: "ONLINE", value: club.onlineCount, icon: Sparkles, tone: "text-emerald-500" },
                { label: "KLUB XP", value: club.xp, icon: Trophy, tone: "text-amber-500" },
                { label: "DARAJA", value: level, icon: ShieldQuestion, tone: "text-primary" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="club-stat-cut rounded-[14px] border bg-secondary/30 px-3.5 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      {stat.label}
                    </span>
                    <stat.icon className={cn("h-3.5 w-3.5", stat.tone)} aria-hidden />
                  </div>
                  <p className={cn("club-display mt-1.5 text-2xl leading-none tabular-nums", stat.tone)}>
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Level ring */}
          <section>
            <SectionLabel ja="レベル">Klub darajasi</SectionLabel>
            <div className="rounded-[20px] border bg-secondary/20 p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-[104px] w-[104px] shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-border" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#club-ring-gradient)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray="264"
                      strokeDashoffset={dashOffset}
                      style={{ transition: "stroke-dashoffset 400ms ease" }}
                    />
                    <defs>
                      <linearGradient id="club-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="club-display text-xl leading-none">Lv.{level}</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      daraja
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {isMaxLevel ? "Maksimal daraja" : `Keyingi: Lv.${level + 1}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {isMaxLevel
                      ? `${club.xp.toLocaleString()} XP yig’ilgan`
                      : `${Math.max(0, neededXp - currentXp).toLocaleString()} XP qoldi`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-[width] duration-500"
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {currentXp.toLocaleString()} / {neededXp.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                A’zolar chatda yozishi, anime ko’rishi va xarid qilishi klubga XP beradi!
              </p>
            </div>
          </section>

          {/* Weekly top 3 */}
          <section>
            <SectionLabel ja="頂点">Haftalik top-3</SectionLabel>
            <div className="space-y-1.5">
              {(club.weeklyTop ?? []).length === 0 ? (
                <p className="rounded-2xl border border-dashed px-3 py-3 text-[11px] text-muted-foreground">
                  Bu hafta hali XP yig’ilmagan. Birinchi bo’lib hissa qo’shing!
                </p>
              ) : (
                (club.weeklyTop ?? []).map((member, index) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-2.5 rounded-2xl border bg-card px-3 py-2"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black text-black/80",
                        index === 0 ? "bg-amber-400" : index === 1 ? "bg-slate-300" : "bg-amber-700 text-white"
                      )}
                      aria-label={`${index + 1}-o’rin`}
                    >
                      {index + 1}
                    </span>
                    <FramedAvatar user={member as never} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                      {member.displayName || member.username}
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-amber-500">
                      {member.xp.toLocaleString()} XP
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Rules */}
          <section>
            <SectionLabel ja="ルール">Klub qoidalari</SectionLabel>
            <p className="rounded-2xl border bg-secondary/20 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground">
              {club.description ||
                "Ushbu klub a’zolari bir-biriga hurmat bilan munosabatda bo’lishadi. Reklama va haqorat taqiqlanadi."}
            </p>
          </section>

          {/* Invite */}
          {isMember && canInvite && (
            <section>
              <SectionLabel ja="招待">Taklif kodi</SectionLabel>
              {code ? (
                <div className="flex items-center gap-2">
                  <code className="club-display flex-1 truncate rounded-xl border bg-background px-3 py-2.5 text-sm tracking-[0.18em]">
                    {code}
                  </code>
                  <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => void copyCode(code)}>
                    <Copy className="h-3.5 w-3.5" /> Nusxa
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-1.5"
                  onClick={onCreateInvite}
                  disabled={inviteBusy}
                >
                  {inviteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Kod yaratish
                </Button>
              )}
              <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                Kod 7 kun amal qiladi va 50 martagacha ishlatiladi.
              </p>
            </section>
          )}

          {/* Notifications */}
          {isMember && (
            <section>
              <SectionLabel ja="通知">Bildirishnomalar</SectionLabel>
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-[12.5px] font-bold">Klub xabarlari</p>
                    <p className="text-[10.5px] text-muted-foreground">Yangi e’lon va hodisalar haqida xabar berish</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={notify}
                  aria-label="Klub bildirishnomalari"
                  onClick={toggleNotify}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    notify ? "border-primary/50 bg-primary" : "border-border bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all",
                      notify ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              </div>
            </section>
          )}

          {/* Leave */}
          {isMember && (
            <section className="pb-2">
              {isOwner ? (
                <p className="rounded-2xl border border-dashed px-3.5 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  Egasi klubdan chiqa olmaydi. Klubni butunlay yopish uchun boshqaruv bo’limidan foydalaning.
                </p>
              ) : (
                <button
                  onClick={() => setLeaveOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/50 px-4 py-2.5 text-sm font-bold text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogOut className="h-4 w-4" /> Klubdan chiqish
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle>Klubdan chiqish?</DialogTitle>
            <DialogDescription>
              Siz «{club.name}» klubidan chiqasiz. Qayta qo’shilish uchun taklif kodi kerak bo’lishi mumkin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLeaveOpen(false);
                onLeave();
              }}
            >
              Chiqish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
