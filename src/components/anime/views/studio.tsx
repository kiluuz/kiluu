"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Film, Users, Heart, Package, Link2, Trophy, Sparkles, Trash2,
  Mic2, Copy, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "../logo";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "../store";
import { useI18n } from "@/components/i18n-provider";
import type { AnimeSummary } from "../types";
import { SmartImage, formatCredits } from "../ui-bits";
import { COVER_BANNER_PRESETS } from "../profile-assets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TelegramLinkWidget } from "../bot-ui";
import { DubTeamPanel } from "../dub-team-panel";
import { DUB_LANGUAGES, dubErrorText, type DubLanguage } from "@/lib/dub-team-shared";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Sci-Fi", "Romance",
  "Thriller", "Supernatural", "Mystery", "Sports", "Slice of Life", "Horror", "Psychological",
];

const MIN_TEAM_MEMBERS = 3;

interface CreatorAnime extends AnimeSummary {
  purchaseCount: number;
  favoriteCount: number;
  moderationStatus?: string;
  hidden?: boolean;
  dubTeam?: { id: string; name: string; memberCount: number; reputation: number; verified: boolean } | null;
  dubCredits?: { language: string; speakerCount: number }[];
}

interface MyDubTeam {
  id: string;
  name: string;
  status: string;
  reputation: number;
  verified: boolean;
  linkedMemberCount: number;
  _count: { members: number; credits: number };
}

interface CastRow {
  name: string;
  character: string;
}

const EMPTY_CAST: CastRow[] = [{ name: "", character: "" }];

export function StudioView() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const { locale, t } = useI18n();
  const queryClient = useQueryClient();
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const telegramLinked = Boolean(user?.telegramLinked) || linkedUserId === user?.id;

  // publish dialog state
  const [pubOpen, setPubOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [altTitle, setAltTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [studio, setStudio] = useState("");
  const [status, setStatus] = useState("ONGOING");
  const [type, setType] = useState("TV");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("100");
  const [releaseDate, setReleaseDate] = useState("");
  const [dubTeamId, setDubTeamId] = useState("");
  const [dubLanguage, setDubLanguage] = useState<DubLanguage>("uz");
  const [castRows, setCastRows] = useState<CastRow[]>(EMPTY_CAST);
  const [publishing, setPublishing] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);

  // episode dialog
  const [epOpen, setEpOpen] = useState(false);
  const [epAnime, setEpAnime] = useState<CreatorAnime | null>(null);
  const [epTitle, setEpTitle] = useState("");
  const [epDesc, setEpDesc] = useState("");
  const [epDuration, setEpDuration] = useState("600");
  const [epSaving, setEpSaving] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CreatorAnime | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchCreatorAnimes = useCallback(async (): Promise<{ animes: CreatorAnime[]; earnings: number }> => {
    const response = await fetch("/api/creator");
    if (!response.ok) throw new Error(`Studio request failed (${response.status})`);
    const data: { animes?: CreatorAnime[]; earnings?: number } = await response.json();
    return { animes: data.animes ?? [], earnings: data.earnings ?? 0 };
  }, []);
  const creatorAnimeQueryKey = ["creator-animes", user?.id ?? "anonymous"] as const;

  const {
    data: studioData,
    isPending: loading,
    error: studioError,
  } = useQuery({
    queryKey: creatorAnimeQueryKey,
    queryFn: fetchCreatorAnimes,
    enabled: Boolean(user && user.role === "CREATOR"),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
  const animes = studioData?.animes ?? [];
  const earnings = studioData?.earnings ?? 0;

  const teamsQuery = useQuery({
    queryKey: ["dub-teams", "mine", user?.id ?? "anonymous"],
    queryFn: async () => {
      const response = await fetch("/api/dub-teams?mine=1");
      if (!response.ok) throw new Error(`Team request failed (${response.status})`);
      const data: { teams?: MyDubTeam[] } = await response.json();
      return data.teams ?? [];
    },
    enabled: Boolean(user && user.role === "CREATOR"),
    staleTime: 60_000,
    retry: false,
  });

  const eligibleTeams = (teamsQuery.data ?? []).filter(
    (team) => team.status === "active" && team.linkedMemberCount >= MIN_TEAM_MEMBERS
  );
  const activeDubTeamId = eligibleTeams.some((team) => team.id === dubTeamId)
    ? dubTeamId
    : eligibleTeams[0]?.id ?? "";

  useEffect(() => {
    if (studioError) {
      console.error("Failed to load creator studio", studioError);
      toast.error(t("studio.loadError"));
    }
  }, [studioError, t]);

  if (!user) {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">🎬</p>
        <h1 className="text-2xl font-black mb-2">{t("studio.title")}</h1>
        <p className="text-muted-foreground text-sm mb-6">{t("studio.signedOutHint")}</p>
        <Button className="rounded-full brand-gradient text-white font-bold h-11 px-6" onClick={() => setAuthOpen(true)}>
          {t("studio.signIn")}
        </Button>
      </div>
    );
  }

  if (user.role !== "CREATOR") {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">🎥</p>
        <h1 className="text-2xl font-black mb-2">{t("studio.creatorOnly")}</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">{t("studio.creatorOnlyHint")}</p>
        <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => navigate("home")}>
          {t("studio.backToWatching")}
        </Button>
      </div>
    );
  }

  const totalPurchases = animes.reduce((a, x) => a + x.purchaseCount, 0);
  const totalFavorites = animes.reduce((a, x) => a + x.favoriteCount, 0);

  const openPublish = () => {
    setDubLanguage(
      (DUB_LANGUAGES as readonly string[]).includes(locale) ? (locale as DubLanguage) : "uz"
    );
    setPubOpen(true);
  };

  const handleAutoFetch = async () => {
    if (!title.trim()) {
      toast.error(t("studio.autofillNeedTitle"));
      return;
    }
    setAutoFetching(true);
    try {
      const res = await fetch(`/api/animes/auto-fetch?q=${encodeURIComponent(title.trim())}`);
      const data = await res.json();
      if (data.ok && data.anime) {
        const a = data.anime;
        if (a.title && (!title || title.length < 3)) setTitle(a.title);
        if (a.altTitle) setAltTitle(a.altTitle);
        if (a.description) setDescription(a.description);
        if (a.coverImage) setCoverImage(a.coverImage);
        if (a.genres && a.genres.length > 0) setGenres(a.genres);
        if (a.year) setYear(String(a.year));
        if (a.type) setType(a.type);
        if (a.status) setStatus(a.status);
        toast.success(t("studio.autofillOk"));
      } else {
        toast.error(t("studio.autofillEmpty"));
      }
    } catch {
      toast.error(t("studio.autofillFail"));
    } finally {
      setAutoFetching(false);
    }
  };

  async function publish() {
    if (title.trim().length < 2) {
      toast.error(t("studio.errTitle"));
      return;
    }
    if (description.trim().length < 20) {
      toast.error(t("studio.errDescription"));
      return;
    }
    const cover = coverImage.trim();
    if (!/^https?:\/\//i.test(cover) && !cover.startsWith("/uploads/")) {
      toast.error(t("studio.errCover"));
      return;
    }
    if (genres.length === 0) {
      toast.error(t("studio.errGenres"));
      return;
    }
    if (!activeDubTeamId) {
      toast.error(t("studio.errTeam"));
      return;
    }
    const cast = castRows
      .map((row) => ({ name: row.name.trim(), character: row.character.trim(), role: "voice" }))
      .filter((row) => row.name && row.character);
    if (cast.length === 0) {
      toast.error(t("studio.errSpeakers"));
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch("/api/creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, altTitle, description, coverImage: cover,
          genres, year, studio, status, type,
          isFree, price: isFree ? 0 : price,
          releaseDate: status === "UPCOMING" && releaseDate ? releaseDate : null,
          dubTeamId: activeDubTeamId,
          dubLanguage,
          dubCast: cast,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(dubErrorText(t, d.code, d.error || t("studio.publishFailed")));
        return;
      }
      toast.success(t("studio.publishedOk", { title: d.anime.title }), {
        description: t("studio.publishedDesc"),
        duration: 9000,
      });
      setPubOpen(false);
      setTitle(""); setAltTitle(""); setDescription(""); setCoverImage(""); setGenres([]);
      setStudio(""); setReleaseDate(""); setCastRows(EMPTY_CAST);
      await queryClient.invalidateQueries({ queryKey: creatorAnimeQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["dub-teams", "mine", user?.id ?? "anonymous"] });
    } catch {
      toast.error(t("studio.networkError"));
    } finally {
      setPublishing(false);
    }
  }

  async function addEpisode() {
    if (!epAnime || !epTitle.trim()) {
      toast.error(t("studio.errEpisodeTitle"));
      return;
    }
    setEpSaving(true);
    try {
      const res = await fetch("/api/creator/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: epAnime.id,
          title: epTitle,
          description: epDesc,
          useR2Hls: true,
          duration: epDuration,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(dubErrorText(t, d.code, d.error || t("studio.networkError")));
        return;
      }
      if (d.hlsKey) {
        toast.success(t("studio.episodeCreated", { number: d.episode.number }), {
          description: t("studio.episodeCreatedDesc", { path: d.hlsKey.replace(/\/index\.m3u8$/, "") }),
          duration: 12000,
        });
      } else {
        toast.success(t("studio.episodeAdded", { title: epAnime.title, number: d.episode.number }));
      }
      setEpOpen(false);
      setEpTitle(""); setEpDesc("");
      await queryClient.invalidateQueries({ queryKey: creatorAnimeQueryKey });
    } finally {
      setEpSaving(false);
    }
  }

  async function deleteAnime() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/animes/${deleteTarget.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(dubErrorText(t, d.code, d.error || t("studio.deleteFailed")));
        return;
      }
      toast.success(t("studio.deletedOk", { title: deleteTarget.title }));
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: creatorAnimeQueryKey });
    } catch {
      toast.error(t("studio.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  async function copyCaption(anime: CreatorAnime) {
    const caption = `#${anime.slug} ${(anime.episodeCount ?? 0) + 1}-qism — ${anime.title}`;
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedSlug(anime.slug);
      window.setTimeout(() => setCopiedSlug((prev) => (prev === anime.slug ? null : prev)), 2000);
    } catch {
      toast.error(t("studio.networkError"));
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">{t("studio.title")}</h1>

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-lg font-black">{t("studio.title")}</p>
          <p className="text-xs text-muted-foreground">{t("studio.dialogDesc")}</p>
        </div>
        <Button className="rounded-full brand-gradient text-white font-bold" onClick={openPublish}>
          <Plus className="w-4 h-4" /> {t("studio.publishAnime")}
        </Button>
      </div>

      {/* Steps guide */}
      <section className="glass rounded-2xl p-5 sm:p-6 mb-6">
        <h2 className="font-bold mb-4">{t("studio.stepsTitle")}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: t("studio.step1Title"), body: t("studio.step1Body") },
            { title: t("studio.step2Title"), body: t("studio.step2Body") },
            { title: t("studio.step3Title"), body: t("studio.step3Body") },
          ].map((step) => (
            <div key={step.title} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-bold mb-1">{step.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-amber-500 mt-3">{t("studio.releaseNote")}</p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Film className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-black tabular-nums">{animes.length}</p>
          <p className="text-xs text-muted-foreground">{t("studio.statAnimes")}</p>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Package className="w-5 h-5 text-cyan-400 mb-2" />
          <p className="text-2xl font-black tabular-nums">{formatCredits(totalPurchases)}</p>
          <p className="text-xs text-muted-foreground">{t("studio.statPurchases")}</p>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Heart className="w-5 h-5 text-rose-400 mb-2" />
          <p className="text-2xl font-black tabular-nums">{formatCredits(totalFavorites)}</p>
          <p className="text-xs text-muted-foreground">{t("studio.statFavorites")}</p>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Trophy className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-black tabular-nums">{formatCredits(earnings)}</p>
          <p className="text-xs text-muted-foreground">{t("studio.statCredits")}</p>
        </div>
      </div>

      <DubTeamPanel />

      {/* Telegram upload */}
      <section className="glass rounded-2xl p-5 sm:p-6 my-7 border border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold">{t("studio.telegramTitle")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("studio.telegramConnect")}</p>
          </div>
        </div>
        {telegramLinked ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2 text-sm">
            <p className="font-semibold text-emerald-500">{t("studio.telegramLinked")}</p>
            <p className="text-muted-foreground">{t("studio.telegramHowto")}</p>
            <p className="text-xs text-muted-foreground">{t("studio.telegramHint")}</p>
          </div>
        ) : (
          <TelegramLinkWidget onLinked={() => user && setLinkedUserId(user.id)} />
        )}
      </section>

      {/* My animes */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("studio.loading")}
        </div>
      ) : animes.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-12 text-center aurora relative overflow-hidden">
          <div className="relative">
            <p className="text-5xl mb-3">🎞️</p>
            <p className="font-bold text-lg">{t("studio.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">{t("studio.emptyHint")}</p>
            <Button className="rounded-full brand-gradient text-white font-bold" onClick={openPublish}>
              <Sparkles className="w-4 h-4" /> {t("studio.emptyCta")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {animes.map((a) => {
            const caption = `#${a.slug} ${(a.episodeCount ?? 0) + 1}-qism — ${a.title}`;
            const isHidden = a.hidden === true || (a.moderationStatus ?? "") === "PENDING";
            const credits = a.dubCredits ?? [];
            return (
              <div key={a.id} className="glass rounded-2xl p-3.5 flex flex-col gap-3 fade-in-up">
                <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <button
                    className="w-16 sm:w-14 aspect-[2/3] rounded-lg overflow-hidden shrink-0"
                    onClick={() => navigate("detail", { animeId: a.slug })}
                    aria-label={a.title}
                  >
                    <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                  </button>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-bold text-sm truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.year} · {a.type} · {a.status} · {a.isFree ? t("studio.freeLabel") : `${a.price} 💰`}
                    </p>
                    {isHidden && (
                      <p className="text-[11px] text-amber-500 mt-1">{t("studio.hiddenUntilVideo")}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Film className="w-3 h-3" /> {t("studio.eps", { count: a.episodeCount ?? 0 })}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t("studio.buyers", { count: a.purchaseCount })}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {a.favoriteCount}</span>
                      {a.dubTeam && (
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <Users className="w-3 h-3" /> {a.dubTeam.name} · {t("dub.membersCount", { count: a.dubTeam.memberCount })}
                        </span>
                      )}
                      {credits.map((c) => (
                        <span key={c.language} className="flex items-center gap-1">
                          <Mic2 className="w-3 h-3" /> {t("studio.dubInfo", { language: t(`dub.lang.${c.language}`), count: c.speakerCount })}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full font-bold"
                      onClick={() => { setEpAnime(a); setEpOpen(true); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("studio.addEpisode")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => navigate("detail", { animeId: a.slug })}
                    >
                      {t("studio.viewAnime")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> <span className="sr-only">{t("studio.deleteAnime")}</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap rounded-xl border bg-secondary/30 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t("studio.slugLabel")}
                  </span>
                  <code className="text-[11px] font-mono">{a.slug}</code>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground ml-2">
                    {t("studio.captionLabel")}
                  </span>
                  <code className="text-[11px] font-mono break-all">{caption}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full h-7 ml-auto gap-1.5"
                    onClick={() => void copyCaption(a)}
                  >
                    {copiedSlug === a.slug ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">{copiedSlug === a.slug ? t("studio.copied") : t("studio.copy")}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ PUBLISH DIALOG ============ */}
      <Dialog open={pubOpen} onOpenChange={(o) => !publishing && setPubOpen(o)}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto fancy-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> {t("studio.dialogTitle")}
            </DialogTitle>
            <DialogDescription>{t("studio.dialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Auto-fill banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 gap-3">
              <div className="text-xs">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> {t("studio.autofillTitle")}
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">{t("studio.autofillHint")}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAutoFetch}
                disabled={autoFetching || !title.trim()}
                className="shrink-0 rounded-xl gap-1.5 text-xs h-8 brand-gradient text-white border-0 shadow-md shadow-primary/20 font-bold"
              >
                {autoFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {t("studio.autofillButton")}
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("studio.fTitle")} <span className="text-muted-foreground font-normal">{t("studio.fTitleHint")}</span>
                </Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Chronicles of the Star Realm" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("studio.fAltTitle")}</Label>
                <Input value={altTitle} onChange={(e) => setAltTitle(e.target.value)} maxLength={80} placeholder="Hoshi no Sekai" className="h-10 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("studio.fDescription")} <span className="text-muted-foreground font-normal">{t("studio.fDescriptionHint")}</span>
              </Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} placeholder="..." className="rounded-xl min-h-24" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("studio.fCover")}</Label>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." className="pl-9 h-10 rounded-xl text-xs" />
              </div>
              <p className="text-[10px] text-muted-foreground">{t("studio.fCoverHint")}</p>
              <div className="flex items-start gap-3">
                <div className="w-20 aspect-[2/3] rounded-xl overflow-hidden border shrink-0 bg-secondary/40">
                  {/^https?:\/\//i.test(coverImage.trim()) || coverImage.startsWith("/uploads/") ? (
                    <SmartImage src={coverImage.trim()} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="grid grid-cols-6 gap-1.5 flex-1">
                  {COVER_BANNER_PRESETS.slice(0, 12).map((c) => (
                    <button
                      key={c.url}
                      type="button"
                      onClick={() => setCoverImage(c.url)}
                      className={cn(
                        "aspect-[2/3] rounded-md overflow-hidden border-2 transition",
                        coverImage === c.url ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                      title={c.title}
                      aria-label={c.title}
                    >
                      <img src={c.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                {t("studio.fGenres")} <span className="text-muted-foreground font-normal">{t("studio.fGenresCount", { count: genres.length })}</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition",
                      genres.includes(g)
                        ? "brand-gradient text-white border-transparent"
                        : "text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("studio.fYear")}</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("studio.fType")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TV">{t("studio.typeTV")}</SelectItem>
                    <SelectItem value="MOVIE">{t("studio.typeMovie")}</SelectItem>
                    <SelectItem value="OVA">{t("studio.typeOVA")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("studio.fStatus")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONGOING">{t("studio.statusOngoing")}</SelectItem>
                    <SelectItem value="COMPLETED">{t("studio.statusCompleted")}</SelectItem>
                    <SelectItem value="UPCOMING">{t("studio.statusUpcoming")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("studio.fStudio")}</Label>
                <Input value={studio} onChange={(e) => setStudio(e.target.value)} maxLength={40} placeholder={t("studio.fOptional")} className="h-10 rounded-xl" />
              </div>
              {status === "UPCOMING" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("studio.fReleaseDate")}</Label>
                  <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="h-10 rounded-xl" />
                  <p className="text-[10px] text-muted-foreground">{t("studio.fReleaseDateHint")}</p>
                </div>
              )}
            </div>

            {/* Dub — one step with publish */}
            <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
              <div className="flex items-center gap-1.5">
                <Mic2 className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-bold">{t("dub.creditsTitle")}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("studio.dubTeamLabel")} <span className="text-muted-foreground font-normal">{t("studio.dubTeamHint")}</span>
                </Label>
                {eligibleTeams.length > 0 ? (
                  <Select value={activeDubTeamId} onValueChange={setDubTeamId} disabled={teamsQuery.isPending}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder={t("studio.dubTeamPick")} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} · {t("dub.membersCount", { count: team.linkedMemberCount })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("studio.dubTeamEmpty")}</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("studio.dubLanguageLabel")}</Label>
                  <Select value={dubLanguage} onValueChange={(v) => setDubLanguage(v as DubLanguage)}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DUB_LANGUAGES.map((lang) => (
                        <SelectItem key={lang} value={lang}>{t(`dub.lang.${lang}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("studio.dubCastTitle")}</Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{t("studio.dubCastHint")}</p>
                </div>
              </div>

              <div className="space-y-2">
                {castRows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={row.name}
                      onChange={(e) => setCastRows((prev) => prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))}
                      maxLength={40}
                      placeholder={t("studio.dubSpeakerName")}
                      className="h-9 rounded-xl flex-1 min-w-0"
                    />
                    <Input
                      value={row.character}
                      onChange={(e) => setCastRows((prev) => prev.map((r, i) => (i === index ? { ...r, character: e.target.value } : r)))}
                      maxLength={40}
                      placeholder={t("studio.dubCharacter")}
                      className="h-9 rounded-xl flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => setCastRows((prev) => (prev.length === 1 ? EMPTY_CAST : prev.filter((_, i) => i !== index)))}
                      className="shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center text-muted-foreground hover:text-destructive"
                      aria-label={t("studio.dubAddSpeaker")}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full h-8"
                  onClick={() => setCastRows((prev) => [...prev, { name: "", character: "" }])}
                >
                  <Plus className="w-3.5 h-3.5" /> {t("studio.dubAddSpeaker")}
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground">{t("studio.dubTeamFootNote")}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3.5">
              <div>
                <p className="text-sm font-semibold">{t("studio.freeLabel")}</p>
                <p className="text-[11px] text-muted-foreground">{t("studio.freeHint")}</p>
              </div>
              <Switch checked={isFree} onCheckedChange={setIsFree} aria-label={t("studio.freeLabel")} />
            </div>

            {!isFree && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("studio.priceLabel")} <span className="text-muted-foreground font-normal">{t("studio.priceHint", { min: 10 })}</span>
                </Label>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  className="h-10 rounded-xl w-32"
                  inputMode="numeric"
                />
              </div>
            )}

            <Button
              disabled={publishing}
              onClick={publish}
              className="w-full h-11 rounded-xl brand-gradient text-white font-bold"
            >
              {publishing ? <Logo variant="mark" theme="mono" size={20} state="playing" /> : <Sparkles className="w-4 h-4" />}
              {publishing ? t("studio.submitting") : t("studio.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ EPISODE DIALOG ============ */}
      <Dialog open={epOpen} onOpenChange={(o) => !epSaving && setEpOpen(o)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("studio.addEpisode")}</DialogTitle>
            <DialogDescription>{epAnime?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("studio.episodeTitleLabel")}</Label>
              <Input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} maxLength={80} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("studio.episodeDescLabel")}</Label>
              <Textarea value={epDesc} onChange={(e) => setEpDesc(e.target.value)} maxLength={400} className="rounded-xl min-h-16" />
            </div>
            {epAnime && (
              <div className="space-y-1.5 rounded-xl border bg-secondary/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("studio.captionLabel")}</p>
                <code className="text-[11px] font-mono break-all">
                  #{epAnime.slug} {(epAnime.episodeCount ?? 0) + 1}-qism — {epTitle.trim() || epAnime.title}
                </code>
                <p className="text-[11px] text-muted-foreground">{t("studio.episodeHint")}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("studio.episodeDurationLabel")}</Label>
              <Input value={epDuration} onChange={(e) => setEpDuration(e.target.value.replace(/\D/g, "").slice(0, 5))} className="h-10 rounded-xl w-32" inputMode="numeric" />
            </div>
            <Button disabled={epSaving} onClick={addEpisode} className="w-full h-11 rounded-xl brand-gradient text-white font-bold">
              {epSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("studio.episodeSave")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ DELETE CONFIRM ============ */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> {t("studio.deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("studio.deleteConfirmBody", { title: deleteTarget?.title ?? "" })}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl h-10" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              {t("studio.deleteConfirmCancel")}
            </Button>
            <Button
              className="flex-1 rounded-xl h-10 bg-destructive text-white font-bold hover:bg-destructive/90"
              disabled={deleting}
              onClick={deleteAnime}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("studio.deleteConfirmOk")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
