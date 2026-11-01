"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useAppStore } from "./store";
import { GiftRevealOverlay, type GiftCardRecord } from "./gift-card";

const SEEN_KEY = "dubanix:gift-seen";
const POLL_MS = 8_000;

/**
 * Plays the sender's prize animation for the recipient as well, on any page.
 * A per-user watermark in localStorage keeps each gift to exactly one reveal and
 * never replays gifts that arrived before this device last checked.
 */
export function IncomingGiftReveal() {
  const { t } = useI18n();
  const userId = useAppStore((state) => state.user?.id ?? null);
  const navigate = useAppStore((state) => state.navigate);
  const openGiftDetail = useAppStore((state) => state.openGiftDetail);
  const [gift, setGift] = useState<GiftCardRecord | null>(null);
  const showing = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const key = `${SEEN_KEY}:${userId}`;
    let cancelled = false;

    const read = () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    };
    const write = (value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Private mode: reveals simply replay from the last known point.
      }
    };

    async function check() {
      if (showing.current || document.visibilityState !== "visible") return;
      const since = read();
      try {
        const response = await fetch(
          since ? `/api/gifts/incoming?since=${encodeURIComponent(since)}` : "/api/gifts/incoming",
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const data = (await response.json()) as { gift?: GiftCardRecord | null; now?: string };
        if (cancelled) return;
        if (!since) {
          if (data.now) write(data.now);
          return;
        }
        const incoming = data.gift;
        if (!incoming) return;
        const arrivedAt = Date.parse(incoming.createdAt);
        if (Number.isFinite(arrivedAt)) write(new Date(arrivedAt + 1_000).toISOString());
        showing.current = true;
        setGift(incoming);
      } catch {
        // Silent: the next tick retries.
      }
    }

    const timer = window.setInterval(() => void check(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    void check();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  if (!gift) return null;

  const close = () => {
    showing.current = false;
    setGift(null);
  };

  const openDetail = () => {
    const giftId = gift.id;
    close();
    openGiftDetail(giftId);
    navigate("gifts");
  };

  return (
    <GiftRevealOverlay
      gift={gift}
      caption={t("gifts.revealCaption", { username: gift.sender?.username ?? "" })}
      actionLabel={t("gifts.revealCta")}
      onAction={openDetail}
      onClose={close}
    />
  );
}
