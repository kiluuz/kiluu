"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import "./welcome-loader.css";

/* ============ KILUU WELCOME PRELOADER ============
 * Full-screen white overlay above everything; the word "Welcome" cycles through
 * 8 languages, each in its own typeface, with an orange -> violet -> teal
 * gradient. Letter-by-letter rise/fall (blur-to-sharp + 3D rotateX) for
 * Latin/Cyrillic; whole-word animation for Chinese, Arabic and Japanese.
 * A thin gradient progress line fills at the very bottom of the screen.
 *
 * Shown once per page load (sessionStorage flag, cleared on pagehide so a
 * hard refresh re-shows it, while in-app navigation never does).
 * The full multilingual welcome finishes within two seconds.
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

const HOLD = 200;
const TOTAL = HOLD * WL_LANGS.length;
const MIN_DISPLAY = TOTAL;
const HARD_DISPLAY = 1750;
const FADE_MS = 250;

export function WelcomeLoader({ appReady }: { appReady: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const wordRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const readyRef = useRef(appReady);

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(WL_FLAG) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

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
    const startAt = performance.now();
    let cycleTimer: ReturnType<typeof setInterval> | undefined;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let readinessTimer: ReturnType<typeof setInterval> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let hardTimeout: ReturnType<typeof setTimeout> | undefined;
    let dismissed = false;

    /* ---- reference show(): build the word, animate letters in ---- */
    function show(i: number) {
      if (!word) return;
      const d = WL_LANGS[i];
      word.className = "wl-word";
      word.innerHTML = "";
      word.style.fontFamily = d.f;
      word.style.fontWeight = String(d.w ?? 500);
      const parts = d.whole ? [d.t] : Array.from(d.t);
      for (let k = 0; k < parts.length; k++) {
        const s = document.createElement("span");
        s.className = "wl-grad";
        s.style.setProperty("--i", String(k));
        s.style.fontSize = `calc(clamp(44px, 10.5vw, 128px) * ${d.s})`;
        s.textContent = parts[k] === " " ? "\u00a0" : parts[k];
        if (d.whole) s.style.animationDuration = ".08s";
        word.appendChild(s);
      }
      void word.offsetWidth; /* restart animations */
      word.classList.add("in");
    }

    /* ---- reference next(): animate out, then swap ---- */
    function next() {
      if (!word) return;
      word.classList.remove("in");
      word.classList.add("out");
      swapTimer = setTimeout(() => {
        idx = (idx + 1) % WL_LANGS.length;
        show(idx);
      }, 80);
    }

    /* ---- reference tick(): eased progress line ---- */
    function tick() {
      if (!fill) return;
      const p = Math.min(1, (performance.now() - startAt) / TOTAL);
      const e = 1 - Math.pow(1 - p, 2.2);
      fill.style.width = (e * 100) + "%";
      if (p < 1) raf = requestAnimationFrame(tick);
    }

    /* ---- dismiss: fade out, unmount, unlock scrolling ---- */
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (hardTimeout) clearTimeout(hardTimeout);
      if (cycleTimer) clearInterval(cycleTimer);
      if (swapTimer) clearTimeout(swapTimer);
      if (readinessTimer) clearInterval(readinessTimer);
      cancelAnimationFrame(raf);
      setFading(true);
      fadeTimer = setTimeout(() => {
        document.body.style.overflow = prevOverflow;
        setVisible(false);
      }, FADE_MS);
    }

    /* Start the first word immediately so stage is never empty */
    show(0);
    cycleTimer = setInterval(next, HOLD);
    tick();

    /* Keep the welcome screen, including its fade, within two seconds. */
    hardTimeout = setTimeout(dismiss, HARD_DISPLAY);

    /* Poll: dismiss when app is ready and minimum display has elapsed */
    readinessTimer = setInterval(() => {
      const elapsed = performance.now() - startAt;
      if (readyRef.current && elapsed >= MIN_DISPLAY) {
        dismiss();
      }
    }, 100);

    return () => {
      if (hardTimeout) clearTimeout(hardTimeout);
      if (cycleTimer) clearInterval(cycleTimer);
      if (swapTimer) clearTimeout(swapTimer);
      if (readinessTimer) clearInterval(readinessTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

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

  if (!mounted || !visible) return null;

  return (
    <div
      className={`wl-root${fading ? " wl-fading" : ""}`}
      role="status"
      aria-label="Loading Kiluu (click to skip)"
      aria-live="polite"
      onClick={() => {
        setFading(true);
        setTimeout(() => setVisible(false), FADE_MS);
      }}
    >
      <div className="wl-blob wl-b1" aria-hidden="true" />
      <div className="wl-blob wl-b2" aria-hidden="true" />
      <div className="wl-blob wl-b3" aria-hidden="true" />

      <div className="wl-stack">
        {/* Kiluu brand intro — mark and wordmark animate in. */}
        <Logo variant="full" theme="light" size={34} state="intro" aria-label="Kiluu" />
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
