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

---
Task ID: 3
Agent: Super Z (main)
Task: User reported missing features (AI dubbing, schedule, sidebar links, split login page, small home cards, profile). Diagnose + rebuild all.

Work Log:
- Diagnosed: those features were part of the Oct 8 uncommitted work lost in the workspace rollback (git had no trace); v2/v3 rebuilds covered theme/profile/brand only. Also discovered dev server had a stale Prisma client after schema changes and that processes started in tool calls die at call end (sandbox cgroup cleanup).
- Schema: Anime +airDay Int? / +airTime String?; new DubJob model (userId, animeId, episodeId, targetLang, voice, status, pricePaid, @@unique [userId,episodeId,targetLang]); relations wired on User/Anime/Episode; prisma db push + generate; seeded 12 ONGOING animes with weekly prime-time slots (scripts/seed-schedule.ts) and patched scripts/seed.ts so fresh DBs match.
- APIs: GET /api/schedule (ONGOING animes w/ airDay, ownership-aware); GET/POST /api/dubbing (voice profile pricing 15/15/20/20/25 credits, ownership or free gate, duplicate-dub guard, credit transaction + decrement in $transaction, job history).
- Store/types: ViewName + login/schedule/dubbing; setAuthOpen(true) now navigates to the full-page login view (all 26 existing call sites inherited new behavior); +ScheduleItem/DubJobItem/EpisodeOption types.
- shell.tsx REWRITTEN: desktop fixed left sidebar (264px, glass-strong, grain) with brand lockup, Browse section (Home, Discover, Schedule, AI Dubbing w/ UZ badge, Community, Watch Together), My Stuff (My Library, Exchange w/ 20+ badge, Get Credits, Creator Studio for creators), footer user area (avatar row -> full profile, Theme/Settings/Sign out, guest sign-in CTA); slim sticky TopBar (search + credits + bell + theme + avatar) with lg:pl-[264px]; mobile keeps mark top bar + bottom tabs now Home/Discover/Schedule/AI Dub/Library(or Sign in); CSS-only dark: icon swap (fixed react-hooks/set-state-in-effect lint).
- views/login.tsx NEW: full-screen split — left 55% cinematic panel (random featured banner, ken-burns zoom, grain, gradient legibility stack, Logo+tagline, rotating quote + 3 perk chips), right auth card (tabs Sign In/Create Account, mobile top-banner variant, back-to-browse); AuthModal deleted from auth.tsx (Onboarding kept).
- views/schedule.tsx NEW: Broadcast Schedule — weekday tab bar (counts + today dot + live-today default), "Still to come today" strip with live countdowns (30s tick), day cards (time block, poster, title/rating/genres/eps, FREE/OWNED/CREDITS badge, Watch + reminder), airing-today glow, empty state, skeletons.
- views/dubbing.tsx NEW: AI Dubbing Studio — language cards (O'zbekcha LIVE / Қазақша + Кыргызча coming soon), 3-step flow (anime picker grid w/ filter from free+owned, episode list w/ UZ-ready badges, 5 Uzbek voice profiles w/ per-episode credit pricing), order summary + big Dub button, 5-stage pipeline stepper (analyze/transcribe JA/translate UZ/synthesize/mix) choreographed 4.4s in parallel with the API call, live waveform (wave-bar CSS), Logo state="playing" during processing, My dubs history grid.
- ui-bits.tsx: AnimeCard upgraded 150->176/196/210px w/ description hover preview; NEW RankedCard (Netflix-style 110-140px outline numerals, z-layered behind poster, hover glow) for Trending Now + Hall of Fame; NEW WideCard (16:9 banner, FRESH DROP/NEW EPISODES tags) for Fresh Drops. globals.css: +ken-burns, rank-numeral, wave-bar, step-pulse, airing-today utilities.
- app.tsx: sidebar layout (main + footer lg:ml-[264px]), login renders standalone chrome-less, 3 new views wired.
- Infra: dev server relaunched via start-stop-daemon --background (.zscripts/dev-server.sh + next-dev.pid) so it survives tool-call cleanup — plain nohup/setsid do NOT survive in this sandbox.
- Verified via agent-browser + VLM: home (sidebar all links, hero, big ranked cards "polished Netflix-style"), login (full-page split confirmed, mobile variant clean), schedule (tabs+counts, today strip, cards w/ times), dubbing (end-to-end: login -> pick Death Note EP1 -> Aziza voice -> 15 credits charged 2400->2385, job in history, credits tx recorded), profile card + full profile via sidebar row (Discord layout intact), mobile bottom tabs. tsc: 0 src errors; lint: 0; dev.log: 0 500s. Screenshots shots/v4-*.png.
- COMMITTED 6adc148.

Stage Summary:
- All user-reported missing features rebuilt and verified: sidebar nav (all links), full-page split login, Broadcast Schedule w/ countdowns, AI Dubbing Studio (JA->UZ, credit economy, waveform pipeline), professional big home cards (ranked + wide), easy profile access.
- New backend: /api/schedule, /api/dubbing, DubJob table, anime airDay/airTime (+seed).
- Key infra lesson: persistent processes must be launched via start-stop-daemon in this sandbox; dev server PID file at .zscripts/next-dev.pid.

---
Task ID: 4
Agent: Super Z (main)
Task: Redesign mobile/tablet navigation — every sidebar destination reachable on mobile via "floating dock + smart sheet" (spec by user). Fix dev N-badge overlap, weak active states, lost badges.

Work Log:
- next.config.ts: devIndicators:false (killed the dark Next.js "N" circle overlapping the dock; prod never had it). Also suppressed pre-existing Logo useId() SSR hydration warning (React 19.2 dev quirk) via suppressHydrationWarning on gradient/rect — console now 0 errors on fresh load.
- API: /api/auth/me + /login + /register now return ownedCount (db.purchase.count) → AuthUser.ownedCount?. Powers Exchange badge/lock/progress ring.
- NEW nav-config.ts — single source of truth: NAV_ITEMS (10 destinations: home, browse, schedule, dubbing[center,badge UZ], community, watch-together, library, exchange[badge 20+, lock@20, lockHint], credits, studio[creatorOnly, lockHint]) + groups browse/my/creator + useResolvedNav() (active/badges/locks/dots from store) + useMenuItemForView() (Menu-slot mirroring).
- NEW mobile-dock.tsx (<768px): floating glass dock inset 12px+safe-area, radius 24, grid 5 slots; center raised 56px CTA (orange #ff4d1c->#ffa23a gradient, glow ring, 5-bar waveform idle anim, UZ micro-badge) -> dubbing; spring sliding pill (framer layoutId), icon fill+weight, label only on active; Menu slot mirrors current in-menu page (icon+label+active); emerald dot on Menu/Schedule tile when /api/schedule has airDay==today; hide-on-scroll (rAF, >120px delta) + hidden when immersive (watch view, watch-party room via store flag, fullscreenchange) / keyboard (visualViewport<82%) / profile modal / mobile search; active:scale-94 + navigator.vibrate(8); inert+aria-hidden when hidden.
- NEW nav-sheet.tsx (vaul Drawer): snapPoints [0.55, 1], fadeFromIndex 0, h-94dvh inline style (base max-h-80vh/mt-24 overridden), sr-only DrawerTitle/Description (a11y); header: user card (avatar/name/@handle/Creator crown -> user-profile w/ username param) + credits chip (-> credits); search trigger (-> full-screen search); body: grouped 2-3col tile grid, staggered 30ms rise, AI Dub UZ badge + "JA->UZ live", Exchange 20+ badge + lock + ProgressRing n/20 + "Market unlocked", Creator Studio crown badge (creators) / lock+explanation (viewers), guest Exchange lock -> sign-in toast; footer row: theme cycle light/dark/system, language picker UZ/RU/EN/KK/KY (localStorage dubanix.lang, honest "translation coming soon" toast), notifications, settings, sign out/sign in; Esc/scrim/drag-close by vaul+radix (focus trap, scroll lock).
- NEW mobile-search.tsx: full-screen z-60 overlay, back+input+clear, popular-trending default (12 posters), debounced 280ms, FREE/CR price badges, Esc+body scroll lock, staggered rows, navigates to detail.
- NEW tablet-rail.tsx (768-1100px): 76px glass rail, Logo mark top, RailButtons w/ Radix tooltips + active line + badge dots, theme+avatar bottom; hover (260ms delay) or chevron tap expands Sidebar variant="overlay" (264px, spring slide) + scrim + Esc; mouse-leave closes (200ms).
- shell.tsx refactored: Sidebar consumes useResolvedNav (NavButton w/ badge+lock, overlay variant for tablet); TopBar compact mobile (mark/back, title collapse on scroll, search icon -> overlay <1100px, bell always, theme only desktop, avatar), border-on-scroll via data-scrolled; breakpoints min-[1100px]; old MOBILE_NAV + MobileNav + MobileSearchRow deleted.
- app.tsx: TabletRail + MobileDock + MobileSearch wired; main/footer paddings md:max-[1099.98px]:pl-[76px] / min-[1100px]:pl-[264px]; bottom padding calc(116px+safe-area) for dock; '/' shortcut -> mobile overlay below 1100px; /api/schedule airs-today fetch -> store; immersive flag for watch view.
- CRITICAL BUG FIXED: Tailwind v4 cascade — `md:flex` beat `min-[1100px]:hidden` in generated CSS order (rail+overlay stayed visible on desktop, paddings stuck at 76px). Fixed w/ stacked variants `md:max-[1099.98px]:` (non-overlapping ranges).
- store.ts: +mobileSearchOpen, +immersive, +scheduleAirsToday (+setters; navigate closes mobile search). watch-together.tsx: immersive on activeRoom. globals.css: dock-glass (glass+inner stroke+shadow, light/dark), dock-cta (brand gradient+glow+active ring), dock-wave-bar (1.3s eq), nav-sheet surface + grabber restyle, sonner mobile bottom offset 104px+safe-area, reduced-motion kills.
- Verified via agent-browser + VLM (scripts/vlm-check.ts): 360/320/390px dock (5 slots, pill, CTA, no N badge), sheet half/full snap drag (398->47px), all 10 destinations reachable <=2 taps w/ active mirroring (automated run), locked Exchange 6/20 ring+toast, locked Creator Studio toast, unlocked 20/20 "Market unlocked", login sakura(creator)/ryujii(viewer), Esc/scrim close, search overlay (popular 12 posters + 'death' query -> Death Note), theme cycle, language persist uz, dock hidden in watch view (translate 160%, rect below viewport) + profile modal, hide-on-scroll down/up, toast above dock, 768px rail (badges, active line) + hover/chevron expand overlay + scrim, 1366px desktop sidebar 264px (rail gone after fix), light+dark themes, 320px no overflow, landscape 780x360 (rail per spec). tsc 0 src errors, lint 0, dev.log 0 500s, hydration 0. COMMITTED ed77c75.

Stage Summary:
- All 10 destinations + profile + settings reachable on mobile within 2 taps; badges (UZ, 20+) preserved across dock/sheet/rail/sidebar; active state always visible incl. in-Menu pages.
- Single nav config drives all 4 surfaces; desktop sidebar behavior/routes untouched (>1100px).
- Key decisions: (1) Creator Studio visible-locked for viewers w/ one-time-role explanation (desktop hides it — parity kept for creators); (2) language picker persists choice but UI stays EN (no i18n system) w/ honest toast; (3) footer row only visible at full sheet snap (standard half-snap sheet pattern); (4) toast/lift + no prefetch (SPA store navigation, single bundle); (5) tablet hover-expand has 260ms delay + 200ms close.

---
Task ID: 5
Agent: Super Z (main)
Task: User report "navbar hides our logo and DubAniX name" — diagnose + fix.

Work Log:
- Diagnosed with elementFromPoint probes: sticky TopBar (z-40, rendered after Sidebar in DOM, equal z-index) painted its 94%-opaque glass background full-viewport-width (pl-[264px] is padding, not offset) — covering the top 64px of the desktop Sidebar where the Logo + DubAniX wordmark + tagline sit. Same stacking bug covered the tablet rail's logo mark. Mobile top bar used mark-only compact lockup, so the name was never rendered on phones.
- shell.tsx: fixed Sidebar raised z-40 -> z-50 (desktop sidebar now paints above the TopBar seam at x=264). TopBar mobile brand slot rebuilt: full <Logo variant full size 28> with onClick home + scoped .dbx-navbrand class; wordmark collapses on scroll while the existing page title fades in (YouTube-style swap). BrandLockup compact prop removed (dead code). Bell hidden <sm (notifications remain in Menu sheet footer). Credits + icon hidden <sm (pill still links to credits page).
- tablet-rail.tsx: collapsed rail z-40 -> z-50 (logo mark no longer covered); expand-overlay scrim z-40 -> z-[45] — now correctly covers the TopBar when expanded (secondary bug: topbar used to float above the dark scrim).
- logo.css: .dbx-navbrand rules — wordmark max-width 120px -> 0 + opacity transition on .dbx-collapse (scroll), media (max-width:359.98px) wordmark hidden entirely (320px = mark-only, no overflow), media (768–1099.98px) mark display:none (tablet rail carries the mark, top bar shows wordmark only — no duplicate mark); reduced-motion kills the transition.
- Verified via agent-browser + VLM: desktop 1366 logo+wordmark topmost element & VLM-confirmed fully visible; tablet 900 rail logo visible + wordmark at x=105 + no duplicate mark + light mode + expanded overlay (scrim covers topbar, overlay brand visible); mobile 390 top = mark+wordmark 124px lockup, scrolled = wordmark collapsed (opacity 0/max-width 0) + title "Home" visible, 320 = brand 34px mark-only, rightmost action (avatar) ends x=307 < 320, docOverflowX false at all sizes; console/page errors 0. tsc: 0 src errors; lint clean. COMMITTED 0785c15.

Stage Summary:
- Logo + DubAniX name now visible on every surface: desktop sidebar (z-fix), tablet rail + top-bar wordmark, mobile top bar (mark + wordmark with scroll-swap; mark-only <360px).
- z-order ladder now: TopBar 40 < rail/sidebar/scrim-expands 45-50 < mobile search 60 < profile editor 80 < profile modal 90 < onboarding 100 < dialogs 110.
- Space budget on phones: bell + credits-plus hidden below sm to fit the wordmark at 360px; both remain reachable (sheet footer notifications / credits page).

---
Task ID: 6
Agent: Super Z (main)
Task: User report "on mobile Home/Discover/AI Dubbing/Library have no background" — dock glass missing.

Work Log:
- Reproduced at 390px: computed .dock-glass = background rgba(0,0,0,0), backdrop-filter none, box-shadow none. Served-stylesheet walk: dock-glass/dock-cta/dock-wave-bar/nav-sheet rules completely ABSENT while all classes above line ~570 (airing-today etc.) were present.
- Root cause 1 (stale compile): dev server (started 08:57) served a Turbopack CSS compile from before globals.css's last rewrite (mtime 09:27, workspace sync) — the whole MOBILE NAVIGATION section was missing from output. Appended a probe -> recompile -> section restored (background/border/shadow back).
- Root cause 2 (Lightning CSS strip): backdrop-filter STILL computed none. Minimal repro classes appended to globals.css proved: `backdrop-filter` alone SURVIVES; any rule also containing `-webkit-backdrop-filter` gets BOTH declarations stripped by @tailwindcss/postcss 4.1.18's Lightning CSS compat pass (other -webkit- props are fine: -webkit-text-stroke survives; -webkit-background-clip:text is lowered into the background shorthand and works — .dbx-x gradient intact).
- Fix: removed 4 `-webkit-backdrop-filter` lines (.glass, .glass-strong, .dock-glass, .nav-sheet) + removed the probe/test classes. Unprefixed backdrop-filter: Chrome 76+/FF 103+/Safari 18+; older Safari degrades to tint w/o blur.
- Verified: dock bg oklch(0.155/.88) + blur(24px) saturate(1.6) computed; topbar glass-strong blur(22px); nav-sheet blur(26px); VLM-confirmed frosted glass in dark + light; dock tab navigation (Library active) works; 0 console/page errors. COMMITTED c20e461.

Stage Summary:
- Mobile dock (Home/Discover/AI Dub/Library/Menu) has its floating glass bar back on all pages; desktop sidebar + tablet rail + topbar blur also restored (glass-strong was affected by the same strip).
- Lesson recorded: (a) if a CSS section vanishes after workspace sync, compare file mtime vs dev-server start and force a recompile; (b) never hand-write -webkit-backdrop-filter alongside backdrop-filter under Tailwind v4.1 Lightning CSS — it strips both.

---
Task ID: 7
Agent: Super Z (main)
Task: User report — 3 fixes: (1) mobile profile circle opens screen not centered (user suspected the avatar button class), (2) Trending Now / Hall of Fame cards still not professional/majestic/modern, (3) remove the "3 · Voice profile" card from AI Dubbing.

Work Log:
- [1] Reproduced at 390px: ProfileModal card rect left=0 right=340 on 390px viewport — the wrapper was `w-full` while ProfilePopupCard is `max-w-[340px]` left-aligned inside it, so the bottom sheet hugged the LEFT edge with a 50px dead strip on the right (pixel-sampled to confirm: card surface x=0-340, backdrop x=345+). The quoted button class was a red herring — the button is fine; the modal container was the bug.
- [1] profile-card.tsx ProfileModal rebuilt as a centered floating popover on ALL breakpoints: wrapper no longer `w-full` (flex shrink-wrap + parent justify-center centers it), `items-center` + `p-3 sm:p-4`, rounded-3xl all corners, `max-h-[92dvh] overflow-y-auto no-scrollbar` guard for short/landscape viewports, shadow moved to wrapper (overflow would clip the card's own shadow). Skeleton: `w-[340px] max-w-full`. isMobile matchMedia branch + bottom-sheet-in usage deleted (keyframes kept in css, comment added). Measured after fix: gapL=25 gapR=25 gapT=61 gapB=61 — perfectly centered on 390px; Esc + backdrop-click close verified; light theme verified; 0 console errors.
- [2] RankedCard (ui-bits.tsx) redesigned "majestic": NEW tone prop ("ember" for Trending Now, "gold" for Hall of Fame via .rank-gold). Numerals are now METALLIC GRADIENT text (linear-gradient hi->mid->lo->highlight clipped to text, drop-shadow glow, Space Grotesk 800, 116/136/154px) instead of the old flat outline — CSS vars --rank-hi/mid/lo per tone. Layout: CSS grid `grid-cols-[auto_1fr] grid-rows-[1fr_53px]` — numeral lives in row 1 only (self-end => grounds exactly at POSTER bottom, never bleeds into titles; first attempt with flex items-end was caught by VLM bleeding into title text), poster column row-span-2 pulled left -ml-4/5 so poster overlaps numeral (layered depth). Poster upgraded: 168/188/206px (was 152/168/184), rounded-2xl, deep shadow, hover border-primary/50 + glow + -translate-y-1.5 lift, top sheen gradient, diagonal shine-sweep animation on hover (.rank-shine), resting rating+access chip, hover veil with centered play FAB + genres. Title block below poster with FIXED h-[53px] + explicit pixel leadings so every poster in a row aligns regardless of 1-2 line titles; meta line type·year·rating. prefers-reduced-motion kills transitions.
- [2] home.tsx: Hall of Fame passes tone="gold". VLM verdicts: "very premium and modern" (mobile trending), "metallic gold 3D beveled, clean row, no overlap with titles" (HOF after grid fix), "premium/majestic, perfectly differentiates categories" (desktop), numerals clearly visible + titles readable in light mode. No overflow at 320/390/768/1366.
- [3] dubbing.tsx: "3 · Voice profile" card REMOVED (whole section incl. voice list + Mic2 import). `voice` state deleted; `selectedVoice = VOICES[0]` (Aziza, 15cr) — API POST still sends voice:"aziza" unchanged, order summary keeps a static "Voice — Aziza · Warm narrator" row for price transparency. Header copy updated ("choose an episode" instead of "choose a voice profile"), language card note now "Live now · 15 credits per episode". End-to-end re-verified: picked Frieren EP1 -> dub -> pipeline -> credits 5,000->4,985, toast, "My dubs (1) Frieren EP1 UZ READY −15 credits". Mobile 390: clean, no voice card, no overflow.
- Validation: tsc 0 src errors; eslint clean on all 4 touched files; dev.log 0 errors; console 0 errors/pageerrors at 390 & 1366; no horizontal overflow 320-1366; light+dark themes checked. Screenshots shots/fix7-*.png / bug7-*.png.

Stage Summary:
- Profile modal: centered popover on every breakpoint (was left-stuck 340px bottom sheet on phones); max-h + internal scroll guards short screens.
- RankedCard: metallic gold/ember podium numerals grounded at poster bottom via 2-row grid, bigger posters, shine sweep, play-FAB hover, always-visible aligned titles, tone variants for Trending vs Hall of Fame.
- AI Dubbing: voice picker card removed; fixed studio voice (Aziza 15cr) flows to the unchanged /api/dubbing contract; copy + pricing notes updated.
