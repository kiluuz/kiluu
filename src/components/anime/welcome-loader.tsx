"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import "./welcome-loader.css";

/* ============ DUBANIX WELCOME PRELOADER — exact port of the reference ============
 * Full-screen white overlay above everything; the word "Welcome" cycles through
 * 8 languages, each in its own typeface, with an orange -> violet -> teal
 * gradient. Letter-by-letter rise/fall (blur-to-sharp + 3D rotateX) for
 * Latin/Cyrillic; whole-word animation for Chinese, Arabic and Japanese.
 * A thin gradient progress line fills at the very bottom of the screen.
 *
 * Shown once per page load (sessionStorage flag, cleared on pagehide so a
 * hard refresh re-shows it, while in-app navigation never does).
 * Dismissed when the app is ready — but never before the first word has
 * finished animating in (min display ~1.2s).
 */

const WL_FLAG = "dubanix-welcome-shown";

interface WLLang {
  t: string;
  f: string;
  s: number;
  w?: number;
  whole?: number;
}

const WL_LANGS: WLLang[] = [
  { t: "Welcome", f: "var(--font-playfair), 'Playfair Display', serif", s: 1, w: 500 },
  { t: "Xush kelibsiz", f: "var(--font-fraunces), 'Fraunces', serif", s: 0.82, w: 300 },
  { t: "Добро пожаловать", f: "var(--font-cormorant), 'Cormorant Garamond', serif", s: 0.78, w: 500 },
  { t: "欢迎", f: "var(--font-noto-sc), 'Noto Serif SC', serif", s: 1.1, w: 300, whole: 1 },
  { t: "مرحبا بك", f: "var(--font-amiri), 'Amiri', serif", s: 1.1, whole: 1 },
  { t: "ようこそ", f: "var(--font-shippori), 'Shippori Mincho', serif", s: 1, whole: 1 },
  { t: "Қош келдіңіз", f: "var(--font-ptserif), 'PT Serif', serif", s: 0.86, w: 400 },
  { t: "Кош келиңиз", f: "var(--font-ptserif), 'PT Serif', serif", s: 0.86, w: 400 },
];

const HOLD = 1500;                       /* each word stays ~1.5s */
const TOTAL = HOLD * WL_LANGS.length + 400;
const MIN_DISPLAY = 1200;                /* never hide before the first word finished animating in */
const FADE_MS = 500;

export function WelcomeLoader({ appReady }: { appReady: boolean }) {
  /* Session gate: the flag is set when the loader starts and cleared on
     pagehide — so on every fresh page load it is unset (SSR renders the
     overlay; hydration always matches), while in-app remounts skip it. */
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(WL_FLAG) !== "1";
    } catch {
      return true;
    }
  });
  const [fading, setFading] = useState(false);
  const wordRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const readyRef = useRef(appReady);

  useEffect(() => {
    readyRef.current = appReady;
  }, [appReady]);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(WL_FLAG, "1");
    } catch {
      /* private mode etc. — proceed without the flag */
    }

    const word = wordRef.current;
    const fill = fillRef.current;
    if (!word || !fill) return;

    /* lock body scroll while visible */
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let idx = 0;
    let startAt = 0;
    let cycleTimer: ReturnType<typeof setInterval> | undefined;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let dismissed = false;

    /* ---- reference show(): build the word, animate letters in ---- */
    function show(i: number) {
      const d = WL_LANGS[i];
      word!.className = "wl-word";
      word!.innerHTML = "";
      word!.style.fontFamily = d.f;
      word!.style.fontWeight = String(d.w ?? 500);
      const parts = d.whole ? [d.t] : Array.from(d.t);
      for (let k = 0; k < parts.length; k++) {
        const s = document.createElement("span");
        s.className = "wl-grad";
        s.style.setProperty("--i", String(k));
        s.style.fontSize = `calc(clamp(44px, 10.5vw, 128px) * ${d.s})`;
        s.textContent = parts[k] === " " ? "\u00a0" : parts[k];
        if (d.whole) s.style.animationDuration = ".8s";
        word!.appendChild(s);
      }
      void word!.offsetWidth; /* restart animations */
      word!.classList.add("in");
    }

    /* ---- reference next(): animate out, then swap ---- */
    function next() {
      word!.classList.remove("in");
      word!.classList.add("out");
      swapTimer = setTimeout(() => {
        idx = (idx + 1) % WL_LANGS.length;
        show(idx);
      }, 450);
    }

    /* ---- reference tick(): eased progress line ---- */
    function tick() {
      const p = Math.min(1, (performance.now() - startAt) / TOTAL);
      const e = 1 - Math.pow(1 - p, 2.2);
      fill!.style.width = (e * 100) + "%";
      if (p < 1) raf = requestAnimationFrame(tick);
    }

    /* ---- dismiss: fade out, unmount, unlock scrolling ---- */
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (cycleTimer) clearInterval(cycleTimer);
      if (swapTimer) clearTimeout(swapTimer);
      if (pollTimer) clearInterval(pollTimer);
      cancelAnimationFrame(raf);
      setFading(true);
      fadeTimer = setTimeout(() => {
        document.body.style.overflow = prevOverflow;
        setVisible(false);
      }, FADE_MS);
    }

    /* start only once fonts are ready (no flash of wrong type) */
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive || dismissed) return;
      show(0);
      startAt = performance.now();
      cycleTimer = setInterval(next, HOLD);
      tick();
    });

    /* hide when the app is ready — but never before MIN_DISPLAY after the first word */
    pollTimer = setInterval(() => {
      if (!readyRef.current || !startAt) return;
      if (performance.now() - startAt >= MIN_DISPLAY) dismiss();
    }, 100);

    return () => {
      alive = false;
      if (cycleTimer) clearInterval(cycleTimer);
      if (swapTimer) clearTimeout(swapTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  /* hard refresh re-shows the loader: clear the session flag when the page unloads */
  useEffect(() => {
    const onPageHide = () => {
      try {
        sessionStorage.removeItem(WL_FLAG);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`wl-root${fading ? " wl-fading" : ""}`}
      role="status"
      aria-label="Loading DubAniX"
      aria-live="polite"
    >
      <div className="wl-blob wl-b1" aria-hidden="true" />
      <div className="wl-blob wl-b2" aria-hidden="true" />
      <div className="wl-blob wl-b3" aria-hidden="true" />

      <div className="wl-stack">
        {/* DubAniX brand intro — mark scales in, bars grow, wordmark letters rise, then idle */}
        <Logo variant="full" theme="light" size={34} state="intro" aria-label="DubAniX" />
        <div className="wl-stage">
          <div className="wl-word" ref={wordRef} />
        </div>
      </div>

      <div className="wl-bar" aria-hidden="true">
        <b ref={fillRef} />
      </div>
    </div>
  );
}
