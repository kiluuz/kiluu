"use client";

import { useEffect, useState } from "react";
import {
  UsersRound, Search, RefreshCw, ChevronLeft, ChevronRight,
  ShieldAlert, Coins, UserPlus, Crown, Wifi, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { cn } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  avatarUrl: string | null;
  credits: number;
  emailVerified: boolean;
  onboardingDone: boolean;
  telegramUsername: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

interface UsersResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  onlineOnly: boolean;
  stats: { total: number; online: number; today: number; creators: number };
}

const ONLINE_WINDOW_MS = 5 * 60_000;

const ROLE_META: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "border-primary/40 bg-primary/10 text-primary" },
  creator: { label: "Creator", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  user: { label: "User", className: "border-border bg-secondary/60 text-muted-foreground" },
};

function isOnline(lastSeenAt: string | null) {
  return Boolean(lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatSeen(lastSeenAt: string | null) {
  if (!lastSeenAt) return "Hech qachon";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_WINDOW_MS) return "Hozir online";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} daq oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} kun oldin`;
  return formatDate(lastSeenAt);
}

export function AdminUsersView() {
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query.trim());
      setPage(1);
      setLoading(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (appliedQuery) params.set("q", appliedQuery);
    if (onlineOnly) params.set("online", "1");
    (async () => {
      try {
        const res = await fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Ma’lumotlarni yuklab bo’lmadi");
        setData(json as UsersResponse);
        setError(null);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isAdmin, page, appliedQuery, onlineOnly, reload]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive opacity-70 mb-4" />
        <p className="text-xl font-black">Ruxsat yo’q</p>
        <p className="text-sm text-muted-foreground mt-2">
          Bu sahifa faqat administratorlar uchun.
        </p>
      </div>
    );
  }

  const stats = data?.stats;
  const users = data?.users ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));
  const tiles = [
    { label: "JAMI", value: stats?.total, tone: "text-foreground", icon: UsersRound },
    { label: "ONLINE", value: stats?.online, tone: "text-emerald-500", icon: Wifi },
    { label: "BUGUN QO’SHILGAN", value: stats?.today, tone: "text-primary", icon: UserPlus },
    { label: "CREATORLAR", value: stats?.creators, tone: "text-amber-500", icon: Crown },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/20">
            <UsersRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Foydalanuvchilar</h1>
            <p className="text-sm text-muted-foreground">
              {stats ? `${stats.total} ta akkaunt · ${stats.online} online` : "Yuklanmoqda..."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-xl gap-2"
          onClick={() => {
            setLoading(true);
            setReload((r) => r + 1);
          }}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Yangilash
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border bg-card px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {tile.label}
              </span>
              <tile.icon className={cn("w-4 h-4", tile.tone)} aria-hidden="true" />
            </div>
            <p className={cn("mt-1.5 text-2xl font-black tabular-nums", tile.tone)}>
              {typeof tile.value === "number" ? tile.value.toLocaleString() : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, username yoki email bo’yicha qidirish"
            aria-label="Foydalanuvchilarni qidirish"
            className="h-11 rounded-xl pl-9 text-[14px]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          aria-pressed={onlineOnly}
          onClick={() => {
            setLoading(true);
            setPage(1);
            setOnlineOnly((v) => !v);
          }}
          className={cn(
            "h-11 rounded-xl gap-2 font-bold",
            onlineOnly && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Faqat online
        </Button>
      </div>

      {/* List */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {error ? (
          <div className="px-4 py-16 text-center">
            <ShieldAlert className="w-10 h-10 text-destructive opacity-70 mx-auto mb-3" />
            <p className="font-bold">{error}</p>
          </div>
        ) : loading && !data ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-secondary animate-pulse" />
                  <div className="h-2.5 w-56 rounded bg-secondary/70 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <UsersRound className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-bold">Foydalanuvchi topilmadi</p>
            <p className="text-sm text-muted-foreground mt-1">
              {appliedQuery ? "Boshqa so’z bilan qidirib ko’ring." : "Hozircha akkauntlar yo’q."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {users.map((u) => {
              const online = isOnline(u.lastSeenAt);
              const roleMeta = ROLE_META[(u.role || "user").toLowerCase()] ?? ROLE_META.user;
              const name = u.displayName?.trim() || u.username;
              return (
                <li
                  key={u.id}
                  className="flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-secondary/20 md:flex-row md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-black text-muted-foreground">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {online && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
                          aria-label="Online"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[14px] font-bold">{name}</p>
                        {u.emailVerified && (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Email tasdiqlangan" />
                        )}
                      </div>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        @{u.username} · {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:gap-4">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                        roleMeta.className
                      )}
                    >
                      {roleMeta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold tabular-nums text-amber-500 md:w-[74px]">
                      <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                      {u.credits.toLocaleString()}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground md:w-[86px]" title="Ro’yxatdan o’tgan sana">
                      {formatDate(u.createdAt)}
                    </span>
                    <span
                      className={cn(
                        "text-[11.5px] md:w-[104px]",
                        online ? "font-bold text-emerald-500" : "text-muted-foreground"
                      )}
                      title="Oxirgi faollik"
                    >
                      {formatSeen(u.lastSeenAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">
              {Math.min((page - 1) * data.pageSize + 1, data.total)}–
              {Math.min(page * data.pageSize, data.total)} / {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg gap-1"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                <ChevronLeft className="h-4 w-4" /> Oldingi
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg gap-1"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => p + 1);
                }}
              >
                Keyingi <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
