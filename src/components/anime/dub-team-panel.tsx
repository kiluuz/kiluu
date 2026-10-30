"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic2, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "./store";
import { SmartImage } from "./ui-bits";
import { toast } from "sonner";
import {
  DUB_LANGUAGES,
  DUB_LANGUAGE_LABELS,
  DUB_ROLES,
  DUB_ROLE_LABELS,
  dubTeamTitle,
  type DubRole,
} from "@/lib/dub-team-shared";

interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  reputation: number;
  verified: boolean;
  status: string;
  animeCount: number;
  _count: { members: number; credits: number };
}

interface TeamDetail extends Omit<TeamSummary, "_count" | "animeCount"> {
  title: { label: string; color: string };
  rating: number | null;
  ratingCount: number;
  members: { id: string; name: string; role: string; userId: string | null }[];
  credits: {
    id: string;
    language: string;
    speakerCount: number;
    createdAt: string;
    anime: { id: string; slug: string; title: string; coverImage: string | null };
    cast: { id: string; speakerName: string; character: string }[];
    rating: number | null;
    ratingCount: number;
  }[];
}

interface DubTeamPanelProps {
  animes: { id: string; title: string }[];
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${response.status})`);
  return data as Record<string, unknown>;
}

export function DubTeamPanel({ animes }: DubTeamPanelProps) {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  const [teamName, setTeamName] = useState("");
  const [teamAbout, setTeamAbout] = useState("");
  const [creating, setCreating] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<DubRole>("voice");
  const [addingMember, setAddingMember] = useState(false);

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAnimeId, setCreditAnimeId] = useState("");
  const [creditLanguage, setCreditLanguage] = useState<string>("uz");
  const [castRows, setCastRows] = useState<{ name: string; character: string }[]>([{ name: "", character: "" }]);
  const [savingCredit, setSavingCredit] = useState(false);
  const [removingCreditId, setRemovingCreditId] = useState<string | null>(null);

  const mineQuery = useQuery({
    queryKey: ["dub-teams", "mine", user?.id ?? "anonymous"],
    queryFn: async () => {
      const data = await api("/api/dub-teams?mine=1");
      return (data.teams as TeamSummary[] | undefined) ?? [];
    },
    enabled: Boolean(user && user.role === "CREATOR"),
    staleTime: 60_000,
    retry: false,
  });

  const team = mineQuery.data?.[0] ?? null;

  const detailQuery = useQuery({
    queryKey: ["dub-teams", "detail", team?.id ?? "none"],
    queryFn: async () => {
      const data = await api(`/api/dub-teams/${team?.id}`);
      return data.team as TeamDetail;
    },
    enabled: Boolean(team?.id),
    staleTime: 30_000,
    retry: false,
  });

  const detail = detailQuery.data ?? null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["dub-teams"] });
  }

  async function createTeam() {
    if (teamName.trim().length < 2) {
      toast.error("Jamoa nomi kamida 2 belgidan iborat bo‘lsin");
      return;
    }
    setCreating(true);
    try {
      await api("/api/dub-teams", {
        method: "POST",
        body: JSON.stringify({ name: teamName.trim(), description: teamAbout.trim() || null }),
      });
      setTeamName("");
      setTeamAbout("");
      toast.success("Dub jamoasi yaratildi");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Jamoa yaratilmadi");
    } finally {
      setCreating(false);
    }
  }

  async function addMember() {
    if (!team) return;
    if (memberName.trim().length < 2) {
      toast.error("A’zo nomini kiriting");
      return;
    }
    setAddingMember(true);
    try {
      await api(`/api/dub-teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ name: memberName.trim(), role: memberRole }),
      });
      setMemberName("");
      toast.success("A’zo qo‘shildi");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A’zo qo‘shilmadi");
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!team) return;
    try {
      await api(`/api/dub-teams/${team.id}/members?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
      toast.success("A’zo olib tashlandi");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A’zo olib tashlanmadi");
    }
  }

  function openCreditDialog() {
    setCreditAnimeId("");
    setCreditLanguage("uz");
    setCastRows([{ name: "", character: "" }]);
    setCreditOpen(true);
  }

  function updateCastRow(index: number, patch: Partial<{ name: string; character: string }>) {
    setCastRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function saveCredit() {
    if (!team) return;
    if (!creditAnimeId) {
      toast.error("Anime tanlang");
      return;
    }
    const cast = castRows
      .map((row) => ({ name: row.name.trim(), character: row.character.trim() }))
      .filter((row) => row.name && row.character);
    if (cast.length === 0) {
      toast.error("Kamida bitta speaker va personaj kiriting");
      return;
    }
    setSavingCredit(true);
    try {
      await api(`/api/dub-teams/${team.id}/credits`, {
        method: "POST",
        body: JSON.stringify({ animeId: creditAnimeId, language: creditLanguage, cast }),
      });
      toast.success("Dub biriktirildi");
      setCreditOpen(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dub biriktirilmadi");
    } finally {
      setSavingCredit(false);
    }
  }

  async function removeCredit(creditId: string) {
    if (!team) return;
    setRemovingCreditId(creditId);
    try {
      await api(`/api/dub-teams/${team.id}/credits?creditId=${encodeURIComponent(creditId)}`, { method: "DELETE" });
      toast.success("Dub olib tashlandi");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dub olib tashlanmadi");
    } finally {
      setRemovingCreditId(null);
    }
  }

  if (!user || user.role !== "CREATOR") return null;

  const title = dubTeamTitle(detail?.reputation ?? team?.reputation ?? 0, detail?.verified ?? team?.verified ?? false);

  return (
    <section className="glass rounded-2xl p-5 sm:p-6 mb-7 border border-primary/20">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mic2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold">Dub jamoasi — Cast & Reputation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Jamoa a’zolarini qo‘shing va qaysi animega qaysi speaker ovoz berganini biriktiring. Speaker
            soni va jamoa obro‘si gift kartochkalarining rare darajasiga ta’sir qiladi.
          </p>
        </div>
      </div>

      {mineQuery.isPending ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dub team...
        </div>
      ) : mineQuery.isError ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
          Dub jamoasi ma’lumotlari hozircha mavjud emas. Database migratsiyasi qo‘llanilgach qayta urinib ko‘ring.
        </p>
      ) : !team ? (
        <div className="rounded-xl border border-dashed p-4 space-y-3">
          <p className="font-semibold text-sm">Hali jamoangiz yo‘q</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Jamoa nomi *</Label>
              <Input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                maxLength={60}
                placeholder="Masalan: Anor Dub Studio"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tavsif</Label>
              <Input
                value={teamAbout}
                onChange={(event) => setTeamAbout(event.target.value)}
                maxLength={200}
                placeholder="Qisqa tavsif"
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={createTeam}
            disabled={creating}
            className="rounded-xl brand-gradient text-white font-bold"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Jamoa yaratish
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-lg">{detail?.name ?? team.name}</p>
              <span
                className="text-[11px] font-bold rounded-full px-2.5 py-0.5 border"
                style={{ color: title.color, borderColor: `${title.color}55`, backgroundColor: `${title.color}14` }}
              >
                {title.label}
              </span>
              {(detail?.verified ?? team.verified) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <ShieldCheck className="w-3.5 h-3.5" /> Tasdiqlangan
                </span>
              )}
            </div>
            {(detail?.description ?? team.description) && (
              <p className="text-sm text-muted-foreground mt-1">{detail?.description ?? team.description}</p>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Jamoa obro‘si</span>
                <span className="font-bold tabular-nums">{detail?.reputation ?? team.reputation} / 100</span>
              </div>
              <Progress value={detail?.reputation ?? team.reputation} className="h-2" />
              <p className="text-[11px] text-muted-foreground mt-2">
                {detail && detail.ratingCount > 0
                  ? `Tomoshabin bahosi: ${detail.rating ?? "—"} / 10 (${detail.ratingCount} ta baho) · ${detail.credits.length} ta dub`
                  : `${team._count.members} a’zo · ${team._count.credits} ta dub · baholar hali yo‘q`}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm">Jamoa a’zolari</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(detail?.members ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Hali a’zo qo‘shilmagan</p>
              ) : (
                detail?.members.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs"
                  >
                    <span className="font-semibold">{member.name}</span>
                    <span className="text-muted-foreground">
                      {DUB_ROLE_LABELS[member.role as DubRole] ?? member.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      aria-label={`Remove ${member.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                maxLength={60}
                placeholder="Ovoz aktyori ismi"
                className="h-9 rounded-xl sm:max-w-[220px]"
              />
              <Select value={memberRole} onValueChange={(value) => setMemberRole(value as DubRole)}>
                <SelectTrigger className="h-9 rounded-xl sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUB_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {DUB_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addMember}
                disabled={addingMember}
                className="rounded-xl font-bold"
              >
                {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                A’zo qo‘shish
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-primary" />
                <p className="font-bold text-sm">Dub biriktirilgan animelar</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={openCreditDialog}
                className="rounded-full brand-gradient text-white font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> Dub qo‘shish
              </Button>
            </div>
            {(detail?.credits ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Hali dub biriktirilmagan. Har bir anime uchun speakerlar va personajlarni kiriting.
              </p>
            ) : (
              <div className="space-y-2">
                {detail?.credits.map((credit) => (
                  <div
                    key={credit.id}
                    className="flex items-start gap-3 rounded-xl border bg-card/40 p-3"
                  >
                    <div className="w-10 aspect-[2/3] rounded-md overflow-hidden shrink-0 bg-muted">
                      <SmartImage
                        src={credit.anime.coverImage ?? undefined}
                        alt={credit.anime.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{credit.anime.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {DUB_LANGUAGE_LABELS[credit.language] ?? credit.language} · {credit.speakerCount} speaker
                        {credit.ratingCount > 0 ? ` · ${credit.rating} / 10 (${credit.ratingCount})` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {credit.cast.map((row) => `${row.speakerName} — ${row.character}`).join(", ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCredit(credit.id)}
                      disabled={removingCreditId === credit.id}
                      aria-label={`Remove dub for ${credit.anime.title}`}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      {removingCreditId === credit.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={creditOpen} onOpenChange={(open) => !savingCredit && setCreditOpen(open)}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto fancy-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-primary" /> Dub biriktirish
            </DialogTitle>
            <DialogDescription>Anime, til va speakerlarni tanlang</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Anime *</Label>
                <Select value={creditAnimeId} onValueChange={setCreditAnimeId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Anime tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {animes.map((anime) => (
                      <SelectItem key={anime.id} value={anime.id}>
                        {anime.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Til</Label>
                <Select value={creditLanguage} onValueChange={setCreditLanguage}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DUB_LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language}>
                        {DUB_LANGUAGE_LABELS[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Speakerlar va personajlar *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCastRows((rows) => [...rows, { name: "", character: "" }])}
                  className="h-7 rounded-full text-[11px]"
                >
                  <Plus className="w-3 h-3" /> Speaker
                </Button>
              </div>
              {(detail?.members ?? []).length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Jamoadan tez tanlash:{" "}
                  {detail?.members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="underline decoration-dotted mr-1.5 hover:text-foreground"
                      onClick={() =>
                        setCastRows((rows) => {
                          const empty = rows.findIndex((row) => !row.name && !row.character);
                          if (empty >= 0) {
                            return rows.map((row, i) => (i === empty ? { ...row, name: member.name } : row));
                          }
                          return [...rows, { name: member.name, character: "" }];
                        })
                      }
                    >
                      {member.name}
                    </button>
                  ))}
                </p>
              )}
              {castRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={row.name}
                    onChange={(event) => updateCastRow(index, { name: event.target.value })}
                    maxLength={60}
                    placeholder="Speaker ismi"
                    className="h-9 rounded-xl flex-1"
                  />
                  <Input
                    value={row.character}
                    onChange={(event) => updateCastRow(index, { character: event.target.value })}
                    maxLength={60}
                    placeholder="Personaj"
                    className="h-9 rounded-xl flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setCastRows((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))}
                    disabled={castRows.length === 1}
                    aria-label="Remove speaker row"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={saveCredit}
              disabled={savingCredit}
              className="w-full rounded-xl brand-gradient text-white font-bold"
            >
              {savingCredit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
              Saqlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
