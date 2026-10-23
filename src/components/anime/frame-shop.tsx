"use client";

import { useEffect, useState } from "react";
import { Check, Coins, Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "./store";
import { toast } from "sonner";
import { frameById, type FrameType } from "../../../frames.config";
import { cn } from "@/lib/utils";

interface FrameCardData {
  id: string;
  type: FrameType;
  slug: string;
  name: string;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  version: number;
  rarity: string;
  priceCredits: number | null;
  acquisition: string;
  missionKey: string | null;
  isOwned: boolean;
  isEquipped: boolean;
  safe: { left: number; right: number; top: number; bottom: number };
  textAlign: "left" | "center" | "right";
  maxFontPx: number;
  minFontPx: number;
  textColor: string | null;
}

interface FrameResponse {
  frames: FrameCardData[];
  equipped: { avatar: string | null; name: string | null };
}

interface FrameCatalogResponse {
  frames: Omit<FrameCardData, "isOwned" | "isEquipped">[];
}

interface FrameOwnershipResponse {
  ownedIds: string[];
  equipped: { avatar: string | null; name: string | null };
}

let catalogPromise: Promise<FrameCatalogResponse> | null = null;
let ownershipPromise: Promise<FrameOwnershipResponse> | null = null;
let framesPromise: Promise<FrameResponse> | null = null;

const MISSION_REQUIREMENTS: Record<string, string> = {
  "frame-easy": "Watch 3 episodes and publish your first post",
  "frame-medium": "Watch 25 episodes, reach 10 followers, and publish 10 posts",
  "frame-hard": "Watch 100 episodes, reach 50 followers, join 5 Watch Together rooms, and keep a 30-day streak",
};

async function loadFrames(): Promise<FrameResponse> {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/frames/catalog")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Couldn't load frame catalog");
        return data as FrameCatalogResponse;
      })
      .catch((error: unknown) => {
        catalogPromise = null;
        throw error;
      });
  }
  if (!ownershipPromise) {
    ownershipPromise = fetch("/api/frames", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Couldn't load owned frames");
        return data as FrameOwnershipResponse;
      })
      .catch((error: unknown) => {
        ownershipPromise = null;
        throw error;
      });
  }
  if (!framesPromise) {
    framesPromise = Promise.all([catalogPromise, ownershipPromise]).then(([catalog, ownership]) => {
      const owned = new Set(ownership.ownedIds);
      return {
        frames: catalog.frames.map((frame) => ({
          ...frame,
          isOwned: owned.has(frame.id),
          isEquipped: frame.type === "avatar"
            ? ownership.equipped.avatar === frame.id
            : ownership.equipped.name === frame.id,
        })),
        equipped: ownership.equipped,
      };
    }).catch((error: unknown) => {
      framesPromise = null;
      throw error;
    });
  }
  return framesPromise;
}

function refreshOwnership() {
  ownershipPromise = null;
  framesPromise = null;
}

function FramePreview({ frame, className }: { frame: FrameCardData; className?: string }) {
  if (frame.type === "avatar") {
    const config = frameById(frame.id);
    return (
      <div className={cn("relative mx-auto flex aspect-square w-24 items-center justify-center overflow-visible p-[8%]", className)}>
        <div aria-hidden="true" className="absolute inset-[27%] rounded-full bg-muted/80" />
        <img
          src={`/frames/${frame.slug}.v${frame.version}.webp`}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          style={{ transform: `scale(${Math.min(1, 0.84 / (config?.scale ?? 1.3)) * (config?.scale ?? 1.3)})` }}
        />
      </div>
    );
  }
  const config = frameById(frame.id);
  if (!frame.imageWidth || !frame.imageHeight) return null;
  const safe = frame.safe;
  const aspect = frame.imageWidth / frame.imageHeight;
  const previewHeight = 40;
  return (
    <div
      className={cn("mx-auto flex min-h-[64px] w-full items-center justify-center overflow-visible py-2", className)}
    >
      <span
        className="relative inline-block max-w-full shrink"
        style={{ width: `min(${previewHeight * aspect}px, 100%)`, aspectRatio: `${frame.imageWidth} / ${frame.imageHeight}` }}
      >
      <img
        src={`/frames/${frame.slug}.v${frame.version}.webp`}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
      <span
        className="absolute z-[1] flex min-w-0 items-center overflow-hidden text-[9px] font-bold leading-none"
        style={{
          left: `${safe.left}%`,
          right: `${safe.right}%`,
          top: `${safe.top}%`,
          bottom: `${safe.bottom}%`,
          justifyContent: frame.textAlign === "left" ? "flex-start" : frame.textAlign === "right" ? "flex-end" : "center",
          textAlign: frame.textAlign,
          color: frame.textColor ?? config?.textColor,
        }}
      >
        <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">Marlon</span>
      </span>
      </span>
    </div>
  );
}

function FrameCard({
  frame,
  action,
  busy,
  isSelected,
  canUnequip = false,
}: {
  frame: FrameCardData;
  action: () => void;
  busy: boolean;
  isSelected: boolean;
  canUnequip?: boolean;
}) {
  return (
    <article className={cn(
      "flex min-w-0 flex-col overflow-visible rounded-2xl border bg-card/60 p-3 transition",
      isSelected ? "border-primary shadow-md shadow-primary/10" : "hover:border-primary/50",
    )}>
      <FramePreview frame={frame} className="mb-2" />
      <h3 className="truncate text-xs font-bold" title={frame.name}>{frame.name}</h3>
      <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">{frame.rarity}</p>
      <div className="mt-2 min-h-10 flex-1">
        {frame.isOwned ? (
          <Button
            size="sm"
            variant={isSelected ? "secondary" : "outline"}
            className="h-8 w-full rounded-lg px-2 text-[10px]"
            disabled={busy || (isSelected && !canUnequip)}
            onClick={action}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : isSelected ? <Check className="h-3 w-3" /> : null}
            {isSelected ? canUnequip ? "Unequip" : "Equipped" : "Equip"}
          </Button>
        ) : frame.missionKey ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-[9px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-primary"><Sparkles className="h-3 w-3" /> Mission reward</span>
            <span>{MISSION_REQUIREMENTS[frame.missionKey] ?? "Complete the mission"}</span>
          </div>
        ) : frame.priceCredits !== null ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full rounded-lg px-2 text-[10px]"
            disabled={busy}
            onClick={action}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : frame.priceCredits === 0 ? "Free" : <><Coins className="h-3 w-3 text-amber-500" />{frame.priceCredits}</>}
          </Button>
        ) : (
          <div className="flex h-8 items-center justify-center gap-1 text-[10px] text-muted-foreground"><Lock className="h-3 w-3" /> Unavailable</div>
        )}
      </div>
    </article>
  );
}

export function FramePicker({
  type,
  selectedId,
  onSelect,
}: {
  type: FrameType;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { user, updateUser } = useAppStore();
  const [data, setData] = useState<FrameResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadFrames().then((result) => { if (active) setData(result); }).catch((error: unknown) => {
      if (active) toast.error(error instanceof Error ? error.message : "Couldn't load frames");
    });
    return () => { active = false; };
  }, []);

  async function select(frame: FrameCardData) {
    if (!user) return;
    setBusyId(frame.id);
    try {
      if (!frame.isOwned) {
        const response = await fetch("/api/frames/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: frame.slug }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Purchase failed");
        updateUser({ credits: result.credits });
        toast.success(`Unlocked ${frame.name}`);
      }
      onSelect(frame.id);
      refreshOwnership();
      setData(await loadFrames());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Frame action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const frames = data.frames.filter((frame) => frame.type === type);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn("rounded-full border px-3 py-1 text-[10px] font-bold", selectedId ? "border-border text-muted-foreground" : "border-primary bg-primary/10 text-primary")}
        >
          None
        </button>
        {frames.map((frame) => (
          <div key={frame.id} className="w-[calc(50%-4px)] overflow-visible py-2 sm:w-[calc(33.333%-6px)]">
            <FrameCard
              frame={frame}
              action={() => void select(frame)}
              busy={busyId === frame.id}
              isSelected={selectedId === frame.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FramesShop() {
  const { user, updateUser } = useAppStore();
  const [data, setData] = useState<FrameResponse | null>(null);
  const [type, setType] = useState<FrameType>("avatar");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadFrames().then((result) => { if (active) setData(result); }).catch((error: unknown) => {
      if (active) toast.error(error instanceof Error ? error.message : "Couldn't load frames");
    });
    return () => { active = false; };
  }, []);

  async function act(frame: FrameCardData) {
    if (!user) return;
    setBusyId(frame.id);
    try {
      if (!frame.isOwned) {
        const response = await fetch("/api/frames/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: frame.slug }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Purchase failed");
        updateUser({ credits: result.credits });
        toast.success(`Unlocked ${frame.name}`);
      } else {
        const equipped = frame.isEquipped ? null : frame.id;
        const response = await fetch("/api/frames/equip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, frameId: equipped }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Couldn't equip frame");
        updateUser({
          equippedAvatarFrameId: result.equipped.equippedAvatarFrameId,
          equippedNameFrameId: result.equipped.equippedNameFrameId,
        });
        toast.success(equipped ? `Equipped ${frame.name}` : `Unequipped ${frame.name}`);
      }
      refreshOwnership();
      setData(await loadFrames());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Frame action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return (
    <section className="space-y-5">
      <div className="flex gap-2">
        {(["avatar", "name"] as const).map((item) => (
          <Button key={item} variant={type === item ? "default" : "outline"} className="rounded-full capitalize" onClick={() => setType(item)}>
            {item === "avatar" ? "Avatar Frames" : "Name Frames"}
          </Button>
        ))}
        <div className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
          <Coins className="h-3.5 w-3.5 text-amber-500" />
          {(user?.credits ?? 0).toLocaleString()} credits
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.frames.filter((frame) => frame.type === type).map((frame) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            action={() => void act(frame)}
            busy={busyId === frame.id}
            isSelected={frame.isEquipped}
            canUnequip
          />
        ))}
      </div>
    </section>
  );
}
