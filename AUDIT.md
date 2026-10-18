# DubAniX audit — 1-qism (2026-10-14)

Keyingi qismlar qayta audit qilmasin. Manbalar: web (`shu workspace`), bot (`/home/limi/Downloads/BOT/bot.py`), SQLite `db/custom.db`, Prisma `prisma/schema.prisma`.

## 1. Ma'lumotlar bazasi

**Bot va web hozir bitta DB emas — ikkita alohida baza.**

| Qatlam | DB | ORM / driver | Connection |
|--------|----|--------------|------------|
| Web | SQLite fayl | Prisma 6 (`src/lib/db.ts`) | `.env` → `DATABASE_URL=file:.../db/custom.db` |
| Bot | PostgreSQL (Neon/tashqi) | `asyncpg`, raw SQL `CREATE TABLE IF NOT EXISTS` | bot `.env` → `DATABASE_URL=postgresql://...` |

Bog'lanish: HTTP API. Bot `SITE_API_URL` + `SITE_API_KEY` bilan `POST/DELETE /api/bot/sync-anime` chaqiradi. Web `ANIME_BOT_API_URL` + `ANIME_BOT_API_KEY` bilan bot FastAPI (`/api/animes`, `/api/link-token`, `/api/grant`, …) chaqiradi.

**Muhim:** web `.env` dagi `ANIME_BOT_API_KEY` qiymati Telegram bot tokeniga o'xshaydi (`8224…:AAF…`). Bot `.env.example` esa `API_KEY` ni alohida maxfiy kalit deb belgilaydi. Tokenni API kalit sifatida ishlatish xato — `TELEGRAM_BOT_TOKEN` va `ANIME_BOT_API_KEY` ni ajratish kerak.

**Prisma vs haqiqiy SQLite:** `schema.prisma` oldinda. `User` da `telegramId`, `locale`, `xpTotal`, `lastSeenAt` yo'q; `Anime` da `source`/`canonicalId`/`hidden` yo'q; `Gift`, `WatchParty`, `StarsPayment`, `PlatformConfig` va boshqa modellarning jadvallari yo'q. Prisma barcha skalarni SELECT qiladi → `/api/auth/me`, `/api/presence`, `/api/community/stats` SQLite xatosi beradi. Bu Next.js qizil **"1 Issue"** ning asosiy sababi.

Migratsiya tizimi yo'q edi (`prisma/migrations/` bo'sh). `package.json` da `db:push --accept-data-loss` — xavfli; o'chirildi.

### Web SQLite (audit paytida)

Jadvallar: `User`, `Session`, `Anime`, `Episode`, `Purchase`, `CreditTransaction`, `Post`, `PostLike`, `Comment`, `FavoriteAnime`, `FavoriteUser`, `WatchProgress`, `ExchangeOffer`, `ExchangeProposal`, `DubJob`, `AnimeNotify`, `Order`.

9 user (4 ta `*.aniverse.test` seed + `sotanode`, `marlon`, `marluz`, `sakura_dev`/`zenitsu_` seed creatorlar). 38 anime, 250 qism, 63 xarid, 72 kredit yozuvi.

### Bot Postgres sxemasi (`bot.py` SCHEMA)

- `animes(slug, title, description, poster, price, is_active, poster_file_id, poster_uid, …)`
- `episodes(anime_id, number, message_id UNIQUE, price)` — **Telegram `message_id`**, `file_id` emas. Yetkazish: `copy_message` yopiq kanaldan.
- `users(site_user_id PK, chat_id, username, linked_at)` — sayt user id
- `link_tokens(token, site_user_id, expires_at)` — 15 daqiqa; deep link `t.me/<bot>?start=link_<token>`
- `purchases(site_user_id, anime_id, …)`
- `deliveries`, `deleted_animes`

Kanal post formati:

- Ma'lumot: `#anime <slug>` + `Nomi:` / `Narx:` / `Tavsif:` / `Faol:`
- Qism: `#slug 1-qism` yoki `slug|1`; optional `narx: N`
- O'chirish: `#delete slug` / `#ochirish slug_1`

Poster: `poster_file_id` bo'lsa `PUBLIC_URL/poster/{slug}?v={uid}` (bot xotirada JPEG); yo'q bo'lsa qo'lda URL. Telegram `file_id` havolalari muddati tugaydi — sayt ularga bog'lanmasligi kerak.

## 2. Texnologiya steki

**Web:** Next.js 16 (App Router, SPA `src/app/page.tsx` + client store), React 19, Tailwind 4, Prisma + SQLite, next-auth o'rnatilgan lekin ishlatilmaydi (custom httpOnly cookie `aniverse_session` + scrypt), next-intl o'rnatilgan lekin i18n yo'q edi, Zod, sharp.

**Bot:** Python 3.10+, aiogram 3 + FastAPI, bitta jarayon (`uvicorn --workers 1`), polling.

**Ishga tushirish**

```bash
# web
cp .env.example .env   # DATABASE_URL, TELEGRAM_BOT_TOKEN, …
npx prisma migrate deploy
npx prisma generate
npm run dev            # next dev -p 3000

# bot
cd /home/limi/Downloads/BOT
cp .env.example .env
uvicorn bot:app --host 0.0.0.0 --port 8000 --workers 1
```

**Testlar:** audit paytida yo'q edi. 1-qismda auth / link / RBAC testlari qo'shildi (`bun test`).

## 3. Mock / hardcoded ro'yxat (grep)

| Joy | Nima |
|-----|------|
| `src/components/anime/views/community.tsx` | **Online 12,408**, **Posts Today 3,291**; postlarga random `level`/`badge`/`rating` |
| `src/components/anime/views/community-ui.tsx` | Trending: 5× bir xil Attack on Titan; soxta Watch Parties; **User 1/2/3** Top Contributors; Level 45/40/35 |
| `src/components/anime/views/community.tsx` | "MOCK DATA AUGMENTATION", mock XP toast |
| `src/lib/level-utils.ts` | Level qismlar sonidan `sqrt` (xp ledger emas) |
| `src/components/anime/types.ts` | `// gamification mock` |
| DB `slug=yangi-anime`, `slug=anime` | Test/bo'sh kartalar |
| `scripts/seed.ts` | `*.aniverse.test` userlar, 24 ta katalog anime |
| `src/components/anime/profile-assets.ts` | Tashqi CDN banner/avatar URL |
| `src/lib/bot-api.ts` | `BOT_API_KEY` default `"test_key"` |

**Lv.42:** alohida literal yo'q; community sidebar `Level {50 - i * 5}` (45/40/35) va random `Math.random()*50`.

## 4. Auth (audit holati)

- Session: httpOnly cookie, 30 kun, `sameSite=lax`, `secure` yo'q edi.
- Email/parol: `/api/auth/login|register`. Telegram Login Widget / `initData` HMAC **yo'q** edi.
- Role: `VIEWER`/`CREATOR`; `ADMIN` deyarli ishlatilmagan. Admin panel `role === "CREATOR"`. Profil PATCH o'z rolini CREATOR qilishi mumkin edi.
- Link: web bot API `POST /api/link-token` → `t.me/bot?start=link_<token>`. Tokenlar **faqat bot Postgres** da.
- Rate limit: in-memory `src/lib/rate-limit.ts`, auth marshrutlarida qo'llanmagan.

## 5. Storage

`src/lib/storage.ts` + `src/lib/media.ts`: disk `public/uploads/{avatar,banner,cover,post}`, magic-bytes, 8 MB. S3/R2 yo'q. Katalog posterlari AniList/bot URL (muddati tugashi mumkin).

**Admin "rasm o'rniga alt-matn":** `bot-admin.tsx` `<img src={anime.poster}>`. `poster` bo'sh, `file_id`, yoki o'lik Telegram/bot URL bo'lsa brauzer **alt** (`title`) ni ko'rsatadi. `SmartImage` ham yaroqsiz `src` da alt-matn chizadi.

## 6. i18n

Standart til UI da asosan EN; `dubanix.lang` localStorage, toast "translation coming soon". Hardcoded UZ: "Qismlar", "Xabardor qiling", "Global Jadval", bot-admin matnlari.

## 7. Infra

- `.env.example` yo'q edi; `.gitignore` `.env*` — namuna ham ignore.
- `/api/health` bor (DB `SELECT 1`).
- Docker compose yo'q edi.
- Structured logging yo'q (`console.error`).
- Sirlar: `.env` gitda modified (commit qilmang).

## 8. Keyingi qismlar uchun

To'lov (Stars), gift, community backend, watch party — **bu qismda qurilmaydi**. Prisma da modellari turishi mumkin (bo'sh jadvallar); biznes-mantiq keyingi qismda.

Yagona DB: web Prisma sxemasi manba; bot hozircha o'z Postgres + API. To'liq birlashtirish (bot ham Prisma/Postgres) alohida qism.
