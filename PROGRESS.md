# DubAniX progress

**Joriy qism:** 11-qism (Quests, streak, referral, haftalik ovoz, mavsumiy tadbirlar, level 1–100) to'liq amalga oshirildi va testlar bilan tasdiqlandi.

Yangilangan: 2026-10-23.

## UX tuzatishlari va brauzer auditi (2026-10-17/18)

- Profil avatar/banner crop modalida upload davomida tugma darhol spinner va “Uploading…” holatini ko‘rsatadi, takroriy Apply bloklanadi; upload xato qilsa crop modal ochiq qoladi va qayta urinish mumkin.
- Creator Studio publish validatsiyasi maydonma-maydon xabar beradi. Anime title uchun server bilan mos minimal uzunlik 2 belgi; tavsif 20 belgi, cover va kamida bitta janr talab qilinadi.
- Creator Studio anime ro‘yxati React Query’da 5 daqiqa cache qilinadi, fokus almashganda ortiqcha so‘rov qilmaydi va publish/episode qo‘shilgach cache invalidatsiya qilinadi.
- Telegram ulash linki bot API qaytargan haqiqiy bot URL’idan foydalanadi; eski link uchun UI’da yangi link olish amali bor.
- Xariddan keyingi achievement yangilanishi xarid transaction’ini muvaffaqiyatsiz ko‘rsatmaydi; qolgan kutilmagan xarid xatolari server log’iga yoziladi.
- Community post image validation R2 Worker URL’larini ham tekshiradi; faqat o‘z Worker’imizdagi `images/post/` fayllari yoki legacy local post uploads qabul qilinadi.
- Brauzer auditida topilgan leaderboard PostgreSQL `COUNT()` BigInt JSON xatosi tuzatildi: DB count’lari API javobiga chiqishdan oldin number’ga aylanadi.
- Community post yuborishdagi amaliy xato aniqlandi: R2 upload `201` bergan va post DB’ga yozilgan, lekin `evaluateAchievements()` tranzaksiyasi `P2028` bilan timeout bo‘lib, `/api/community` 11.4 soniyadan keyin `500` qaytargan. Achievement tekshiruvi endi javobdan keyin bajariladi va xatosi loglanadi; post/XP tranzaksiyasi va level javobi saqlanadi.
- Community rasm yuklash API’si multipart parsing xatosida ham JSON qaytaradi; rasm/post yuborish UI’si bo‘sh yoki JSON bo‘lmagan javobdan endi xom `JSON.parse` xatosini ko‘rsatmaydi.
- Tekshiruv: `npm test` — 37/37; TypeScript, tegishli ESLint va `git diff --check` o‘tdi. Brauzerda feed `200` JSON qaytardi; haqiqiy post yuborish uchun hozirgi brauzer sessiyasi login qilinmagan, shu sabab authenticated E2E bajarilmadi.
- Level tez ko‘tarilishining DB’dagi sababi tasdiqlandi: brauzerda ko‘rinayotgan `marlon` akkauntida bitta real `purchase` hodisasi 250 XP va bitta `post` 25 XP bo‘lib, jami 275 XP. Eski curve’da Lv.2 chegarasi 80, Lv.3 esa 251 XP; demak xarid va post birgalikda Lv.3 bergan, postning o‘zi emas.
- Foydalanuvchi tanloviga ko‘ra curve base 80 dan 250 ga ko‘tarildi; mavjud XP o‘chirilmaydi. Endi 25 XP’lik postlar o‘z-o‘zidan level bermaydi, 250 XP anime xaridi Lv.2 beradi, Lv.3 chegarasi 784 XP. `marlon`ning 275 XP’i endi Lv.2 bo‘ladi.
- Bot Creator buyruqlari Telegram’ning private-chat command menu’siga qo‘shildi (`/my_animes`, `/upload_anime` va boshqalar); `/help` handler va start/help matni ham buyruqlarni ko‘rsatadi. Bot repodagi mavjud Creator/Stars o‘zgarishlari bilan GitHub `main` ga `559e83bea51de728401af72394552905eee8abcd` commitida yuborildi; bot jarayonini deploy/restart qilgandan keyin Telegram menyusi yangilanadi.
- Render Creator API xatosini diagnostika qildim: Next.js `.env.local` kaliti `.env` dagi kalitdan farqli va `.env.local` ustun edi; tunnel so‘rovlarida `.env.local` kaliti 401 bermasdan auth’dan o‘tdi. Lokal `.env` dagi `DATABASE_URL`/`DIRECT_URL` ga credentiallarni o‘zgartirmasdan `schema=dubanix_web` qo‘shdim va dev serverni qayta ishga tushirdim; health/community 200. End-to-end Creator endpoint endi 403 qaytaryapti, chunki so‘rovdagi sayt akkauntida Creator roli bor, ammo Telegram akkaunti ulanmagan. Render `SITE_API_KEY` ni `.env.local` dagi `ANIME_BOT_API_KEY` bilan tenglashtirib, botni Creator profilidan qayta ulash kerak.
- Keyingi tekshiruv bot linkidagi asl sababni topdi: `/api/bot/consume-link` 401 qaytargan, lekin eski bot kodi o‘z DB tokeniga fallback qilib Telegram’ni faqat bot tomonida bog‘lab, muvaffaqiyat deb ko‘rsatgan. Bot endi sayt integratsiyasi sozlangan paytda API xatosida fallback qilmaydi va aniq sabab ko‘rsatadi. O‘zgarish `Sarcobo1/dubanix` bot reposiga `15df0e1460683978eb27640a83d752a3b2c72b31` commitida push qilindi; Render deploy, undagi `SITE_API_KEY` ni `.env.local` dagi amaldagi `ANIME_BOT_API_KEY` bilan tenglashtirish va yangi linking token ishlatish kerak.

- Xariddan keyin yoki Telegram account link qilinganda bot endi barcha mavjud videolarni avtomatik yubormaydi. `/my_library` (`/library` alias ham bor) anime tanlash ro‘yxatini ochadi; faqat tanlangan anime qayta yuboriladi. Xariddan keyin My Library’ni ochish haqida xabar bor; command menu va bot README yangilandi. Render logidagi 401 xarid oqimidan alohida: xarid botning `API_KEY` yo‘nalishini, account link esa `SITE_API_KEY`/saytning effektiv `ANIME_BOT_API_KEY` kalitini tekshiradi. Sayt DB’sidagi `marlon` akkauntida Telegram ID hozircha yo‘q; `.env.local` kaliti bilan Creator endpoint auth’dan o‘tib 403 qaytargan, ya’ni kalitdan keyin bot Telegram ID / sayt Creator identity mosligi ham tekshirilishi kerak.

## 1-qism (poydevor)

- Prisma foundation + telegramId, sessions, versions, credit_ledger.
- Telegram HMAC (`src/lib/telegram-auth.ts`), link token + `POST /api/bot/consume-link`.
- RBAC, rate limit, `/health` JSON, i18n uz/en, `I18nProvider`.
- `.env.example`, `docker-compose.yml`.
- Testlar: HMAC, RBAC.

## 2-qism (Stars/kredit)

- `CreditPackage.starsPrice` (dollar emas). Invoice `POST /api/credits/invoice` → bot `create_invoice_link` XTR.
- Bot: `/api/invoice`, pre_checkout, successful_payment → `/api/webhooks/telegram-stars`.
- Idempotent `telegramChargeId`; refund clawback floor 0.
- Credits UI Stars invoice (simulyatsiya yo‘q).
- Creator share 70/30 `PlatformConfig`.

## 3-qism (katalog/studio/delivery)

- Official vs creator `AnimeVersion`; purchase unique `(user, version, episode)`.
- Detail versiya tanlash; “Tez kunda sotuvda” catalog versiya bo‘lsa yashiriladi.
- Bot Admin: `role === ADMIN` + env Telegram IDs (server `isAdminUser`); SmartImage.
- Bot: consume-link, ingest-episode, refund-stars.
- Delivery: grant faqat ownership yozilgandan keyin.

## 4-qism (Gift)

- Exchange **arxiv** (jadval o‘chirilmagan): `/api/exchange*` 410/bo‘sh, nav Gift.
- `Gift.versionId`; send even if sender owns; claim/decline; expire 14 kun; refund ledger; creator share; XP.
- UI: `/gifts`.

## 5-qism (Community)

- Real DB-backed community layer: `posts`, `comments`, `post_likes`, `post_bookmarks`, `follows`, `post_awards`, `reports`, `notifications`, `community blocks` va `community` statistikalar Prisma schema orqali saqlanadi.
- Feed: `Latest / Top / Following`, haqiqiy kategoriya filtrlari (`Theories`, `Reviews`, `Discussions`, `Memes`, `Fan Art`, `Recommendations`, `UZ Dubbing`, `Watch Parties`), cursor pagination va real `db.post.findMany` so'rovlari.
- Post lifecycle: yaratish/tahrirlash/o'chirish, spoiler/rating/anime biriktirish, rasm validatsiyasi, markdown sanitization (`sanitizeText`) va XSS himoyasi.
- Social actions: like/unlike, bookmark, comment/reply, share link, follow/unfollow, notification yaratish.
- Award: atomik `post_award` tranzaksiya — user credits decrement, author share increment, ledger yozuvi, idempotency key, duplicate-blocking, insufficient-credit guard.
- Moderatsiya: report qilish, admin queue, content/user block, rate limit asosida spam himoyasi, community rules bloc.
- Sidebar stats: real `community/stats` API orqali `Trending Anime`, `Top Contributors`, `Online`, `Posts Today`, `Watch Parties` (faqat real ma'lumot; bo'sh holatlarga placeholder yo'q).
- Realtime: feed polling + notifications polling (`30s` / `20s`), real time refresh uchun UI re-fetch.
- Testlar: `src/lib/community.test.ts` uchun post/like/comment/reply persist, authorization, atomic award flow, insufficient credit path.

## Test

`npx tsx --test src/lib/community.test.ts` — community persistence, permissions, atomic award flow.
`bun test src` — HMAC, RBAC, gift expiry.

## Stars test mode

BotFather → Payments → Telegram Stars. Invoice: `currency=XTR`, `provider_token=""`.

## Ogohlantirish

`.env` commit qilinmasin. `ANIME_BOT_API_KEY` bot token bo‘lmasin.

## O‘zgargan asosiy yo‘llar

- `prisma/schema.prisma`, `prisma/migrations/20261014201500_gifts_archive_exchange/`
- `src/lib/gifts.ts`, `economy.ts`, `stars.ts`, `owns.ts`
- `src/app/api/gifts/*`, `credits/invoice`
- `/home/limi/Downloads/BOT/bot.py`

## 6-qism (Profile / Analytics / Leaderboards) — yakun

- Profil ko‘rsatkichlar real sanadagi ma’lumotlardan chiqarildi: owned, watch time, followers, posts, collection, favorites, activity va posts hisoblari DB bilan bog‘landi.
- Edit Profile haqiqiy saqlanishi va privacy qoidalari ishladi: banner/avatar upload/storage, accent, display name, pronouns, country, tagline, about me sanitization, timezone, social links, status, top 5, genres, achievements showcase, pinned post, section order/visibility, profile visibility (`everyone` / `followers` / `private`). Premium GIF/animated banner cheklovi serverning `showcase.unlocked` ma’lumotidan tekshirilib qo‘llanildi.
- Boshqa user profiliga follow/unfollow va popup profile card real ma’lumotlar bilan ishladi; follow qoidalari serverda `allowFollows` + privacy bilan himoyalandi.
- UI tozalash qismi: activity matnli xatolar, mixed-language hardcoded tekstlar i18n dictlari bilan qamrab olindi; `activity` / `posts` labellar i18n taqdimotidan ishladi.
- Anime detail statistikasi real DB hisobidan qaytarildi: collector count, community rating, catalog rating, favorites, status, `More like this` janr/teg o‘xshashligi bo‘yicha real hisoblash.
- Leaderboards real so‘rovlar orqali ishladi: Top Collectors, Top Contributors, Top Creators; community sidebar Top Contributors shu manbadan olindi.
- My Library real ma’lumotlar bilan ishladi: owned / favorites / stars purchase tabs, credit balance ledger asosida, watch time va episodes completed `watch_events` yordamida hisoblandi.
- Testlar qo‘shildi: profile privacy/visibility, save-persist, analytics aggregate, watch-time accuracy, public profile privacy logic.

Shartlar bo‘yicha: ma’lumotlar DB dan keladi; profil o‘zgarishlari saqlanadi va boshqa foydalanuvchi ko‘ra oladi (privacy bilan); anime detail va leaderboardlar real statistikani qaytaradi; testlar o'tadi.

## 7-qism (Level / XP / Achievements)

- XP yagona manbasi `XpEvent`: jami XP va level serverda eventlar yig‘indisidan hisoblanadi. Level egri chizig‘i va event qiymatlari `src/lib/xp.ts` dagi `XP_CONFIG` orqali boshqariladi; level chegaralari 100 bilan cheklangan.
- XP award idempotent va tegishli purchase, gift claim/send, post, comment, like, watch-time/completion tranzaksiyalariga biriktirildi. Like XP liker/post juftligi bo‘yicha bir marta yoziladi; gift claim’da ownership, claim status va received XP bir tranzaksiyada saqlanadi.
- `User.xpTotal` olib tashlandi; migratsiya mavjud XP-eventlar bilan farqni backfill qilib, eski umumiy XP’ni saqlaydi. Profil, community post/comment va leaderboard level’lari bir xil XP hisobidan olinadi.
- Level-up notification hamda 5/10/25/50-level kosmetik mukofotlari; achievement va anime-set bonuslari DB transaction + ledger orqali beriladi.
- Achievement katalogi 49 ta data-driven yozuvdan iborat. Progress xarid, sovg‘a, watch, social, creator, favorite, seasonal va secret shartlaridan DB’da hisoblanadi; unlock, reward va notification idempotent. Secret shartlar ochilmaguncha yashiriladi; eski Exchange Master yozuvlari nofaol qilinadi.
- Anime collection set’larini administrator boshqarishi uchun `GET/POST/DELETE /api/admin/achievements/sets` qo‘shildi. Set completion bonuslari foydalanuvchiga bir marta yoziladi.
- Favorite/follow, creator anime moderation approval va creator sale hodisalari achievement progress’ini qayta hisoblaydi.
- Tekshiruv: `npx tsx --test src/lib/*.test.ts` — 23 test o‘tdi; `npx prisma validate` — schema yaroqli. `npx tsc --noEmit` hali mavjud mustaqil xatolar bilan to‘xtaydi (`socket.io` dependency/importlari, `mini-services/watch-party` typing, `scripts/seed.ts` inference va `telegram-auth.test.ts` dagi `node:test` importi).

## 8-qism (Watch Together) — amalga oshirildi, deploy tekshiruvlari qolgan

- Web o‘ynatish manbasi audit qilindi: mavjud Telegram file/message ID brauzer uchun HLS manbasi emas. Yangi creator uploadlari Cloudflare Stream’ga yuboriladi, `streamId` saqlanadi va autentifikatsiya hamda anime ownership/free holati tekshirilgandan keyin signed HLS playback URL beriladi. Mavjud Telegram-only epizodlar migratsiya qilinmaguncha aniq HLS-mavjud-emas holatini qaytaradi.
- Party yaratish va kod bilan qo‘shilish DB orqali; kod 6 belgili, party 8 soat amal qiladi, sig‘im 50. Anime bepul yoki user xarid qilgan bo‘lishi serverda tekshiriladi. Community Watch Parties faqat muddati tugamagan, faol ishtirokchisi bor partylarni ko‘rsatadi.
- Socket.IO service imzolangan, muddati cheklangan ticket va DB membership/host tekshiruviga asoslangan. Playback server holati va vaqti authoritative; faqat host play/pause/seek/rate boshqaradi. Disconnect’dan keyin 30 soniyalik grace bilan qayta ulanishda holat tiklanadi; oxirgi host chiqsa host o‘tkaziladi yoki party tugatiladi. Ko‘p instance uchun `REDIS_URL` orqali Redis adapter optional.
- Client ping/pong clock offset’i bilan playback drift’ni hisoblaydi: 0.5 soniyadan katta farqda seek, kichik farqda ±5% playbackRate correction. HLS preload, autoplay bloklanganida foydalanuvchi gesture’i bilan audio boshlash, local mute/volume saqlash bor; mikrofon/voice chat yo‘q.
- Party chat DB’da saqlanadi va 50 xabardan iborat oxirgi tarix bilan qayta tiklanadi; matn sanitizatsiya qilinadi. Reaksiyalar throttle va ruxsat etilgan emoji ro‘yxati bilan cheklangan. Heartbeat, bo‘sh/muddati o‘tgan party cleanup va `party_hosted` / `party_joined` XP-achievement hodisalari ulandi.
- Service Node/tsx orqali ishga tushadi; `.env.example` Cloudflare Stream, party secret/origin/port, shared database va optional Redis sozlamalarini hujjatlashtiradi. Prisma schema va migratsiyada HLS stream ID, party lifecycle, creator va activity indekslari qo‘shildi.
- Tekshiruv: `npx tsx --test src/lib/watch-party.test.ts` — 4 test o‘tdi. Ikki client’da play/pause/seek, host ruxsati, reconnect/state recovery, HLS ownership/free access, signed ticket, drift correction hamda 50 client broadcast testlandi. 9-qism yakunidagi simulyatsiya: 50 client connect **492.25 ms**, playback update broadcast **39.36 ms**.
- `npx eslint` o‘zgargan Watch Together fayllari uchun o‘tdi; `npx prisma validate` o‘tdi. `npx tsc --noEmit` Watch Together o‘zgarishlari bo‘yicha xatolarsiz, lekin repo’dagi oldindan mavjud xatolar sabab to‘liq o‘tmaydi: `examples/websocket/server.ts` da yo‘q `socket.io` importi, `scripts/seed.ts` inference xatolari va `telegram-auth.test.ts` dagi noto‘g‘ri `node:test` importi.
- Deploy/real-browser tekshiruvlari hali bajarilmadi: Cloudflare credentiallari bu muhitda yo‘q, migratsiya production DB’ga qo‘llanmagan. Deploy’da `CF_STREAM_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`, kamida 32 belgili bir xil `WATCH_PARTY_SECRET`, umumiy `DATABASE_URL`, allowed origin va migratsiya talab qilinadi; bir nechta socket instance uchun `REDIS_URL` ham kerak. HLS credentiallar va real brauzerlar bilan sinovsiz audio/HLS acceptance tasdiqlanmaydi.

## 9-qism (Schedule / AI Dubbing / yakuniy tayyorlash)

- Schedule eslatmasi DB obunasiga ulandi: AniList media ID bo‘yicha subscribe/unsubscribe, `ScheduleDelivery` idempotency/claim/retry holatlari va user’ning IANA timezone’i. Telegram ID bog‘langan userlarga epizod efir vaqti yaqinida protected cron orqali xabar yuboriladi; timezone noto‘g‘ri yoki bo‘sh bo‘lsa `Asia/Tashkent`. Cron har daqiqada tashqaridan chaqirilishi va `CRON_SECRET` bilan himoyalanishi kerak.
- AniList schedule API 10 daqiqalik cache, 8 soniyalik timeout, days input validation va API response tekshiruvi bilan mustahkamlandi. Jadvaldagi common raw format enum’lar o‘qiladigan matnga aylantirildi; manba yiqilganda empty/error state ko‘rsatiladi.
- AI Dubbing UI sahifasi va desktop/tablet/mobile navigatsiyasi “Soon” holatiga o‘tdi. Eski soxta processing/credit-charge backend o‘chirildi (`410`); authenticated waitlist DB’da qo‘shish/olib tashlash bilan ishlaydi.
- Deploy materiallari: `Dockerfile`, `.dockerignore`, SQLite + Redis + bot + Socket.IO uchun Compose, migration startup, healthcheck, Sentry hook, maxfiy `.env.example`ni git’da ko‘rsatish istisnosi, README va final report. `typescript.ignoreBuildErrors` olib tashlanib, `sharp` patched versiyaga yangilandi; patched transitive overrides qo‘llandi.
- Tekshiruv: `npm test` — 28 passed; `npx prisma generate && npx tsc --noEmit` — passed; `npm run build` — passed; `npx eslint` o‘zgargan kod uchun — passed; Prisma migratsiyalari disposable SQLite’da boshidan oxirigacha muvaffaqiyatli qo‘llandi. `npm audit --omit=dev` — 0 vulnerabilities. Full `npm audit` faqat dev-only `eslint-config-next` dependency chain’dagi 5 high `braces` advisory’ni ko‘rsatadi.
- Browser smoke test: production build Home shell, Schedule real AniList entries/translated formats, AI Dubbing Soon sahifalari ko‘rildi; migrated temporary DB bilan `/api/health` `200` va DB `up`. Eski local `db/custom.db` migratsiyasiz bo‘lgani uchun unda community API 500 qaytardi; DB’ni o‘zgartirmadim. Docker mavjud emasligi sabab Compose build/start sinovi bajarilmadi.
- Qolgan: full `npm run lint` 16 ta mavjud React-hook/immutability xatosi bilan yiqiladi (o‘zgargan qismlardan tashqari fayllarda); barcha sahifalar va production console’ni to‘liq ko‘zdan kechirish tugallanmagan. Telegram/Stars/Cloudflare va real two-browser integratsiyalari credential hamda staging talab qiladi; shuning uchun acceptance / deployment completed deb belgilanmaydi. `FINAL_REPORT.md` da ma’lum bloklar, startup/deploy va huquqiy qadamlar yozilgan.

## UI tab QA follow-up (2026-10-15)

- Tablet rail navigation endi nav bosilganda kutilayotgan hover-open timerini bekor qiladi va overlay’ni yopadi; expanded sidebar ichidagi sahifa navigatsiyasi ham overlay’ni yopadi. Viewer uchun qulflangan Creator Studio tablet rail, sidebar va desktop navigatsiyada route almashtirmaydi, izohli toast ko‘rsatadi.
- Community moderation API endi faqat ADMIN rolida chaqiriladi. Viewer sessiyasidagi oldingi bekor `403` browser console xatolari yo‘qoldi; community feed/statistika/notifications `200` qaytardi.
- AI Dubbing view-ning nested `<main>` landmark-i `<div>`-ga almashtirildi; sahifada duplicate main landmark qolmadi.
- Browser QA: Home, Discover filter/clear, Schedule haftaning 7 kuni, Community 9 kategoriya va Latest/Top/Following, Dubbing waitlist join/leave, Watch Together, Library Owned/Favorites/Stars/Leaderboards, Gifts, Credits, Settings, profilning 5 bo‘limi va profil modal/full-page yo‘llari ko‘rildi. Disposable, barcha migratsiyalari qo‘llangan SQLite bazasi va test akkaunt ishlatildi; Stars xaridi, party yaratish va boshqa real tashqi yon ta’sirlar bajarilmadi.
- QA vaqtida API `4xx/5xx` yoki uncaught browser xatolari qayd etilmadi (bekor admin `403` tuzatilgandan keyin); bo‘sh kolleksiya/favorites/community holatlari DB bo‘shligi uchun to‘g‘ri empty state ko‘rsatdi.

## Production database setup — Neon PostgreSQL (2026-10-15)

- Foydalanuvchi Neon PostgreSQL tanladi va mavjud SQLite ma’lumotlarini ko‘chirmaslikni tasdiqladi. Web va Watch Together Prisma datasource PostgreSQL bo‘ldi: pooled `DATABASE_URL` runtime uchun, direct `DIRECT_URL` migration uchun.
- SQLite’ga tegishli eski migration tarixi o‘chirilmay `prisma/sqlite-migrations-archive/` ichiga ko‘chirildi; joriy `prisma/migrations/` uchun schema’dan yangi PostgreSQL initial migration yaratildi. Production schema yangi bo‘sh Neon bazasiga mo‘ljallangan.
- Docker Compose endi SQLite volume o‘rniga Neon pooled/direct URL’lardan foydalanadi; Docker build PostgreSQL client generate qiladi. `.env.example`, README backup/deploy/env ko‘rsatmalari PostgreSQL/Neon uchun yangilandi.
- PostgreSQL client bilan birga mavjud SQLite-based unit/integration testlarni lokal ishlatish uchun `npm test` vaqtincha test Prisma schema/client yaratadi va yakunda PostgreSQL client’ni qayta generatsiya qiladi; real production client testlar orasida SQLite’ga almashtirilib qolmaydi.
- Tekshiruv: `npm test` — 28/28 o‘tdi; temporary SQLite test client’dan keyin PostgreSQL client tiklandi. `npx prisma validate`, `npx tsc --noEmit`, `npm run build`, targeted ESLint va Compose YAML parse o‘tdi. PostgreSQL migration SQL schema’dan generatsiya qilindi (1019 qator), ammo serverga ulanib qo‘llash hali bajarilmadi.
- Dastlab Neon hali ulanmagan edi; keyingi "Neon connection follow-up" bo‘limida URL’lar, migration va health-check yakunlari qayd etilgan. Eski local SQLite bazasi ataylab ko‘chirilmagan va o‘zgartirilmagan.
- User Neon pooled/direct URL’larini xato qilib `.env.example`ga qo‘ygan; qiymatlar secretsiz tekshirildi, `.env`ga ko‘chirildi, `.env` permission `600` qilindi va `.env.example` placeholdersga qaytarildi.
- Neon `prisma migrate deploy` P3005 bilan rad etdi, chunki joriy `public` schema bo‘sh emas. Faqat o‘qish tekshiruvda botga tegishli `animes`(13), `episodes`(73), `purchases`(6), `users`(1), `deliveries`(3), `deleted_animes`(2), `link_tokens`(0) aniqlandi. Hech bir migration/data yozuvi qo‘llanmadi. Web Prisma’ni shu DB ichida alohida `dubanix_web` schema’ga joylash yoki alohida Neon database/proyekt ishlatish haqida user qarori kerak.

## Neon connection follow-up

- User shu Neon bazasini tanlab, web ma’lumotlarini `dubanix_web` schema’da alohida saqlashga ruxsat berdi. `DATABASE_URL` (pooled) va `DIRECT_URL` (direct) ikkalasiga `schema=dubanix_web` o‘rnatıldı.
- PostgreSQL initial migration `dubanix_web` schema’ga ko‘chirildi ва `npx prisma migrate deploy` muvaffaqiyatли; Prisma миграция ҳолати `Database schema is up to date!` деб тасдиқланди. База текширувида web schema’да 43 жадвал/0 user бор; аввалги bot `public` жадвалларидаги қаторлар сони ўзгармаган.
- Production standalone’ни private `.env` қийматларини жараён муҳитига бериб ишга туширганда `/api/health` `200`, `db: up` қайтарди. Neon сирлари терминал натижасида чиқарилмади; `.env` permission `600`, `.env.example` placeholder’да қолди.

## Current Neon status (2026-10-15)

- Sayt pooled/direct URL’lari endi `.env`da maxfiy saqlanadi va ikkalasi `dubanix_web` schema’ga qaraydi. `.env.example` faqat placeholder saqlaydi.
- Neon migratsiyasi qo‘llandi. `dubanix_web` schema’da 43 sayt jadvali, hozircha 0 sayt akkaunti bor. Botning `public` schema’dagi mavjud anime/episode/purchase/user qatorlari avvalgidek saqlangan.
- Production health tekshiruvi: HTTP 200, database `up`. Saytning real userlari ro‘yxatdan o‘tgach shu Neon schema’da saqlanadi. Mavjud bot katalogini saytga ko‘chirish/sinxronlash bajarilmagan.

## Home and login artwork (2026-10-16)

- Home API now uses up to five real approved catalog anime as hero slides when no anime has the editorial `featured` flag; it still prefers explicitly featured anime when present. The badge distinguishes catalog fallback titles from editorially featured titles.
- Restored the login cinematic artwork through the same live hero list. Reduced the home hero gradient opacity so the real banner artwork remains visible behind readable text.
- Verified local `/api/home` returned five catalog-backed hero records with image URLs while none were editorially featured; browser confirmed the hero and login image load from those records. Targeted ESLint and `git diff --check` passed.

## Community stats and anime detail fixes (2026-10-16)

- Fixed raw SQL table casing and schema qualification for PostgreSQL using the configured `schema` URL parameter, while keeping SQLite test-database compatibility. Applied to contributor/collector leaderboard queries, community trending stats, and anime collector counts.
- Fixed community trending aggregation to count distinct likes and use PostgreSQL boolean literals.
- Limited the home hero title to two lines to prevent long catalog titles from overwhelming the layout.
- Verified on the running local Neon-backed site: `/api/community/stats` returns HTTP 200 and real empty-state values; `/api/animes/horimiya-the-missing-pieces` returns HTTP 200; opening its detail route displays the anime without the previous load error. Community page shows real empty states rather than a statistics error. Existing 28-test suite passed; affected-file ESLint, TypeScript, Prisma validation and `git diff --check` passed.

## Home card title compacting (2026-10-16)

- Home ranked cards now show anime titles on one truncated line; free-anime cards use the same compact title treatment only on Home. Full titles remain available via the title tooltip and accessible card labels. Other library/browse cards retain their existing two-line titles.
- Verified title styling in the local browser (`nowrap` + ellipsis); targeted ESLint, TypeScript, and diff checks passed.

## Creator Studio ↔ Telegram bot uploads (2026-10-16)

- Added a protected bot-to-site Creator API. It checks the shared bot API key, exact linked Telegram ID, and current site role on every list/create operation; Viewer accounts cannot list or upload Creator content. The anime creation transaction writes the owned anime and its pending creator version together; uploads remain hidden until moderation approval.
- Added bot `/my_animes` and `/upload_anime` commands. Creator uploads a poster with the provided caption template, then sends episode videos with `#anime-slug 1-qism — Qism nomi`. The bot normalizes media captions, posts files to the configured channel, stores Telegram message IDs in the bot database and web episode rows, and rolls back failed cross-service writes where possible. Own channel posts carry a non-visible marker to avoid being re-ingested as generic public catalog updates.
- Creator Studio now shows Telegram link state, bot commands, required caption formats, moderation state, and an explicit note that Telegram-only episodes are delivered through the bot (not browser HLS). Removed the sample-video URL buttons so episode upload UI no longer suggests demo media.
- Stable upload slugs make anime retries idempotent. Added a unique `(versionId, number)` episode constraint and migration to prevent concurrent duplicate episode numbers.
- Tests cover API key enforcement, Viewer denial, Telegram-link identity, per-creator anime isolation, idempotent anime create, and episode persistence/duplicate rejection.
- Verification: `npm test` — 30 passed; `npx tsc --noEmit`, targeted ESLint, `npx prisma validate`, bot Python AST syntax check, and changed-file `git diff --check` passed. Import-level bot smoke test could not run in the configured system Python because `asyncpg` is not installed. No live Telegram token/channel or production bot endpoint was exercised; deployment still requires matching `ANIME_BOT_API_KEY`/`SITE_API_KEY`, `SITE_API_URL`, `PUBLIC_URL`, and bot administrator access to `CHANNEL_ID`.

## Community cache and credits recovery (2026-10-16)

- Added a root TanStack Query provider with bounded browser cache defaults. Anime detail requests now use a per-anime/per-user cache key and 30-second stale window; rating and favorite mutations update the local detail cache without exposing one user's ownership/rating state to another.
- Community feed refreshes every 3 seconds; open comment threads are cached per user and post, immediately show cached/newly submitted comments, then poll incremental cursor results every 2 seconds. Background polling pauses in hidden tabs. Feed state reloads when the signed-in user changes. This environment has no deployed WebSocket transport, so the live-update fallback is polling.
- Moved the anime detail Telegram episode lookup out of the response path using Next.js `after()`, with a per-process 60-second cooldown and batch idempotent episode inserts. Detail page loads no longer wait for the bot API round trip.
- Fixed the Credits API's achievement seed timeout by replacing 49 sequential upserts inside one interactive transaction with one parameterized, idempotent `INSERT ... ON CONFLICT DO UPDATE` statement, while preserving administrator-managed inactive flags. Credits UI now checks non-2xx API responses and isolates cached transaction data by user.
- Reduced the Top Contributors/leaderboard in-process cache lifetime from 60 to 10 seconds.
- Verification: `npm test` — 30 passed; targeted ESLint, `npx tsc --noEmit`, and `npx prisma validate` passed. Local `/api/credits` and `/api/community?tab=latest` smoke tests both returned HTTP 200; credits response included the configured real packages. Browser QA opened Community and Credits with their live empty/package states and no load error. `git diff --check` passed.

## Auth session startup delay fix (2026-10-16)

- Removed the auth bootstrap's hard 3-second abort, which could classify a slow Neon/session query as a signed-out user. Session hydration now allows 8 seconds per attempt, retries one transient failure, checks HTTP status, and does not let an older `/api/auth/me` response overwrite a user who has just signed in or registered.
- `/api/auth/me` previously ran its XP aggregate only after three ownership/creator counts completed. Those four independent DB queries now run in parallel; session responses are explicitly `no-store`.
- Registration's duplicate email and username checks now run concurrently, removing an avoidable serialized DB round-trip before account creation.
- Database errors during session lookup are no longer silently converted into `user: null`; they surface as server errors so the client retries rather than mistaking a transient database problem for logout.
- Verification: local anonymous `/api/auth/me` returned HTTP 200 in 0.24 seconds; browser refresh kept the signed-out state consistent. `npm test` — 30 passed; `npx tsc --noEmit`, targeted ESLint, `npx prisma validate`, and `git diff --check` passed. Registration with a real new account was not submitted during smoke testing to avoid creating a disposable user in the live Neon database.

## Profile load failure fix (2026-10-16)

- Traced “Couldn't load profile” to `GET /api/users/[username]` invoking achievement evaluation during a profile read. That evaluator performs many sequential writes in a single interactive transaction and exceeded the database transaction timeout (`P2028`), returning HTTP 500. Achievement checks are already triggered by relevant write events, so profile reads now only fetch persisted achievement state and no longer mutate/evaluate achievements.
- Profile modal and full-page profile fetches now use encoded usernames, `no-store`, abort stale requests when closed/navigated, and surface the API's actual error message rather than silently leaving an empty profile.
- Verification: profile API returned HTTP 200 locally; browser loaded `/user/marlon` with profile details and no load error. Full `npm test` — 30 passed; TypeScript, profile-file ESLint, and `git diff --check` passed. One attempted standalone test invocation failed because its test Prisma schema is generated/cleaned by the repository test runner; full `npm test` completed successfully afterward.

## Profile popup sizing (2026-10-16)

- Increased the profile popup maximum width to 420px, made the modal wrapper explicitly responsive (`viewport width - 24px` on narrow screens), and slightly enlarged banner, avatar, and card padding. This fixes the popup shrinking to intrinsic content width on small screens.
- Verification: targeted ESLint, TypeScript, and `git diff --check` passed.

## Profile popup load performance (2026-10-17)

- Added a lightweight `?view=card` response to the user profile API. It enforces the same follow/privacy rules while replacing the full profile's many table reads and achievement state load with one aggregated stats query; sensitive responses are private/no-store.
- The popup now uses the lightweight response, hides details not needed in its compact view, and keeps a 30-second user-scoped TanStack Query cache so reopening the same card is immediate without mixing signed-in users' privacy/follow state.
- Verification: local lightweight profile API returned HTTP 200 in 1.11 seconds; `npm test` — 30 passed, TypeScript, Prisma validation, targeted ESLint, and `git diff --check` passed.

## Free-tier R2 media and paid Watch Together (2026-10-17)

- New profile avatar/banner, community image, and creator cover uploads now write to R2; generated profile variants are WebP objects, old R2 uploads are deleted on replacement, and local legacy `/uploads/` cleanup remains supported. Catalog artwork supplied by external services is not yet mirrored into R2.
- Added a private-bucket Cloudflare Worker that serves public image keys and HMAC-signed, short-lived HLS access. Added an episode `hlsKey` column/migration, server-side ownership checks, and Creator Studio flow that reports the exact R2 object prefix for manually prepared HLS files. New video files remain Telegram bot uploads; direct Cloudflare Stream upload was removed from the creator endpoint. Legacy Stream playback remains supported.
- Added a local HLS-to-R2 uploader script and FFmpeg/R2 Worker setup steps. The R2 bucket must stay private and be bound to the media Worker; `R2_PUBLIC_BASE_URL` points to that Worker custom domain.
- Watch Together now charges each new party participant (host included) the configured positive `WATCH_PARTY_JOIN_PRICE_CREDITS` amount, default 5. Credit debit, ledger entry, and party membership/creation share one database transaction; repeat entry does not double-charge.
- `.env.example` contains empty credential placeholders. R2 and Cloudflare Stream secret values previously present in that sample were removed; rotate those keys before production use.
- Verification: `npm test` — 34 passed, including R2 HLS URL validation, Worker signature/playlist rewriting, and transactional/idempotent party-credit debit. `npx tsc --noEmit`, targeted ESLint, `npx prisma validate`, JavaScript syntax checks, and `git diff --check` passed.
- Deployment is still pending: no R2 endpoint was contacted, the Cloudflare Worker has not been deployed or bound to the future `.uz` media domain, and the new Prisma migration has not been applied to production.

## Kiluu brendingi, welcome loader va navbar bildirishnomalari (2026-10-18)

- Saytning ko‘rinadigan brend nomlari logotip, sahifa metadata/PWA manifesti, kirish va onboarding, Creator Studio, community qoidalari, sozlamalar, anime ulashish matni, rasmiy anime versiyasi va Stars invoice yuzalarida Kiluu bilan almashtirildi. Eski Telegram bot username’i hamda localStorage kalitlari moslikni saqlash uchun o‘zgartirilmadi.
- Welcome loader endi 8 ta tilni ketma-ket ko‘rsatadi; app tayyor bo‘lsa kamida to‘liq til aylanishidan keyin yopiladi, tayyor bo‘lmasa ham fade bilan birga ko‘pi bilan 2 soniyada yopiladi.
- Community sahifasidagi qo‘ng‘iroqcha olib tashlandi. Navbar qo‘ng‘iroqchasi DB notification API’ga ulanib, o‘qilmaganlar soni, bildirishnomalar ro‘yxati va bittasini yoki barchasini o‘qilgan deb belgilashni ko‘rsatadi. API XP `LEVEL_UP` bildirishnomalarini ham qaytaradi; navbar qo‘ng‘iroqchasi kichik ekranlarda ham ko‘rinadi, mobile menu’dagi soxta Alerts tugmasi olib tashlandi.
- Хувилбарын дараагийн шалгалт: targeted ESLint, TypeScript, тестүүд, `git diff --check` болон локал браузерын welcome/navbar шалгалт.

## Tasdiqlangan belgi chegarasi (2026-10-18)

- Tasdiq belgisi endi server hisoblagan follower soniga bog‘landi: faqat kamida 1 000 followerli profil, community posti va anime creatorida ko‘rinadi. Followerlar ro‘yxati maxfiy bo‘lsa ham, mezon yashirilgan real DB soni bilan baholanadi.
- Tekshiruv: 999, 1 000 va 1 001 chegaraviy testi qo‘shildi; `npm test` — 38 ta test o‘tdi, `npx tsc --noEmit`, o‘zgargan fayllar ESLint’i va `git diff --check` muvaffaqiyatli.

## Til tanlovi, English matnlari va mobil dock (2026-10-18)

- Mavzuni almashtirgandagi `Theme: dark/light/system` toast olib tashlandi. Til tanlovi endi i18n provider’ni o‘zgartiradi, localStorage’da saqlanadi va HTML `lang` atributini yangilaydi; “full translation coming soon” toast yo‘q qilindi.
- Til lug‘atlari uz/en/ru/kk/ky uchun kengaytirildi; profil bo‘limlari, nav elementlari va guruh nomlari tanlangan tilga ulandi. Inglizcha interfeysda topilgan o‘zbekcha communityga tegishli bo‘lmagan website/API matnlari inglizchalashtirildi.
- Mobil pastki dock’dagi My Library o‘rniga Community tab qo‘yildi; Library menu orqali saqlanib qoldi.
- i18n smoke test qo‘shildi. Yakuniy tekshiruv: `npm test` — 39/39 o‘tdi; `npx tsc --noEmit`, tarjima/navigatsiya fayllari ESLint’i, locale JSON parse va `git diff --check` muvaffaqiyatli. Kengroq ESLint tanlangan eski fayllardagi avvaldan mavjud React effect/immutability qoidalarini ham ko‘rsatadi.

## 10-qism (Klublar, team chat va Cloudflare real-time)

- **Maqsad:** Community'ga Klublar (jamoaviy chat), Global Chat ("umumiy zal") va Anime xonalari ("Muhokama") qo'shildi. Real-time qatlami Cloudflare Workers + Durable Objects (WebSocket Hibernation API) orqali bepul reja doirasida qurildi.
- **Durable Objects & WebSocket Hibernation API:**
  - `realtime-worker/src/index.ts` da `ChatRoom` Durable Object sinfi `ctx.acceptWebSocket(server, tags)` yordamida hibernation rejimida ishlaydi. Bo'sh xonalar CPU duration limitini yemaydi (Cloudflare rasmiy hujjatidan: developers.cloudflare.com/durable-objects tasdiqlandi). Bo'sh turgan xona uxlash rejimiga o'tadi va faqat xabar kelganda uyg'onadi.
  - Avtomatik `setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"))` orqali ping-pong so'rovlari Worker kodi uyg'onmasdan Cloudflare edge infratuzilmasida yechiladi.
- **Arxitektura va Xavfsizlik:**
  - Brauzerlar xabarni Vercel API ga yuboradi (`POST /api/chat/rooms/:id/messages`).
  - Vercel barcha tekshiruvlarni bajaradi: autentifikatsiya, xona a'zoligi, ban/mute holati, rate limit (5 xabar / 10 soniya), sekin rejim (slow mode), 2000 belgi limiti, spoiler teglari va XSS sanitizatsiyasi.
  - Neon PostgreSQL'ga xabar yozilgach, Vercel `POST /push/:room` orqali Worker'ga Bearer auth (`REALTIME_PUSH_SECRET`) bilan yuboradi. Worker esa barcha ulangan WebSocket mijozlariga tarqatadi.
  - WebSocket autentifikatsiyasi: Vercel 5 daqiqalik `HS256` imzolangan JWT beradi (`POST /api/chat/token`). Worker tokenni tekshiradi va mos bo'lmagan ulanishlarni darhol rad etadi.
- **Ulanishni tejash va Polling Fallback:**
  - `RealtimeClient` (`src/lib/realtime-client.ts`): Bitta brauzerda bir nechta tab ochilsa `BroadcastChannel` orqali Leader tab saylanadi va faqat bitta WebSocket ulanish ochiq turadi.
  - Tab 5 daqiqa yashirin (`document.hidden`) tursa, DO duration tejash maqsadida ulanish uziladi; tab faollashganda darhol qayta ulanadi.
  - Worker ulanish bermasa, kvota tugasa yoki tarmoq uzilsa mijoz avtomatik ravishda polling rejimiga (`GET /api/chat/rooms/:id/messages?after=...` har 3.5 soniyada) o'tadi va UI'da "Sekin rejim" ko'rinadi. Chat hech qachon to'xtamaydi.
- **Klub Tizimi va Narx:**
  - Birinchi klub: **mutlaqo bepul** (kamida 10-daraja talab qilinadi).
  - Keyingi klublar: har biri 200 kredit (50 Stars ekvivalenti).
  - Foydalanuvchi ko'pi bilan 1 ta klub yaratishi va 3 tagacha klubga a'zo bo'lishi mumkin.
  - Noyob 2-4 belgili TAG (`[TAG]`), nom, tavsif, banner, ochiq/yopiq format.
  - Rollar: Egasi (Owner), Moderator, A'zo. Owner va mod boshqaruv imkoniyatlari (mute, kick, qoidalar, sekin rejim, taklif kodlari).
  - Klub XP va darajasi (1-20): xabar yozish (5 XP), yangi a'zo (20 XP).
- **Chat Imkoniyatlari:**
  - Anime kartasi: Ko'rish / Sotib olish / Sovg'a qilish tugmalari bilan to'g'ridan-to'g'ri integratsiya.
  - Spoiler himoyasi: "Anime X, N-epizod" xabarlari tomosha qilmagan foydalanuvchilar uchun blurlangan bo'ladi va bosilganda ochiladi (server `watch_events` orqali tekshiriladi).
  - Level, titul va avatar ramkasi har bir xabar egasi yonida ko'rsatiladi.
  - Reaksiyalar, javob (reply), qadash (pin), o'chirish/tahrirlash, so'rovnomalar (poll).
  - 90 kundan eski qadalmagan xabarlarni tozalash cron endpointi (`/api/cron/chat-retention`).
  - Telegram bot bildirishnomasi: mention (`@username`) va javoblar uchun bot orqali bildirishnoma (bir xil xonadan 5 daqiqalik anti-spam filtri bilan).
- **Bepul Reja Kvotalari va Hisob-kitob:**
  - Cloudflare Workers Free: Kuniga 100 000 DO so'rov, 50 000 GB-soniya/oy.
  - WebSocket Hibernation API bo'sh xonalar uchun 0 CPU duration sarflagani va faqat Leader tab ulangani sababli, ushbu arxitektura kuniga 1 500 – 3 500 ta faol chat foydalanuvchisini bepul reja chegaralarida to'liq ko'taradi.
- **Testlar va Tekshiruv:**
  - `npm test` — barcha 51 ta test (shu jumladan `src/lib/chat.test.ts` dagi JWT imzosi, room ID formatlari, klub darajalari, rate limit va kredit narxi) 100% muvaffaqiyatli o'tdi.
  - `npx tsc --noEmit` — 0 xato.

## 11-qism (Quests, streak, referral, haftalik ovoz, mavsumiy tadbirlar, level 1–100)

- **A. Markaziy Hodisalar Shinasi (Event Bus — `src/lib/events.ts`):**
  - Barcha gamifikatsiya progresslari (streak, vazifalar, referallar, XP, daily cap) bitta `emitEvent(user, type, payload)` funksiyasiga bog'landi.
  - Ulangan asosiy hodisalar: `episode_watched` (`/api/progress`), `chat_message_sent` (`/api/chat/rooms/:id/messages`), `post_created` (`/api/community`), `comment_created` (`/api/community/:id/comments`), `like_given` (`/api/community/:id/like`), `gift_sent` (`src/lib/gifts.ts`), `purchase` (`src/lib/economy.ts`).
  - Suiiste'molga qarshi choralar (anti-abuse text filter): kamida 10 ta belgi bo'lmagan, faqat bir xil so'zlar takrorlangan yoki spam post/sharhlar vazifa yoki XP uchun qabul qilinmaydi; o'z postiga layk berish hisoblanmaydi.

- **B. Level 1–100 Egri Chizig'i va Simulyatsiya (`src/lib/xp.ts`):**
  - Egri chiziq formulasi: `base: 250, exponent: 1.18, maxLevel: 100`.
  - Mavjud testlar talabi: `xpForLevel(2) === 250` saqlandi.
  - 100-darajaga yetish uchun jami **56 596 XP** kerak.
  - Simulyatsiya natijalari (`simulateLevelProgression`):
    - Kuniga 250 XP oladigan faol foydalanuvchi: **226 kunda** (~7.5 oy) 100-darajaga yetadi.
    - Kuniga 200 XP oladigan o'rtacha foydalanuvchi: **283 kunda** (~9.4 oy) 100-darajaga yetadi.
    - Kuniga 150 XP oladigan foydalanuvchi: **377 kunda** (~12.5 oy) 100-darajaga yetadi.
    - Maqsad (6–12 oy) 100% aniqlik bilan bajarildi!
  - **Kunlik faollik XP limitlari (`DAILY_ACTIVITY_CAPS`):**
    - Post yaratish: maksimal 50 XP/kun
    - Sharh yozish: maksimal 40 XP/kun
    - Layk bosish: maksimal 30 XP/kun
    - Chatda xabar yozish: maksimal 50 XP/kun
    - Xaridlar va achievementlar bu limitdan tashqarida.
  - **Titullar (har 10 levelda pog'ona):**
    - 1-9: 見習い (Shogird)
    - 10-19: 生徒 (Tolib)
    - 20-29: 剣士 (Qilichboz)
    - 30-39: 勇者 (Qahramon)
    - 40-49: 達人 (Usta)
    - 50-59: 師範 (Murabbiy)
    - 60-69: 影 (Soya / Kage)
    - 70-79: 覇者 (Hukmdor)
    - 80-89: 伝説 (Afsona)
    - 90-99: 神話 (Mif)
    - 100: 無限 (Cheksizlik / Mugen)

- **C. Kunlik Kirish va Streak (`src/lib/streaks.ts`):**
  - Foydalanuvchi vaqt zonasi (standart `Asia/Tashkent`) bo'yicha ketma-ket kunlar hisoblanadi.
  - Epizod ko'rish, post yozish yoki kunlik "Bonusni olish" tugmasi orqali qayd etiladi.
  - **Streak Freeze**: Bir kun uzilish bo'lsa, agar `streakFreezeCount > 0` bo'lsa, muzlatish zaxirasidan 1 ta sarflanadi va streak saqlab qolinadi (reset bo'lmaydi).
  - 7, 30, 100 kunlik marralar: maxsus kosmetika va XP beradi. Kechki bot eslatmasi imkoniyati.

- **D. Vazifalar (Quests — `src/lib/quests.ts`):**
  - Kunlik 3 ta vazifa (har kuni yangilanadi, 1 marta bepul almashtirish / reroll imkoni bor).
  - Haftalik 3 ta vazifa (dushanba kuni yangilanadi, katta XP va kosmetika mukofotlari).
  - Mukofotlar faqat "Qabul qilish" (Claim) tugmasi orqali idempotent tranzaksiyada olinadi.
  - Suiiste'molga qarshi filtrlar server darajasida tekshiriladi.
  - Bosh sahifa va profilda interaktiv `QuestsWidget` komponenti joylashtirildi.

- **E. Referral Tizimi (`src/lib/referrals.ts`):**
  - Har bir foydalanuvchiga noyob referal kodi va havolasi beriladi (`t.me/<bot>?start=ref_<kod>` va saytda `?ref=<kod>`).
  - **Malakali (Qualified) bo'lish sharti:** taklif qilingan do'st Telegram hisobini bog'lashi **va** kamida 3 ta epizod ko'rishi yoki 1 ta xarid qilishi shart. Shundan so'ng ikkala tomonga mukofot (XP + 5 kredit) beriladi.
  - Firibgarlikdan himoya: o'z-o'zini taklif qilish qat'iyan taqiqlangan, har bir Telegram ID faqat bir marta hisoblanadi, oyiga maksimum 20 ta muvaffaqiyatli taklif limiti qo'yilgan.
  - Community menyusida alohida "Do'stlar (Referral)" oynasi va takliflar peshqadamlar jadvali (Leaderboard) yaratildi.

- **F. Haftalik Anime Ovoz Berish (Anime of the Week — `src/lib/weekly-vote.ts`):**
  - Har dushanba avtomatik yangi so'rovnoma: eng yaxshi 8 ta katalog anime + 2 ta tasodifiy kashfiyot anime.
  - Ko'r-ko'rona ovoz berish (Blind vote): ovoz bermaguncha natija foizlari ko'rinmaydi.
  - Kamida 3-daraja bo'lish sharti (troll ovozlarni oldini olish uchun).
  - Yakunlanganda g'olib anime "Hafta Animesi" unvonini oladi va unga ovoz berganlarga bonus XP beriladi.

- **G. Mavsumiy Tadbirlar (Seasonal Events — `src/lib/seasonal-events.ts`):**
  - Yil davomidagi mavsumiy tadbirlar bazasi:
    - *Halloween 2026: Dahshatli Kecha* (`halloween-2026`, 24-okt – 4-noy)
    - *Yangi Yil 2027 Qorli Fest* (`newyear-2027`, 25-dek – 8-yan)
    - *Navro'z Bahoriy Fest 2027* (`navroz-2027`, 18-mar – 28-mar)
    - *Yozgi Anime Ta'tili 2027* (`summer-2027`, 15-iyul – 31-iyul)
  - Har bir tadbir uchun qaytib kelmaydigan eksklyuziv avatar ramkasi va maxsus nishonlar belgilandi.
  - Bosh sahifada taymerli mavsumiy banner (`SeasonalEventBanner`) joylashtirildi.

- **H. Testlar va Tekshiruv:**
  - `src/lib/gamification-v11.test.ts` yozildi va barcha mezonlar (XP egri chizig'i, kunlik limitlar, mavsumiy tadbirlar, vazifalar) sinovdan o'tkazildi.
  - `npm test` — barcha **54 ta test** (54/54) muvaffaqiyatli o'tdi.
  - `npx tsc --noEmit` — 0 ta TypeScript xatosi.

## Haqiqiy Real-time Online / Offline Presence tizimi (2026-10-23)

- **Global Presence Heartbeat (`src/components/anime/app.tsx`):**
  - Foydalanuvchi tizimga kirgan va brauzer yorlig'i (tab) ochiq / ko'rinib turgan (`document.visibilityState === "visible"`) vaqtda har 60 soniyada `/api/presence` chaqiriladi.
  - Throttling: 45 soniyadan kam vaqt ichida takroriy chaqirilsa, Neon DB ga yozilmasdan `ok: true, cached: true` qaytariladi (Neon PostgreSQL bepul limitlari to'liq tejaladi).
- **Profil va Profile Card'da real Online / Offline (`/api/users/[username]`, `profile.tsx`, `profile-card.tsx`):**
  - Foydalanuvchining `lastSeenAt` vaqti oxirgi 3 daqiqa ichida bo'lsa, `isOnline: true` qaytariladi.
  - Profil avatari va popover kartochkasida haqiqiy `isOnline` indikatori (yashil `live-dot` nuqta) yonadi; hover qilinganda "Online" yoki "Online — tomosha qilmoqda" ko'rsatiladi.
- **Chatda real-time xona Presence'i (`realtime-worker/src/index.ts`, `chat-panel.tsx`):**
  - Cloudflare Worker Durable Object xonaga har bir WebSocket ulanishi kirganda barcha ulangan `userId` larni `room_presence` hodisasi bilan yangi a'zoga yuboradi va boshqa a'zolarga `presence: online: true` tarqatadi.
  - Foydalanuvchi xonadan chiqqanda (agar boshqa ochiq yorlig'i bo'lmasa) avtomatik `presence: online: false` tarqatiladi.
  - `ChatPanel` da real-time online soni ko'rsatiladi (masalan: `3 online`) va chatdagi xabar egalarining avatarlari burchagida xonada ayni daqiqada hozir bo'lganlar uchun yashil nuqta yonib turadi.
- **Test:** `npm test` — 54/54 passed; `npx tsc --noEmit` — 0 errors.
