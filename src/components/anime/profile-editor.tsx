"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Upload, Loader2, Sparkles, Check, Eye, EyeOff, Lock, Trophy, Heart,
  Pencil, Image as ImageIcon, User, Palette, Shield, Layers, Star, Coins,
  GripVertical, ChevronUp, ChevronDown, Trash2, Wand2, Smile, Clapperboard,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "./store";
import type { PublicProfile, AnimeSummary, ShowcaseConfig, PrivacyConfig, SocialLinks } from "./types";
import { Avatar, SmartImage } from "./ui-bits";
import { BANNER_PRESETS, AVATAR_PRESETS, ACCENT_PRESETS, AVATAR_FRAMES, ACHIEVEMENTS } from "./profile-assets";
import { ProfilePageBody, getAchievementStates, userAccentVars } from "./profile";
import { ProfilePopupCard } from "./profile-card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ================================================================
   DRAFT STATE
   ================================================================ */
interface Draft {
  displayName: string;
  pronouns: string;
  tagline: string;
  bio: string;
  country: string;
  timezone: string;
  socialLinks: SocialLinks;
  statusEmoji: string;
  statusText: string;
  accentFrom: string;
  accentTo: string;
  avatarFrame: string;
  bannerUrl: string;
  bannerPreset: string;
  avatarUrl: string;
  showcase: ShowcaseConfig;
  privacy: PrivacyConfig;
  unlocked: string[];
}

const GENRE_OPTIONS = [
  "Action", "Adventure", "Fantasy", "Sci-Fi", "Drama", "Comedy", "Romance",
  "Horror", "Mystery", "Thriller", "Sports", "Slice of Life", "Mecha", "Supernatural",
];

function initialDraft(p: PublicProfile): Draft {
  return {
    displayName: p.displayName || "",
    pronouns: p.pronouns || "",
    tagline: p.tagline || "",
    bio: p.bio || "",
    country: p.country || "",
    timezone: p.timezone || "",
    socialLinks: (p.socialLinks ?? {}) as SocialLinks,
    statusEmoji: p.statusEmoji || "",
    statusText: p.statusText || "",
    accentFrom: p.accentColor,
    accentTo: p.accentTo || p.accentColor,
    avatarFrame: p.avatarFrame || "none",
    bannerUrl: p.bannerUrl || "",
    bannerPreset: "",
    avatarUrl: p.avatarUrl || "",
    showcase: {
      topFive: p.showcase?.topFive ?? [],
      pinnedPostId: p.showcase?.pinnedPostId ?? null,
      genres: p.showcase?.genres ?? [],
      achievementIds: p.showcase?.achievementIds ?? [],
      order: p.showcase?.order?.length ? p.showcase.order : ["topFive", "currentlyWatching", "favorites", "collection", "pinned", "achievements"],
      hidden: p.showcase?.hidden ?? {},
    },
    privacy: p.privacy ?? {
      showWatchTime: true, showFavorites: true, showActivity: true,
      allowFollows: true, profileVisibility: "everyone" as const,
    },
    unlocked: (p.showcase as unknown as { unlocked?: string[] })?.unlocked ?? [],
  };
}

/** Build a fake PublicProfile from draft + real stats for live preview */
function buildPreview(draft: Draft, base: PublicProfile): PublicProfile {
  return {
    ...base,
    displayName: draft.displayName || base.username,
    pronouns: draft.pronouns || null,
    tagline: draft.tagline || null,
    bio: draft.bio || null,
    country: draft.country || null,
    timezone: draft.timezone || null,
    socialLinks: draft.socialLinks as Record<string, string>,
    statusEmoji: draft.statusEmoji || null,
    statusText: draft.statusText || null,
    accentColor: draft.accentFrom,
    accentTo: draft.accentTo === draft.accentFrom ? null : draft.accentTo,
    avatarFrame: draft.avatarFrame === "none" ? null : draft.avatarFrame,
    bannerUrl: draft.bannerUrl,
    avatarUrl: draft.avatarUrl,
    showcase: draft.showcase,
  };
}

/* ================================================================
   DOMINANT COLOR — auto accent from banner
   ================================================================ */
async function extractDominantColor(src: string): Promise<{ from: string; to: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 40; c.height = 40;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;
        // hue buckets weighted by saturation*value
        const buckets: { w: number; r: number; g: number; b: number; n: number }[] = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0, n: 0 }));
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const v = max, s = max === 0 ? 0 : (max - min) / max;
          if (s < 0.25 || v < 0.15) continue;
          let h = 0;
          if (max === r) h = ((g - b) / (max - min)) * 60;
          else if (max === g) h = 60 * (2 + (b - r) / (max - min));
          else h = 60 * (4 + (r - g) / (max - min));
          if (h < 0) h += 360;
          const bi = Math.floor(h / 30) % 12;
          const w = s * v;
          buckets[bi].w += w; buckets[bi].n++;
          buckets[bi].r += r * 255; buckets[bi].g += g * 255; buckets[bi].b += b * 255;
        }
        const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
        if (best.n === 0) return resolve(null);
        const rgb = [best.r / best.n, best.g / best.n, best.b / best.n].map((v) => Math.round(v));
        const hex = (n: number) => n.toString(16).padStart(2, "0");
        const from = `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
        // "to" = darker shade
        const darker = rgb.map((v) => Math.round(v * 0.55));
        const to = `#${hex(darker[0])}${hex(darker[1])}${hex(darker[2])}`;
        resolve({ from, to });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ================================================================
   BANNER CROP MODAL — 3:1, drag pan, zoom, SAFE ZONES overlay
   ================================================================ */
function BannerCropModal({
  file,
  onClose,
  onApply,
  isGif,
  premiumUnlocked,
  onBuyPremium,
}: {
  file: File;
  onClose: () => void;
  onApply: (crop: { x: number; y: number; width: number; height: number }) => void;
  isGif: boolean;
  premiumUnlocked: boolean;
  onBuyPremium: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string>("");
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => { setNatW(img.naturalWidth); setNatH(img.naturalHeight); };
    img.src = url;
  }, [url]);

  const baseFit = natW && natH && containerRef.current
    ? Math.max(containerRef.current.offsetWidth / natW, (containerRef.current.offsetWidth / 3) / natH)
    : 1;
  const dispW = natW * baseFit * zoom;
  const dispH = natH * baseFit * zoom;

  function clampOffset(x: number, y: number) {
    if (!containerRef.current) return { x, y };
    const cw = containerRef.current.offsetWidth, ch = cw / 3;
    const maxX = Math.max(0, (dispW - cw) / 2);
    const maxY = Math.max(0, (dispH - ch) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setOffset(clampOffset(dragging.current.ox + dx, dragging.current.oy + dy));
  }
  function onPointerUp() { dragging.current = null; }

  function apply() {
    if (!containerRef.current || !natW) return;
    const cw = containerRef.current.offsetWidth, ch = cw / 3;
    const scale = baseFit * zoom;
    const imgLeft = cw / 2 - dispW / 2 + offset.x;
    const imgTop = ch / 2 - dispH / 2 + offset.y;
    const cropX = Math.max(0, Math.round(-imgLeft / scale));
    const cropY = Math.max(0, Math.round(-imgTop / scale));
    const cropW = Math.min(natW - cropX, Math.round(cw / scale));
    const cropH = Math.min(natH - cropY, Math.round(ch / scale));
    onApply({ x: cropX, y: cropY, width: cropW, height: cropH });
  }

  const animatedBlocked = isGif && !premiumUnlocked;

  return (
    <DialogContent className="max-w-3xl bg-card border-border p-0 overflow-hidden gap-0">
      <DialogHeader className="px-5 py-3.5 border-b bg-background/50">
        <DialogTitle className="text-base flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> Crop banner
        </DialogTitle>
        <DialogDescription className="text-xs">
          Drag to reposition · 3:1 ratio · the shaded zones show where your avatar, name and the popup-card crop will appear.
        </DialogDescription>
      </DialogHeader>

      <div className="p-5 space-y-4">
        {/* Crop viewport with SAFE ZONES */}
        <div
          ref={containerRef}
          className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden border-2 border-border bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url && (
            <img
              src={url}
              alt="Banner preview"
              className="absolute pointer-events-none max-w-none"
              style={{
                width: dispW, height: dispH,
                left: "50%", top: "50%",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
              draggable={false}
            />
          )}
          {/* SAFE ZONE: avatar + name (bottom-left of full-page banner) */}
          <div className="absolute left-[3%] bottom-0 w-[22%] h-[70%] border-2 border-dashed border-white/70 bg-black/25 backdrop-blur-[1px] rounded-t-2xl pointer-events-none">
            <span className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-bold text-white/90 uppercase tracking-wider">
              Avatar + Name
            </span>
          </div>
          {/* SAFE ZONE: popup card visible strip (center) */}
          <div className="absolute inset-x-[18%] top-[8%] bottom-[30%] border border-dashed border-amber-300/80 bg-amber-300/10 rounded-lg pointer-events-none">
            <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8.5px] font-bold text-amber-200/90 uppercase tracking-wider whitespace-nowrap">
              Popup card crop — keep subject here
            </span>
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-4 px-1">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={([v]) => { setZoom(v); setOffset((o) => clampOffset(o.x, o.y)); }}
            className="flex-1"
            aria-label="Zoom"
          />
          <span className="text-xs font-bold tabular-nums w-10 text-right">{zoom.toFixed(2)}×</span>
        </div>

        {animatedBlocked && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Animated banners are Premium</p>
              <p className="text-xs text-muted-foreground">GIF banners loop on your profile. Unlock once, use forever.</p>
            </div>
            <Button size="sm" className="rounded-full brand-gradient text-white shrink-0" onClick={onBuyPremium}>
              <Coins className="w-3.5 h-3.5" /> 500
            </Button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button
            onClick={apply}
            disabled={!natW || animatedBlocked}
            className="rounded-full brand-gradient text-white"
          >
            <Check className="w-4 h-4" /> Apply crop
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

/* ================================================================
   AVATAR CROP MODAL — circular
   ================================================================ */
function AvatarCropModal({
  file,
  onClose,
  onApply,
}: {
  file: File;
  onClose: () => void;
  onApply: (crop: { x: number; y: number; size: number }) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => { setNatW(img.naturalWidth); setNatH(img.naturalHeight); };
    img.src = url;
  }, [url]);

  const box = 320;
  const baseFit = natW && natH ? Math.max(box / natW, box / natH) : 1;
  const dispW = natW * baseFit * zoom;
  const dispH = natH * baseFit * zoom;

  function clampOffset(x: number, y: number) {
    const maxX = Math.max(0, (dispW - box) / 2);
    const maxY = Math.max(0, (dispH - box) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setOffset(clampOffset(dragging.current.ox + (e.clientX - dragging.current.x), dragging.current.oy + (e.clientY - dragging.current.y)));
  }
  function onPointerUp() { dragging.current = null; }

  function apply() {
    if (!natW) return;
    const scale = baseFit * zoom;
    const imgLeft = box / 2 - dispW / 2 + offset.x;
    const imgTop = box / 2 - dispH / 2 + offset.y;
    const cropX = Math.max(0, Math.round(-imgLeft / scale));
    const cropY = Math.max(0, Math.round(-imgTop / scale));
    const size = Math.min(natW - cropX, natH - cropY, Math.round(box / scale));
    onApply({ x: cropX, y: cropY, size });
  }

  return (
    <DialogContent className="max-w-md bg-card border-border p-0 overflow-hidden gap-0">
      <DialogHeader className="px-5 py-3.5 border-b bg-background/50">
        <DialogTitle className="text-base flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Crop avatar
        </DialogTitle>
        <DialogDescription className="text-xs">Drag to position · circular preview</DialogDescription>
      </DialogHeader>
      <div className="p-5 space-y-4">
        <div className="mx-auto" style={{ width: box, height: box }}>
          <div
            ref={boxRef}
            className="relative overflow-hidden rounded-full border-2 border-border bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: box, height: box }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {url && (
              <img
                src={url}
                alt="Avatar preview"
                className="absolute pointer-events-none max-w-none"
                style={{
                  width: dispW, height: dispH,
                  left: "50%", top: "50%",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
                draggable={false}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 px-1">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">Zoom</span>
          <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={([v]) => { setZoom(v); setOffset((o) => clampOffset(o.x, o.y)); }} className="flex-1" aria-label="Zoom" />
          <span className="text-xs font-bold tabular-nums w-10 text-right">{zoom.toFixed(2)}×</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button onClick={apply} disabled={!natW} className="rounded-full brand-gradient text-white">
            <Check className="w-4 h-4" /> Apply
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

/* ================================================================
   EDITOR SECTION SHELL
   ================================================================ */
function EditorSection({ icon, title, desc, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition text-left focus-ring-accent"
        aria-expanded={open}
      >
        <span className="w-8 h-8 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold">{title}</span>
          {desc && <span className="block text-[11px] text-muted-foreground truncate">{desc}</span>}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3.5">{children}</div>}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</Label>;
}

/* ================================================================
   PROFILE EDITOR — split panel with LIVE PREVIEW
   ================================================================ */
export function ProfileEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: PublicProfile;
  onClose: () => void;
  onSaved: (p: PublicProfile) => void;
}) {
  const updateUser = useAppStore((s) => s.updateUser);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initial));
  const [saving, setSaving] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [topFiveOpen, setTopFiveOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"page" | "card">("page");
  const fileBannerRef = useRef<HTMLInputElement>(null);
  const fileAvatarRef = useRef<HTMLInputElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraft(initial)),
    [draft, initial]
  );

  const preview = useMemo(() => buildPreview(draft, initial), [draft, initial]);
  const earnedStates = useMemo(() => getAchievementStates(initial).filter((a) => a.earned), [initial]);

  const premiumBannerUnlocked = draft.unlocked.includes("animatedBanner");

  /* ---------- handlers ---------- */

  async function unlockPremiumItem(item: string, price: number, label: string) {
    try {
      const res = await fetch("/api/profile/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, price }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setDraft((dr) => ({ ...dr, unlocked: [...dr.unlocked, item] }));
      updateUser({ credits: d.user.credits });
      toast.success(`${label} unlocked!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unlock");
    }
  }

  async function uploadBanner(crop: { x: number; y: number; width: number; height: number }) {
    if (!bannerFile) return;
    const fd = new FormData();
    fd.append("file", bannerFile);
    fd.append("crop", JSON.stringify(crop));
    fd.append("animatedAllowed", premiumBannerUnlocked ? "true" : "false");
    setSaving(true);
    try {
      const res = await fetch("/api/profile/banner", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      set("bannerUrl", d.banner.url);
      set("bannerPreset", "");
      setBannerFile(null);
      toast.success("Banner updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Banner upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(crop: { x: number; y: number; size: number }) {
    if (!avatarFile) return;
    const fd = new FormData();
    fd.append("file", avatarFile);
    fd.append("crop", JSON.stringify(crop));
    setSaving(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      set("avatarUrl", d.avatar.url);
      setAvatarFile(null);
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Avatar upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeBanner() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/banner", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      set("bannerUrl", "");
      set("bannerPreset", "");
      toast.success("Banner removed — accent gradient will show");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove banner");
    } finally {
      setSaving(false);
    }
  }

  async function applyPresetBanner(presetId: string, url: string) {
    setDraft((d) => ({ ...d, bannerPreset: presetId, bannerUrl: url }));
  }

  async function autoAccent() {
    if (!draft.bannerUrl) { toast.info("Upload a banner first — or pick a preset below."); return; }
    toast.promise(extractDominantColor(draft.bannerUrl), {
      loading: "Extracting colors...",
      success: (c) => {
        if (!c) return "Couldn't read colors from that image";
        setDraft((d) => ({ ...d, accentFrom: c.from, accentTo: c.to }));
        return "Accent synced with your banner";
      },
      error: "Extraction failed",
    });
  }

  function toggleTopFive(anime: AnimeSummary) {
    setDraft((d) => {
      const cur = d.showcase.topFive;
      if (cur.includes(anime.id)) {
        return { ...d, showcase: { ...d.showcase, topFive: cur.filter((x) => x !== anime.id) } };
      }
      if (cur.length >= 5) { toast.error("Top 5 is full — remove one first"); return d; }
      return { ...d, showcase: { ...d.showcase, topFive: [...cur, anime.id] } };
    });
  }

  function moveTopFive(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const arr = [...d.showcase.topFive];
      const i = arr.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, showcase: { ...d.showcase, topFive: arr } };
    });
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const arr = [...d.showcase.order];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...d, showcase: { ...d.showcase, order: arr } };
    });
  }

  const SECTION_LABELS: Record<string, string> = {
    topFive: "Top 5 Anime", currentlyWatching: "Now Watching", favorites: "Favorite Anime",
    collection: "Collection Highlights", pinned: "Pinned Post", achievements: "Achievements",
  };

  async function save() {
    setSaving(true);
    try {
      const payload = {
        displayName: draft.displayName,
        pronouns: draft.pronouns,
        tagline: draft.tagline,
        bio: draft.bio,
        country: draft.country,
        timezone: draft.timezone,
        socialLinks: JSON.stringify(draft.socialLinks),
        statusEmoji: draft.statusEmoji,
        statusText: draft.statusText,
        accentColor: draft.accentFrom,
        accentTo: draft.accentTo === draft.accentFrom ? "" : draft.accentTo,
        avatarFrame: draft.avatarFrame,
        bannerPreset: draft.bannerPreset,
        showcase: JSON.stringify({ ...draft.showcase, unlocked: draft.unlocked }),
        privacy: JSON.stringify(draft.privacy),
        avatarUrl: draft.avatarUrl,
        bannerUrl: draft.bannerPreset ? draft.bannerUrl : undefined,
      };
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      updateUser({
        displayName: d.user.displayName, bio: d.user.bio, accentColor: d.user.accentColor,
        accentTo: d.user.accentTo, avatarUrl: d.user.avatarUrl, bannerUrl: d.user.bannerUrl,
        pronouns: d.user.pronouns, tagline: d.user.tagline, statusEmoji: d.user.statusEmoji,
        statusText: d.user.statusText, avatarFrame: d.user.avatarFrame,
      });
      // refresh full profile data for the callback
      const pf = await fetch(`/api/users/${initial.username}`).then((r) => r.json());
      if (pf.profile) onSaved(pf.profile);
      toast.success("Profile saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  const pool = [...initial.ownedAnimes, ...initial.favoriteAnimes].filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i
  );

  /* ---------- render ---------- */
  return (
    <div className="fixed inset-0 z-[80] bg-background flex flex-col animate-in fade-in duration-200">
      {/* Top bar */}
      <div className="shrink-0 border-b glass-strong">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-4 sm:px-6 h-14">
          <Pencil className="w-4 h-4 text-primary" />
          <h2 className="font-bold">Edit Profile</h2>
          {dirty && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">Unsaved changes</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full" onClick={requestClose}>Discard</Button>
            <Button size="sm" className="rounded-full brand-gradient text-white" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {/* Split body */}
      <div className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[420px_1fr]">
        {/* LEFT — settings */}
        <div className="min-h-0 overflow-y-auto border-r p-4 space-y-3.5 pb-24 lg:pb-6 fancy-scroll">
          {/* BANNER */}
          <EditorSection icon={<ImageIcon className="w-4 h-4" />} title="Banner" desc="3:1 cinematic cover">
            <div className="rounded-2xl overflow-hidden border relative aspect-[3/1] grain"
              style={{ background: `linear-gradient(120deg, ${draft.accentFrom}, ${draft.accentTo})` }}>
              {draft.bannerUrl && <SmartImage src={draft.bannerUrl} alt="Banner" className="w-full h-full object-cover" />}
              <button
                onClick={() => fileBannerRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/45 opacity-0 hover:opacity-100 transition"
              >
                <Upload className="w-5 h-5 text-white" />
                <span className="text-xs font-bold text-white">Replace banner</span>
              </button>
            </div>
            <input
              ref={fileBannerRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setBannerFile(f); e.target.value = ""; }}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileBannerRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Upload
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={autoAccent}>
                <Wand2 className="w-3.5 h-3.5" /> Auto accent from banner
              </Button>
              {draft.bannerUrl && (
                <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={removeBanner}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              JPG · PNG · WebP up to 8 MB. GIF animates with <span className="font-bold text-amber-500">Premium</span>.
            </p>
            {/* Presets */}
            <div>
              <FieldLabel>Preset gallery</FieldLabel>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {BANNER_PRESETS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => applyPresetBanner(b.id, b.url)}
                    title={b.label}
                    className={cn(
                      "relative aspect-[3/1] rounded-lg overflow-hidden border-2 transition focus-ring-accent",
                      draft.bannerPreset === b.id ? "border-primary" : "border-transparent hover:border-border"
                    )}
                  >
                    <SmartImage src={b.url} alt={b.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </EditorSection>

          {/* AVATAR */}
          <EditorSection icon={<User className="w-4 h-4" />} title="Avatar" desc="Square crop, circular display">
            <div className="flex items-center gap-4">
              <Avatar src={draft.avatarUrl} name={draft.displayName || initial.username} accent={draft.accentFrom} accentTo={draft.accentTo} frame={draft.avatarFrame} size={72} />
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileAvatarRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Upload photo
                </Button>
                {draft.avatarUrl && (
                  <Button size="sm" variant="ghost" className="rounded-full text-destructive"
                    onClick={async () => {
                      await fetch("/api/profile/avatar", { method: "DELETE" }).catch(() => {});
                      set("avatarUrl", "");
                    }}>
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileAvatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setAvatarFile(f); e.target.value = ""; }}
            />
            {/* frames */}
            <div>
              <FieldLabel>Avatar frame</FieldLabel>
              <div className="grid grid-cols-5 gap-2 mt-1.5">
                {AVATAR_FRAMES.map((f) => {
                  const unlocked = f.price === 0 || draft.unlocked.includes(`frame:${f.id}`);
                  const selected = draft.avatarFrame === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (!unlocked) { unlockPremiumItem(`frame:${f.id}`, f.price, f.label); return; }
                        set("avatarFrame", f.id);
                      }}
                      className={cn(
                        "relative rounded-xl border p-1.5 flex flex-col items-center gap-1 transition focus-ring-accent",
                        selected ? "border-primary bg-primary/10" : "border-border hover:border-border/80"
                      )}
                      title={f.label}
                    >
                      <span className="w-9 h-9 rounded-full" style={{ padding: 3, background: f.css || "transparent" }}>
                        <span className="block w-full h-full rounded-full bg-muted" />
                      </span>
                      <span className="text-[8.5px] font-bold truncate w-full text-center">{f.label.split(" ")[0]}</span>
                      {!unlocked && (
                        <span className="absolute inset-0 rounded-xl bg-background/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-0.5">
                          <Lock className="w-3 h-3 text-amber-500" />
                          <span className="text-[8px] font-black text-amber-500 flex items-center gap-0.5"><Coins className="w-2.5 h-2.5" />{f.price}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* preset avatars */}
            <div>
              <FieldLabel>Or pick a preset</FieldLabel>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {AVATAR_PRESETS.map((u) => (
                  <button
                    key={u}
                    onClick={() => set("avatarUrl", u)}
                    className={cn(
                      "w-11 h-11 rounded-full overflow-hidden border-2 transition focus-ring-accent",
                      draft.avatarUrl === u ? "border-primary" : "border-transparent hover:border-border"
                    )}
                  >
                    <img src={u} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </EditorSection>

          {/* ACCENT */}
          <EditorSection icon={<Palette className="w-4 h-4" />} title="Accent color" desc="Your profile theme">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>From</FieldLabel>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={draft.accentFrom} onChange={(e) => set("accentFrom", e.target.value)}
                    className="w-10 h-10 rounded-xl border bg-card cursor-pointer" aria-label="Accent from color" />
                  <Input value={draft.accentFrom} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set("accentFrom", e.target.value)} className="font-mono text-xs h-10" />
                </div>
              </div>
              <div>
                <FieldLabel>To (gradient)</FieldLabel>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={draft.accentTo} onChange={(e) => set("accentTo", e.target.value)}
                    className="w-10 h-10 rounded-xl border bg-card cursor-pointer" aria-label="Accent to color" />
                  <Input value={draft.accentTo} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set("accentTo", e.target.value)} className="font-mono text-xs h-10" />
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>Presets</FieldLabel>
              <div className="grid grid-cols-5 gap-2 mt-1.5">
                {ACCENT_PRESETS.map((a) => {
                  const active = draft.accentFrom.toLowerCase() === a.from.toLowerCase();
                  return (
                    <button
                      key={a.label}
                      onClick={() => setDraft((d) => ({ ...d, accentFrom: a.from, accentTo: a.to }))}
                      title={a.label}
                      className={cn(
                        "h-9 rounded-xl border-2 transition focus-ring-accent",
                        active ? "border-foreground" : "border-transparent hover:scale-105"
                      )}
                      style={{ background: `linear-gradient(120deg, ${a.from}, ${a.to})` }}
                    />
                  );
                })}
              </div>
            </div>
          </EditorSection>

          {/* IDENTITY */}
          <EditorSection icon={<Sparkles className="w-4 h-4" />} title="Identity" desc="Name, pronouns, about, socials">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FieldLabel>Display name</FieldLabel>
                <Input value={draft.displayName} maxLength={32} onChange={(e) => set("displayName", e.target.value)} className="mt-1" placeholder="Sakura" />
              </div>
              <div>
                <FieldLabel>Pronouns</FieldLabel>
                <Input value={draft.pronouns} maxLength={24} onChange={(e) => set("pronouns", e.target.value)} className="mt-1" placeholder="she/her" />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <Input value={draft.country} maxLength={40} onChange={(e) => set("country", e.target.value)} className="mt-1" placeholder="Kazakhstan" />
              </div>
              <div className="col-span-2">
                <FieldLabel>Tagline</FieldLabel>
                <Input value={draft.tagline} maxLength={80} onChange={(e) => set("tagline", e.target.value)} className="mt-1" placeholder="Watch to escape, review to remember" />
              </div>
              <div className="col-span-2">
                <FieldLabel>About me <span className="normal-case tracking-normal text-muted-foreground/70">· **bold** *italic* `code` [link](url)</span></FieldLabel>
                <Textarea value={draft.bio} maxLength={500} rows={4} onChange={(e) => set("bio", e.target.value)} className="mt-1 resize-none" placeholder="Tell your story..." />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{draft.bio.length}/500</p>
              </div>
              <div>
                <FieldLabel>Timezone</FieldLabel>
                <Input value={draft.timezone} maxLength={64} onChange={(e) => set("timezone", e.target.value)} className="mt-1" placeholder="Asia/Tashkent" />
              </div>
            </div>
            <div>
              <FieldLabel>Social links</FieldLabel>
              <div className="space-y-2 mt-1">
                {(["telegram", "instagram", "youtube", "x"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-16 text-[11px] font-bold capitalize text-muted-foreground">{k === "x" ? "X" : k}</span>
                    <Input
                      value={draft.socialLinks[k] ?? ""}
                      onChange={(e) => set("socialLinks", { ...draft.socialLinks, [k]: e.target.value })}
                      placeholder={k === "telegram" ? "@username" : "username or URL"}
                      className="h-9 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </EditorSection>

          {/* STATUS */}
          <EditorSection icon={<Smile className="w-4 h-4" />} title="Custom status" desc="Shown under your name" defaultOpen={false}>
            <div className="flex gap-2">
              <Input value={draft.statusEmoji} onChange={(e) => set("statusEmoji", e.target.value)} className="w-16 text-center text-lg" placeholder="✨" maxLength={4} />
              <Input value={draft.statusText} maxLength={64} onChange={(e) => set("statusText", e.target.value)} placeholder="What's happening?" />
            </div>
            <p className="text-[11px] text-muted-foreground">Auto "Currently watching" takes priority while you have an episode in progress.</p>
          </EditorSection>

          {/* SHOWCASES */}
          <EditorSection icon={<Trophy className="w-4 h-4" />} title="Showcases" desc="Top 5, pinned, achievements">
            {/* Top 5 */}
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel>Top 5 anime</FieldLabel>
                <button onClick={() => setTopFiveOpen(true)} className="text-[11px] font-bold text-primary hover:underline">
                  {draft.showcase.topFive.length ? "Change" : "Pick"} ({draft.showcase.topFive.length}/5)
                </button>
              </div>
              {draft.showcase.topFive.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {draft.showcase.topFive.map((id, i) => {
                    const a = pool.find((x) => x.id === id);
                    if (!a) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-xl border bg-background/50 p-1.5">
                        <span className="rank-numeral text-2xl w-6 text-center">{i + 1}</span>
                        <img src={a.coverImage} alt="" className="w-8 h-11 object-cover rounded-md" />
                        <span className="flex-1 text-xs font-bold truncate">{a.title}</span>
                        <button onClick={() => moveTopFive(id, -1)} disabled={i === 0} className="p-1 rounded hover:bg-accent disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveTopFive(id, 1)} disabled={i === draft.showcase.topFive.length - 1} className="p-1 rounded hover:bg-accent disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggleTopFive(a)} className="p-1 rounded hover:bg-accent text-destructive" aria-label="Remove"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Genres */}
            <div>
              <FieldLabel>Favorite genres</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {GENRE_OPTIONS.map((g) => {
                  const active = draft.showcase.genres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => setDraft((d) => ({
                        ...d,
                        showcase: {
                          ...d.showcase,
                          genres: active ? d.showcase.genres.filter((x) => x !== g) : [...d.showcase.genres, g].slice(0, 8),
                        },
                      }))}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-bold border transition focus-ring-accent",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Achievements showcase */}
            {earnedStates.length > 0 && (
              <div>
                <FieldLabel>Achievements showcase <span className="normal-case">({draft.showcase.achievementIds.length}/6)</span></FieldLabel>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {earnedStates.map((a) => {
                    const active = draft.showcase.achievementIds.includes(a.def.id);
                    return (
                      <button
                        key={a.def.id}
                        onClick={() => setDraft((d) => ({
                          ...d,
                          showcase: {
                            ...d.showcase,
                            achievementIds: active
                              ? d.showcase.achievementIds.filter((x) => x !== a.def.id)
                              : d.showcase.achievementIds.length >= 6
                                ? (toast.error("Max 6 in showcase"), d.showcase.achievementIds)
                                : [...d.showcase.achievementIds, a.def.id],
                          },
                        }))}
                        className={cn(
                          "rounded-xl border p-2 text-center transition focus-ring-accent",
                          active ? "border-primary bg-primary/10" : "border-border opacity-70 hover:opacity-100"
                        )}
                        title={`${a.def.name} — ${a.def.desc}`}
                      >
                        <span className="text-lg">{a.def.emoji}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Pinned post */}
            {initial.posts.length > 0 && (
              <div>
                <FieldLabel>Pinned post</FieldLabel>
                <select
                  value={draft.showcase.pinnedPostId ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, showcase: { ...d.showcase, pinnedPostId: e.target.value || null } }))}
                  className="w-full mt-1 h-9 rounded-xl border bg-card px-3 text-xs focus-ring-accent"
                >
                  <option value="">None</option>
                  {initial.posts.map((p) => (
                    <option key={p.id} value={p.id}>{p.content.slice(0, 48)}{p.content.length > 48 ? "…" : ""}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Section order + visibility */}
            <div>
              <FieldLabel>Sections — order & visibility</FieldLabel>
              <div className="mt-1.5 space-y-1.5">
                {draft.showcase.order.map((sec, i) => (
                  <div key={sec} className="flex items-center gap-2 rounded-xl border bg-background/50 px-2 py-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground drag-handle" />
                    <span className="flex-1 text-xs font-semibold">{SECTION_LABELS[sec] ?? sec}</span>
                    <button
                      onClick={() => setDraft((d) => ({
                        ...d,
                        showcase: { ...d.showcase, hidden: { ...d.showcase.hidden, [sec]: !d.showcase.hidden[sec] } },
                      }))}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                      aria-label={draft.showcase.hidden[sec] ? "Show section" : "Hide section"}
                    >
                      {draft.showcase.hidden[sec] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-accent disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === draft.showcase.order.length - 1} className="p-1 rounded hover:bg-accent disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </EditorSection>

          {/* PRIVACY */}
          <EditorSection icon={<Shield className="w-4 h-4" />} title="Privacy" desc="Control what others see" defaultOpen={false}>
            {([
              ["showWatchTime", "Show watch time", "Display total hours watched on your profile"],
              ["showFavorites", "Show favorites", "Let others see your favorite anime list"],
              ["showActivity", "Show activity", "Show your posts on the profile page"],
              ["allowFollows", "Allow follows", "Let other users follow you"],
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border bg-background/50 p-3">
                <div>
                  <p className="text-xs font-bold">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{hint}</p>
                </div>
                <Switch
                  checked={draft.privacy[key]}
                  onCheckedChange={(v) => set("privacy", { ...draft.privacy, [key]: v })}
                  aria-label={label}
                />
              </div>
            ))}
          </EditorSection>
        </div>

        {/* RIGHT — LIVE PREVIEW */}
        <div className="min-h-0 overflow-y-auto bg-ink-2/50 fancy-scroll">
          <div className="sticky top-0 z-10 glass-strong border-b px-4 py-2 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mr-2">Live preview</span>
            <div className="flex rounded-full border bg-card p-0.5">
              {(["page", "card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPreviewMode(m)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold transition",
                    previewMode === m ? "brand-gradient text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "page" ? "Profile page" : "Popup card"}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 flex justify-center">
            {previewMode === "page" ? (
              <div
                className="origin-top w-[1280px] max-w-none"
                style={{ transform: "scale(0.58)", marginBottom: "-42%", height: "172%" }}
              >
                <ProfilePageBody profile={preview} hideTabs />
              </div>
            ) : (
              <div className="py-8">
                <ProfilePopupCard profile={preview} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Crop modals */}
      {bannerFile && (
        <Dialog open onOpenChange={(o) => !o && setBannerFile(null)}>
          <BannerCropModal
            file={bannerFile}
            onClose={() => setBannerFile(null)}
            onApply={uploadBanner}
            isGif={bannerFile.type === "image/gif"}
            premiumUnlocked={premiumBannerUnlocked}
            onBuyPremium={() => unlockPremiumItem("animatedBanner", 500, "Animated banners")}
          />
        </Dialog>
      )}
      {avatarFile && (
        <Dialog open onOpenChange={(o) => !o && setAvatarFile(null)}>
          <AvatarCropModal file={avatarFile} onClose={() => setAvatarFile(null)} onApply={uploadAvatar} />
        </Dialog>
      )}

      {/* Top 5 picker */}
      {topFiveOpen && (
        <Dialog open onOpenChange={(o) => !o && setTopFiveOpen(false)}>
          <DialogContent className="max-w-2xl bg-card">
            <DialogHeader>
              <DialogTitle>Pick your Top 5</DialogTitle>
              <DialogDescription>From your collection & favorites. Order matters — #1 is the biggest brag.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[55vh] overflow-y-auto fancy-scroll grid grid-cols-3 sm:grid-cols-4 gap-3 pt-1">
              {pool.map((a) => {
                const rank = draft.showcase.topFive.indexOf(a.id);
                const picked = rank >= 0;
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleTopFive(a)}
                    className={cn(
                      "group relative rounded-xl overflow-hidden border-2 transition focus-ring-accent",
                      picked ? "border-primary" : "border-transparent hover:border-border"
                    )}
                  >
                    <div className="aspect-[2/3]">
                      <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                    </div>
                    {picked && (
                      <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full brand-gradient text-white text-xs font-black flex items-center justify-center shadow-lg">
                        {rank + 1}
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-4 text-left">
                      <span className="block text-[10px] font-bold text-white truncate">{a.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <Button className="rounded-full brand-gradient text-white" onClick={() => setTopFiveOpen(false)}>
                <Check className="w-4 h-4" /> Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Discard guard */}
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>You have unsaved edits. Leaving now will throw them into the void.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" className="rounded-full" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="destructive" className="rounded-full" onClick={onClose}>Discard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
