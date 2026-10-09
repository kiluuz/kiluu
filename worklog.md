# AniVerse Worklog

---
Task ID: 1
Agent: Super Z (main)
Task: Diagnose "website turned old version" + rebuild all lost work (Midnight Cinema + Discord-level profile system)

Work Log:
- Diagnosed: workspace was restored to Oct 7 git commit on session restart; all Oct 8 uncommitted work (Midnight Cinema redesign, profile customization) was lost. DB intact (6 users, 24 animes).
- Rebuilt globals.css with Midnight Cinema palette (warm ink dark + orange #f97316 accent, Space Grotesk display font, film grain, ember aurora, glass-strong opaque header).
- Replaced sidebar with top navigation (shell.tsx): brand lockup w/ inline kana, nav pills, credits pill, opaque sticky header (fixed see-through bug), 1280px content width.
- Added multilingual welcome loader (app.tsx): EN/KK/KY/RU/UZ/JA/KO cycling + ember glow, min 2.8s.
- Fixed home hero (raw-URL guard, no -mt-16), detail view, purple->orange accent sweep across all views.
- Prisma schema: +14 User fields (pronouns, tagline, country, timezone, socialLinks, statusEmoji/Text, accentTo, avatarFrame, bannerPreset, showcase, privacy). Pushed + migrated accents.
- src/lib/media.ts: magic-bytes sniffing (JPEG/PNG/WebP/GIF), animated detection, 8MB cap, EXIF strip via sharp re-encode, 3:1 banner crop, responsive WebP variants (1500/750/400), LQIP blur data-uri, GIF premium passthrough, old-file cleanup.
- APIs: PATCH /api/profile (all fields + JSON validation), POST/DELETE /api/profile/banner, POST/DELETE /api/profile/avatar, POST /api/profile/premium (credits unlock: animatedBanner 500, frames 300-500), enriched GET /api/users/[username] (real counts, achievements progress, currentlyWatching, ownedAnimes, posts, privacy-aware).
- profile.tsx: ProfileBanner (3:1 parallax, accent-gradient fallback + grain), ProfileIdentity (avatar overlap w/ solid bg ring + online dot, name below banner, Creator badge, status line w/ equalizer), StatChip count-ups, two-column layout (sticky identity col + tabs Overview/Collection/Favorites/Activity/Achievements), Top-5 showcase w/ rank numerals, dedup logic, rich empty states, AchievementTile w/ progress + rarity glow, markdown-lite renderer, social links row.
- profile-card.tsx: 340px Discord popup card (banner, avatar ring, name/handle/status, top-3 posters, 3 achievements, stats, Follow/View buttons); global modal w/ Esc close, click-outside, focus trap, accent focus ring (not red); bottom sheet on mobile; opens from header avatar + community author clicks via useOpenProfile.
- profile-editor.tsx: full-screen split editor (left settings / right LIVE preview w/ page + card modes), BannerCropModal (3:1, drag pan, zoom, SAFE ZONES overlay for avatar/name + popup crop), AvatarCropModal (circular), accent picker (dual hex + presets + auto-from-banner dominant color extraction), identity fields, social links, custom status, showcases (top-5 picker w/ reorder, genres chips, achievements max 6, pinned post, section order + visibility toggles), privacy switches, premium locks w/ credit purchase, dirty guard + discard confirm.
- Fixed dialog z-index (z-[110]) so crop modals render above editor overlay.
- Tested via agent-browser: login, profile card popup, full profile, editor, banner upload pipeline (3 WebP variants generated), auto-accent extraction (#bb6fee from banner), save flow, achievements tab, mobile bottom sheet, community card popup, light mode, detail page. Screenshots in shots/v2-*.png.
- tsc --noEmit: 0 errors in src/. dev.log: no 500s.
- COMMITTED to git (5182e6b) to prevent future rollback loss.

Stage Summary:
- Midnight Cinema theme + top nav + multilingual loader restored.
- Full Discord-level profile customization shipped: banner/avatar uploads w/ crop + safe zones, accent themes, showcases, privacy, premium unlocks, popup card, full profile page w/ tabs.
- DB schema extended (non-destructive). All data preserved.
- Key decision: dialogs use z-[110]; editor overlay z-[80]; popup card z-[90].

---
Task ID: 2
Agent: Super Z (main)
Task: Welcome preloader (exact reference port) + DubAniX brand integration (logo component, favicon set, manifest, og-image, full rebrand)

Work Log:
- layout.tsx: added 8 font families via next/font/google (framework mechanism, preloaded, swap): Unbounded 600/800, Shippori Mincho 500/600, Fraunces 300, Cormorant Garamond italic 500 (+cyrillic-ext), Playfair Display italic 500, Noto Serif SC 300, Amiri italic 400 (arabic), PT Serif italic 400 (+cyrillic-ext for қ ң і). Italic-only families render italic via CSS font-matching (matches reference). metadataBase added; full DubAniX metadata (title, OG, Twitter, manifest, icon set).
- NEW logo.tsx + logo.css: exact port of DubAniX reference — 64v64 rx17 orange-gradient mark (#ff4d1c->#ffa23a) + 5 white waveform bars (H 34/34/32/26/14, X 14/23/32/41/50, opacity 1/1/.95/.8/.6), Unbounded wordmark ("DubAni" 600 @ .92 + gradient "X"), props: variant full|mark, theme dark|light|mono (+auto default follows app theme via --dbx-ink), size, animated, state idle|playing|intro, tagline (吹替 + "Voice it your way" in Shippori Mincho). Animations: idle eq 1.3s staggered .15s scaleY .62; hover .7s scaleY .4 + glow + 1px lift; press .96; intro (mark scale/rotate, bars 70ms stagger, letters 35ms rise, X gradient sweep, auto->idle at 1.2s); playing = live randomized meter via 170ms interval + transform transitions; paused on tab-hidden (visibilitychange) + offscreen (IntersectionObserver); reduced-motion kills all; per-instance gradient id via useId; wordmark min-width reserved (no CLS).
- NEW welcome-loader.tsx + welcome-loader.css: exact port of reference — white fixed overlay z-99999, 3 drifting blurred blobs (#ff7a59/#7c5cff/#22c1c3), 8 languages w/ per-language fonts + orange->violet->teal gradient text, letter-by-letter rise/fall (blur-to-sharp + rotateX, 32ms/14ms stagger), whole-word for ZH/AR/JA, HOLD 1500ms, progress line eased over 12400ms at bottom (safe-area aware), document.fonts.ready gate, dismissal when appReady && >=1.2s after first word (fade 500ms -> unmount + scroll unlock), sessionStorage flag (try/catch) cleared on pagehide so hard-refresh re-shows but in-app nav never does, reduced-motion media query preserved. DubAniX Logo state="intro" (light theme) above the word.
- app.tsx: old custom ember loader REMOVED, replaced with <WelcomeLoader appReady={!loading}/>; footer rebranded (Logo full 24 + 吹替 tagline + separator).
- shell.tsx: BrandLockup now renders <Logo variant full size 38> desktop / <mark size 32> mobile top bar; MobileNav guest sign-in uses Logo mark 22; Sparkles + アニバース kana removed; focus-visible ring on brand button.
- Rebranded all visible strings: auth.tsx (Logo full+tagline in modal, sr-only DialogTitle, onboarding mark+heading, toasts, "Enter DubAniX as..."), settings.tsx (About DubAniX), credits.tsx, detail.tsx (share text), studio.tsx (publish dialog + button w/ <Logo mark mono state="playing"> while publishing), profile-assets.ts (DubAniX Citizen achievement), media.ts comment. Kept internal: aniverse_session cookie (auth.ts), *.test emails in seed.
- scripts/brand-assets.ts (bun + sharp): exact favicon.svg; favicon.ico (hand-assembled ICO w/ 16/32/48 PNGs); apple-touch-icon 180; icon-192/512 regular + maskable (bars scaled 0.66, full-bleed bg); og-image.png 1200x630 (ink bg, orange radial glow, mark + textLength-locked Unbounded wordmark + 吹替 tagline; Unbounded/Shippori TTFs installed to ~/.local/share/fonts for librsvg); manifest.webmanifest (name DubAniX, theme_color #ff4d1c, maskable icons).
- Lint cleanup (React Compiler rules, 11 -> 0 errors): logo.tsx useSyncExternalStore for reduced-motion + adjust-during-render for prop sync; welcome-loader.tsx lazy useState initializer for session gate; profile-card.tsx removed redundant loading state, cleanup-based reset; profile.tsx render-time adjustments (count-up reset, tab prop sync) + cleanup-based fetch reset; profile-editor.tsx ResizeObserver containerW state (no ref-during-render), useMemo-derived object URLs in both crop modals.
- DB: updated seeded bios/posts containing "AniVerse" -> "DubAniX" (1 user, 1 post); seed.ts updated.
- Verified via agent-browser: loader appears on every fresh load/reload (white + gradient word + progress line, fades ~1.7s), once-per-session flag set, logo idle animation in nav (Unbounded loaded), footer lockup + tagline, og/twitter meta = DubAniX, favicon.svg + manifest wired, profile popup + full profile render after fetch refactor, studio publish -> PLAYING state (5 bars randomized) verified with stalled-fetch test, mobile: mark-only top bar + loader + bottom nav, light mode ink #14111d. No console/page errors. Screenshots shots/v3-*.png.

Stage Summary:
- Welcome preloader: pixel-faithful port of reference (8 languages, fonts, timing, animation, progress line) + DubAniX intro logo, session-aware dismissal.
- DubAniX brand: animated <Logo /> component (idle/hover/press/intro/playing, themes, a11y, perf-pausing), full favicon/PWA icon set, og-image, manifest, metadata, and zero visible "AniVerse" strings.
- 11 pre-existing + new React Compiler lint errors resolved to 0.
- Not renamed (internal, per spec): aniverse_session cookie name; *.aniverse.test seed emails; DB schema/tables unchanged.
- KNOWN GAP: AI Dubbing Studio view does not exist in current codebase (lost in the earlier workspace rollback, not rebuilt in v2) — logo "playing" state is wired to Creator Studio publish flow instead. Rebuilding the dubbing studio (JA->UZ pipeline, pricing, waveform UI) needs its own task.
