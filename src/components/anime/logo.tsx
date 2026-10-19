"use client";

import { useId, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./logo.css";

/* ============ KILUU LOGO — waveform mark ============
 * 64x64 viewBox, rounded square rx 17, orange gradient #ff4d1c -> #ffa23a.
 * 5 white rounded vertical bars forming a "D" made of a sound waveform
 * (flat left side, curved fading right side). 吹替 (fukikae) = "dubbing".
 */

const BAR_H = [34, 34, 32, 26, 14] as const;
const BAR_X = [14, 23, 32, 41, 50] as const;
const BAR_O = [1, 1, 0.95, 0.8, 0.6] as const;
const WORDMARK = "Kiluu";

export type LogoState = "idle" | "playing" | "intro";

export interface LogoProps {
  /** full lockup (mark + wordmark) or mark only */
  variant?: "full" | "mark";
  /** dark | light | mono — omit to follow the app theme */
  theme?: "dark" | "light" | "mono";
  /** mark height in px (wordmark scales proportionally) */
  size?: number;
  /** idle equalizer on/off */
  animated?: boolean;
  /** idle | playing | intro (intro auto-advances to idle after ~1.2s) */
  state?: LogoState;
  /** show 吹替 · "Voice it your way" under the lockup (landing/footer only) */
  tagline?: boolean;
  className?: string;
  style?: CSSProperties;
  href?: string;
  onClick?: () => void;
  "aria-label"?: string;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** SSR-safe reactive prefers-reduced-motion (no setState-in-effect) */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false
  );
}

export function Logo({
  variant = "full",
  theme,
  size = 36,
  animated = true,
  state = "idle",
  tagline = false,
  className,
  style,
  href,
  onClick,
  "aria-label": ariaLabel = "Kiluu",
}: LogoProps) {
  const rawId = useId();
  const gid = `dbxg${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  /* internal state mirrors the prop, but intro self-advances to idle.
     Adjust-during-render keeps it in sync without effects. */
  const [autoState, setAutoState] = useState<LogoState>(state);
  const [prevPropState, setPrevPropState] = useState<LogoState>(state);
  if (state !== prevPropState) {
    setPrevPropState(state);
    setAutoState(state);
  }

  /* intro -> idle automatically (total intro ≤ 1.2s) */
  useEffect(() => {
    if (autoState !== "intro") return;
    const t = setTimeout(() => setAutoState("idle"), 1200);
    return () => clearTimeout(t);
  }, [autoState]);

  /* playing: randomized live audio meter (transform-only, cheap) */
  useEffect(() => {
    if (autoState !== "playing" || reducedMotion) return;
    const root = rootRef.current;
    if (!root) return;
    const bars = Array.from(root.querySelectorAll<SVGRectElement>(".dbx-bar"));
    if (!bars.length) return;
    const iv = setInterval(() => {
      for (const b of bars) {
        b.style.transform = `scaleY(${(0.25 + Math.random() * 0.75).toFixed(3)})`;
      }
    }, 170);
    return () => {
      clearInterval(iv);
      for (const b of bars) b.style.transform = ""; /* return to idle smoothly */
    };
  }, [autoState, reducedMotion]);

  /* pause animations when tab hidden or offscreen */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const setPaused = (v: boolean) => root.setAttribute("data-dbx-paused", v ? "1" : "0");
    const onVis = () => setPaused(document.hidden);
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting));
    io.observe(root);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const effState = reducedMotion ? "idle" : autoState;
  const mono = theme === "mono";

  const mark = (
    <span className="dbx-mk" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" focusable="false">
        <defs>
          {/* useId() differs between server/client in React 19.2 dev SSR —
              suppress the harmless id/fill warning (React keeps server ids,
              which are internally consistent, so the gradient still renders) */}
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1" suppressHydrationWarning>
            <stop offset="0" stopColor="#ff4d1c" />
            <stop offset="1" stopColor="#ffa23a" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="17" fill={mono ? "#fff" : `url(#${gid})`} suppressHydrationWarning />
        <g className={animated ? "dbx-bars" : undefined}>
          {BAR_H.map((h, i) => (
            <rect
              key={i}
              className="dbx-bar"
              x={BAR_X[i]}
              y={32 - h / 2}
              width="6.5"
              height={h}
              rx="3.25"
              fill={mono ? "#ff4d1c" : "#fff"}
              opacity={BAR_O[i]}
              style={{ "--dbx-bi": i, "--dbx-eqd": `${i * 0.15}s` } as CSSProperties}
            />
          ))}
        </g>
      </svg>
    </span>
  );

  const lockupInner = (
    <>
      {mark}
      {variant === "full" && (
        <span className="dbx-wm">
          <b aria-hidden="true">
            {WORDMARK.split("").map((ch, i) => (
              <span key={i} className="dbx-ltr" style={{ "--dbx-li": i } as CSSProperties}>
                {ch}
              </span>
            ))}
          </b>
        </span>
      )}
    </>
  );

  const content = (
    <>
      <span className="dbx-lock" data-theme={theme} data-state={effState}>
        {lockupInner}
      </span>
      {tagline && (
        <span className="dbx-tag" aria-hidden="true">
          <span className="dbx-tag-ja" lang="ja">
            吹替
          </span>
          <span className="dbx-tag-en">Voice it your way</span>
        </span>
      )}
    </>
  );

  const shared = {
    className: cn("dbx-root", className),
    style: { "--dbx-s": `${size}px`, ...style } as CSSProperties,
    "aria-label": ariaLabel,
    ...({ role: href || onClick ? undefined : "img" } as Record<string, unknown>),
  };

  if (href) {
    return (
      <a ref={rootRef as unknown as React.RefObject<HTMLAnchorElement>} href={href} onClick={onClick} {...shared}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button ref={rootRef as unknown as React.RefObject<HTMLButtonElement>} type="button" onClick={onClick} {...shared}>
        {content}
      </button>
    );
  }
  return (
    <span ref={rootRef} {...shared}>
      {content}
    </span>
  );
}
