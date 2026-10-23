"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Gift,
  Mic2,
  Play,
  Users,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { t as translateMessage, type Locale } from "@/lib/i18n";
import { LogoMark } from "@/components/brand/LogoMark";
import styles from "./landing-page.module.css";

const navigation = [
  { label: "nav.browse", href: "/browse" },
  { label: "nav.schedule", href: "/schedule" },
  { label: "nav.community", href: "/community" },
  { label: "nav.watch-together", href: "/watch-together" },
  { label: "nav.gifts", href: "/gifts" },
];

const features = [
  {
    number: "01",
    title: "landing.features.watch.title",
    icon: Users,
    href: "/watch-together",
    points: ["landing.features.watch.point1", "landing.features.watch.point2", "landing.features.watch.point3", "landing.features.watch.point4"],
  },
  {
    number: "02",
    title: "landing.features.gift.title",
    icon: Gift,
    href: "/gifts",
    points: ["landing.features.gift.point1", "landing.features.gift.point2", "landing.features.gift.point3"],
  },
  {
    number: "03",
    title: "landing.features.dubbing.title",
    icon: Mic2,
    href: "/dubbing",
    points: ["landing.features.dubbing.point1", "landing.features.dubbing.point2", "landing.features.dubbing.point3"],
  },
];

export function LandingPage({ initialLocale }: { initialLocale: Locale }) {
  const pageRef = useRef<HTMLElement>(null);
  const { locale } = useI18n();
  const [pageLocale, setPageLocale] = useState(initialLocale);
  const t = (key: string) => translateMessage(pageLocale, key);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPageLocale(locale));
    return () => window.cancelAnimationFrame(frame);
  }, [locale]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const revealItems = [...page.querySelectorAll<HTMLElement>("[data-landing-reveal]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealItems.forEach((item) => item.classList.add(styles.visible));
      return;
    }

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add(styles.visible));
      return;
    }

    page.classList.add(styles.motionReady);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <main className={styles.landing} lang={pageLocale} ref={pageRef}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroFrame}>
          <video
            className={styles.heroVideo}
            src="/landing/showreel.mp4"
            poster="/landing/showreel-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <div className={styles.noise} aria-hidden="true" />
          <div className={styles.heroShade} aria-hidden="true" />

          <nav className={styles.nav} aria-label={t("landing.mainNavigation")}>
            <ul>
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{t(item.label)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle} id="landing-title">
              <LogoMark
                className={styles.heroLogo}
                size={128}
                theme="dark"
                animated="none"
                decorative
              />
              <span>Kiluu</span>
            </h1>
            <div className={styles.heroAside}>
              <p data-landing-reveal>
                {t("landing.hero.description")}
              </p>
              <Link className={styles.cta} href="/app" data-landing-reveal>
                {t("landing.hero.cta")}
                <span className={styles.ctaIcon} aria-hidden="true">
                  <ArrowRight />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.about} aria-labelledby="about-title">
        <div className={styles.aboutCard} data-landing-reveal>
          <span className={styles.eyebrow}>{t("landing.about.eyebrow")}</span>
          <h2 id="about-title">
            {t("landing.about.titleStart")} <span className={styles.serif}>{t("landing.about.titleEmphasis")}</span>{" "}
            {t("landing.about.titleEnd")}
          </h2>
          <p>{t("landing.about.description")}</p>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-title">
        <div className={styles.featureWrap}>
          <h2 className={styles.featureHeading} id="features-title" data-landing-reveal>
            <span>{t("landing.features.title")}</span>
              <span className={styles.mutedHeading}>{t("landing.features.subtitle")}</span>
          </h2>

          <div className={styles.featureGrid}>
            <Link className={styles.showreelCard} href="/browse" data-landing-reveal>
              <video
                className={styles.cardVideo}
                src="/landing/showreel.mp4"
                poster="/landing/showreel-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                aria-hidden="true"
              />
              <span className={styles.cardShade} aria-hidden="true" />
              <span className={styles.showreelTitle}>
                {t("landing.features.showreel")}
                <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>

            {features.map(({ number, title, icon: Icon, href, points }) => (
              <article className={styles.featureCard} key={number} data-landing-reveal>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon />
                </span>
                <h3>
                  {t(title)} <small>({number})</small>
                </h3>
                <ul>
                  {points.map((point) => (
                    <li key={point}>
                      <Check aria-hidden="true" />
                      <span>{t(point)}</span>
                    </li>
                  ))}
                </ul>
                <Link className={styles.moreLink} href={href}>
                  {t("landing.learnMore")} <ArrowUpRight aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.wordmark} href="/" aria-label={t("landing.homeAria")}>
          <LogoMark variant="lockup" size={28} theme="dark" animated="none" decorative />
        </Link>
        <span>{t("landing.footer.tagline")}</span>
        <Link className={styles.footerLink} href="/app">
          {t("landing.footer.enter")} <Play aria-hidden="true" />
        </Link>
      </footer>
    </main>
  );
}
