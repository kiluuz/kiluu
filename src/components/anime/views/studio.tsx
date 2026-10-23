"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Film, Users, Heart, Package, Link2, Trophy, Sparkles, Trash2,
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
import type { AnimeSummary } from "../types";
import { SmartImage, formatCredits } from "../ui-bits";
import { COVER_BANNER_PRESETS } from "../profile-assets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TelegramLinkWidget } from "../bot-ui";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Sci-Fi", "Romance",
  "Thriller", "Supernatural", "Mystery", "Sports", "Slice of Life", "Horror", "Psychological",
];

interface CreatorAnime extends AnimeSummary {
  purchaseCount: number;
  favoriteCount: number;
  moderationStatus?: string;
  hidden?: boolean;
}

export function StudioView() {
  const { user, setAuthOpen, navigate } = useAppStore();
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
  const [publishing, setPublishing] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);

  const handleAutoFetch = async () => {
    if (!title.trim()) {
      toast.error("Enter an anime title first (for example: Black Clover)");
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
        toast.success("Anime artwork and details imported! ✨");
      } else {
        toast.error("No information found. Check the title and try again.");
      }
    } catch {
      toast.error("Automatic import failed");
    } finally {
      setAutoFetching(false);
    }
  };

  // episode dialog
  const [epOpen, setEpOpen] = useState(false);
  const [epAnime, setEpAnime] = useState<CreatorAnime | null>(null);
  const [epTitle, setEpTitle] = useState("");
  const [epDesc, setEpDesc] = useState("");
  const [epDuration, setEpDuration] = useState("600");
  const [epSaving, setEpSaving] = useState(false);

  const fetchCreatorAnimes = useCallback(async (): Promise<CreatorAnime[]> => {
    const response = await fetch("/api/creator");
    if (!response.ok) throw new Error(`Studio request failed (${response.status})`);
    const data: { animes?: CreatorAnime[] } = await response.json();
    return data.animes ?? [];
  }, []);
  const creatorAnimeQueryKey = ["creator-animes", user?.id ?? "anonymous"] as const;

  const {
    data: animes = [],
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

  useEffect(() => {
    if (studioError) {
      console.error("Failed to load creator studio", studioError);
      toast.error("Failed to load studio");
    }
  }, [studioError]);

  if (!user) {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">🎬</p>
        <h1 className="text-2xl font-black mb-2">Creator Studio</h1>
        <p className="text-muted-foreground text-sm mb-6">Sign in with a Creator account to publish animes</p>
        <Button className="rounded-full brand-gradient text-white font-bold h-11 px-6" onClick={() => setAuthOpen(true)}>
          Sign in
        </Button>
      </div>
    );
  }

  if (user.role !== "CREATOR") {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">🎥</p>
        <h1 className="text-2xl font-black mb-2">Creator access required</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
          Your account is a Viewer account. You chose your role at sign-up — creators get the Studio, viewers get the shows!
        </p>
        <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => navigate("home")}>
          Back to watching
        </Button>
      </div>
    );
  }

  const totalPurchases = animes.reduce((a, x) => a + x.purchaseCount, 0);
  const totalFavorites = animes.reduce((a, x) => a + x.favoriteCount, 0);

  async function publish() {
    if (title.trim().length < 2) {
      toast.error("Title must be at least 2 characters");
      return;
    }
    if (description.trim().length < 20) {
      toast.error("Description must be at least 20 characters");
      return;
    }
    if (!coverImage.trim()) {
      toast.error("Add a cover image");
      return;
    }
    if (genres.length === 0) {
      toast.error("Choose at least one genre");
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch("/api/creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, altTitle, description, coverImage,
          genres, year, studio, status, type,
          isFree, price: isFree ? 0 : price,
          releaseDate: status === "UPCOMING" && releaseDate ? releaseDate : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error);
        return;
      }
      toast.success(`"${d.anime.title}" is live! 🎉`, {
        description: "Add episodes to complete your release.",
      });
      setPubOpen(false);
      setTitle(""); setAltTitle(""); setDescription(""); setCoverImage(""); setGenres([]); setStudio(""); setReleaseDate("");
      await queryClient.invalidateQueries({ queryKey: creatorAnimeQueryKey });
    } catch {
      toast.error("Network error");
    } finally {
      setPublishing(false);
    }
  }

  async function addEpisode() {
    if (!epAnime || !epTitle.trim()) {
      toast.error("Episode title is required");
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
        toast.error(d.error);
        return;
      }
      if (d.hlsKey) {
        toast.success(`Episode ${d.episode.number} created`, {
          description: `Upload your stream folder under ${d.hlsKey.replace(/\/index\.m3u8$/, "")}`,
          duration: 12000,
        });
      } else {
        toast.success(`Episode ${d.episode.number} added to "${epAnime.title}"!`);
      }
      setEpOpen(false);
      setEpTitle(""); setEpDesc("");
      await queryClient.invalidateQueries({ queryKey: creatorAnimeQueryKey });
    } finally {
      setEpSaving(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">Creator Studio</h1>
      <div className="flex items-start justify-end gap-4 flex-wrap mb-6">
        <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => setPubOpen(true)}>
          <Plus className="w-4 h-4" /> Publish Anime
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Film className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-black tabular-nums">{animes.length}</p>
          <p className="text-xs text-muted-foreground">Published animes</p>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Package className="w-5 h-5 text-cyan-400 mb-2" />
          <p className="text-2xl font-black tabular-nums">{formatCredits(totalPurchases)}</p>
          <p className="text-xs text-muted-foreground">Total purchases</p>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Heart className="w-5 h-5 text-rose-400 mb-2" />
          <p className="text-2xl font-black tabular-nums">{formatCredits(totalFavorites)}</p>
          <p className="text-xs text-muted-foreground">Total favorites</p>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <Trophy className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-black tabular-nums">
            {formatCredits(animes.reduce((a, x) => a + x.purchaseCount * (x.price || 0), 0))}
          </p>
          <p className="text-xs text-muted-foreground">Credits earned</p>
        </div>
      </div>

      <section className="glass rounded-2xl p-5 sm:p-6 mb-7 border border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold">Creator bot — My Animes va upload</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Link your Telegram account first. Send <code>/upload_anime</code> to the bot for the
              exact format, then send the anime poster as a photo with that format in its caption.
            </p>
          </div>
        </div>
        {telegramLinked ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2 text-sm">
            <p className="font-semibold text-emerald-500">Telegram account connected</p>
            <p className="text-muted-foreground">
              First send <code>/upload_anime</code>, then send a poster photo with the requested
              metadata as its caption. After the bot confirms the anime and gives you its slug, send
              each episode video separately with a caption like{" "}
              <code>#my-anime 1-qism — Episode title</code>. Use <code>/my_animes</code> to check uploads.
            </p>
            <p className="text-xs text-muted-foreground">
              The bot must be configured with access to the private media channel. Uploads stay hidden
              until moderator approval. Telegram episode delivery uses the bot; Watch Together playback
              additionally needs a web video stream uploaded to media storage.
            </p>
          </div>
        ) : (
          <TelegramLinkWidget onLinked={() => user && setLinkedUserId(user.id)} />
        )}
      </section>

      {/* My animes */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading studio...
        </div>
      ) : animes.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-12 text-center aurora relative overflow-hidden">
          <div className="relative">
            <p className="text-5xl mb-3">🎞️</p>
            <p className="font-bold text-lg">Nothing published yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Your first release is one click away — fans are waiting
            </p>
            <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => setPubOpen(true)}>
              <Sparkles className="w-4 h-4" /> Create your first anime
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {animes.map((a) => (
            <div key={a.id} className="glass rounded-2xl p-3.5 flex items-center gap-4 flex-wrap sm:flex-nowrap fade-in-up">
              <button
                className="w-16 sm:w-14 aspect-[2/3] rounded-lg overflow-hidden shrink-0"
                onClick={() => navigate("detail", { animeId: a.slug })}
                aria-label={`View ${a.title}`}
              >
                <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
              </button>
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-sm truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {a.year} · {a.type} · {a.status} · {a.isFree ? "Free" : `${a.price} credits`}
                </p>
                {a.moderationStatus && a.moderationStatus !== "APPROVED" && (
                  <p className="text-[11px] text-amber-500 mt-1">
                    Moderation: {a.moderationStatus.toLowerCase()}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Film className="w-3 h-3" /> {a.episodeCount} eps</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {a.purchaseCount} buyers</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {a.favoriteCount}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full font-bold shrink-0"
                onClick={() => {
                  setEpAnime(a);
                  setEpOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Episode
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full shrink-0"
                onClick={() => navigate("detail", { animeId: a.slug })}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ============ PUBLISH DIALOG ============ */}
      <Dialog open={pubOpen} onOpenChange={(o) => !publishing && setPubOpen(o)}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto fancy-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Publish New Anime
            </DialogTitle>
            <DialogDescription>Release it to the Kiluu catalog</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Auto-fill banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 gap-3">
              <div className="text-xs">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Auto-fill from Google / AniList
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Enter a title and click the button to fetch its poster, banner, genres, and description
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAutoFetch}
                disabled={autoFetching || !title.trim()}
                className="shrink-0 rounded-xl gap-1.5 text-xs h-8 brand-gradient text-white border-0 shadow-md shadow-primary/20 font-bold"
              >
                {autoFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Avto-olish
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Title * <span className="text-muted-foreground font-normal">(min 2 characters)</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Chronicles of the Star Realm" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Alternative title</Label>
                <Input value={altTitle} onChange={(e) => setAltTitle(e.target.value)} maxLength={80} placeholder="Hoshi no Sekai" className="h-10 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description * <span className="text-muted-foreground font-normal">(min 20 chars)</span></Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} placeholder="Epic synopsis that hooks viewers instantly..." className="rounded-xl min-h-24" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cover image URL *</Label>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." className="pl-9 h-10 rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                {COVER_BANNER_PRESETS.slice(0, 12).map((c) => (
                  <button
                    key={c.url}
                    onClick={() => setCoverImage(c.url)}
                    className={cn(
                      "aspect-[2/3] rounded-md overflow-hidden border-2 transition",
                      coverImage === c.url ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    title={c.title}
                    aria-label={`Use ${c.title} cover`}
                  >
                    { }
                    <img src={c.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Genres * <span className="text-muted-foreground font-normal">({genres.length} selected)</span></Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {GENRES.map((g) => (
                  <button
                    key={g}
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
                <Label className="text-xs font-semibold">Year</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TV">TV</SelectItem>
                    <SelectItem value="MOVIE">Movie</SelectItem>
                    <SelectItem value="OVA">OVA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONGOING">Ongoing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Studio</Label>
                <Input value={studio} onChange={(e) => setStudio(e.target.value)} maxLength={40} placeholder="Optional" className="h-10 rounded-xl" />
              </div>
              {status === "UPCOMING" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">📅 Release date</Label>
                  <Input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">Shown to users. A reminder is sent when it is released.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3.5">
              <div>
                <p className="text-sm font-semibold">Free to watch</p>
                <p className="text-[11px] text-muted-foreground">Everyone can stream it — great for growing your audience</p>
              </div>
              <Switch checked={isFree} onCheckedChange={setIsFree} aria-label="Free anime" />
            </div>

            {!isFree && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Price in credits <span className="text-muted-foreground font-normal">(min 10)</span></Label>
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
              {publishing ? "Publishing…" : "Publish to Kiluu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ EPISODE DIALOG ============ */}
      <Dialog open={epOpen} onOpenChange={(o) => !epSaving && setEpOpen(o)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Episode</DialogTitle>
            <DialogDescription>
              {epAnime && <>to <span className="font-bold text-foreground">{epAnime.title}</span></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Episode title *</Label>
              <Input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} maxLength={80} placeholder="The Beginning of Everything" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea value={epDesc} onChange={(e) => setEpDesc(e.target.value)} maxLength={400} placeholder="What happens in this episode..." className="rounded-xl min-h-16" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Watch Together playback</Label>
              <p className="text-[11px] text-muted-foreground">
                Send the episode video through Telegram bot first. Convert a copy for web video streaming, then upload it under the path shown after creating this episode.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Duration (seconds)</Label>
              <Input value={epDuration} onChange={(e) => setEpDuration(e.target.value.replace(/\D/g, "").slice(0, 5))} className="h-10 rounded-xl w-32" inputMode="numeric" />
            </div>
            <Button disabled={epSaving} onClick={addEpisode} className="w-full h-11 rounded-xl brand-gradient text-white font-bold">
              {epSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Episode
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
