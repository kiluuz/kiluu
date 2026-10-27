# Kiluu

Anime community and viewing platform with a Next.js web app, Telegram bot integration, Neon PostgreSQL/Prisma data store, Cloudflare R2 media storage, and a Socket.IO Watch Together service.

## Kiluu brand assets

The supplied vector artwork lives at the repository root (`kiluu-b-icon.svg` and the light/dark horizontal lockups). The inline `LogoMark` component extracts the enso and キ vectors for app UI; no logo image request is needed in the interface. The public PNG/PWA icons and multi-size favicon are regenerated automatically before `npm run build`. After updating the square icon source, regenerate them manually with:

```sh
npm run brand:icons
```

The root `loading.tsx` and app-view navigation use the shared branded loader. Update the vectors in `LogoMark` only by extracting the paths from the supplied SVG artwork, not by redrawing them.

## Requirements

- Node.js 24 or newer and npm.
- Telegram bot token and bot source/configuration for account linking, Stars and delivery.
- A Neon PostgreSQL project for the web application and Watch Together service.
- A PostgreSQL database for the Telegram bot. It may use the same Neon project, but keep its connection/database isolated until the bot schema is verified against the web schema.
- Cloudflare R2 bucket and S3 API token for durable image and HLS storage.
- Docker Compose is optional for a single-host deployment. The web app and Watch Together service connect to managed PostgreSQL; use R2 for durable images before running multiple web replicas.

## Local setup

```sh
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Copy Neon’s **pooled** connection string into `DATABASE_URL` and its **direct** connection string into `DIRECT_URL` in `.env`; add `schema=dubanix_web` to both query strings (preserving any existing parameters with `&`). Keep both URLs private and do not put credentials in version control. The site’s schema is deliberately separate from the Telegram bot’s existing `public` schema. Run `npx prisma migrate deploy` to create the web schema, then run `npm run dev`. This production schema is PostgreSQL-only; the previous SQLite migration files are archived under `prisma/sqlite-migrations-archive/` and are not applied to Neon.

The existing Neon `public` schema belongs to the Telegram bot and contains live records. The web app’s PostgreSQL migrations run only in the `dubanix_web` schema and do not overwrite bot tables. The existing local `db/custom.db` was intentionally not transferred. Do not run the PostgreSQL migrations against that SQLite file. If you later need to preserve those records, use a separately reviewed and tested data-migration procedure.

The Telegram bot has its own `BOT_DATABASE_URL` and its existing PostgreSQL schema. The bot and web application communicate through the authenticated HTTP API; sharing one Neon project does not by itself unify their tables or accounts. `realtime-worker/` is a separate Cloudflare Workers project with its own TypeScript environment; the web application's root TypeScript check excludes that directory.

Run the Watch Together service in a separate terminal:

```sh
npm ci --prefix mini-services/watch-party
npm run watch-party
```

The web application and Watch Together service must use the same pooled `DATABASE_URL` and the same `WATCH_PARTY_SECRET` (at least 32 characters). Prisma migrations use `DIRECT_URL` to bypass Neon’s pooler. Set `WATCH_PARTY_ALLOWED_ORIGINS` to the exact web origin. Configure `REDIS_URL` when running multiple socket-service instances.

## Environment variables

See [.env.example](./.env.example) for the full list. Important values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled PostgreSQL connection string for runtime queries (`sslmode=require`; Neon’s pooler URL) |
| `DIRECT_URL` | Neon direct PostgreSQL connection string used by Prisma migrations |
| `TELEGRAM_BOT_TOKEN` | Telegram Login Widget/Mini App validation and bot notifications |
| `ANIME_BOT_API_KEY` | Separate shared site-to-bot API secret; never use the Telegram bot token |
| `ANIME_BOT_API_URL` | Bot HTTP API base URL |
| `BOT_DATABASE_URL` | PostgreSQL connection for the Telegram bot; configure separately from the web database |
| `ADMIN_USER_IDS`, `ADMIN_TELEGRAM_IDS` | Explicit admin allowlists |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | S3-compatible Cloudflare R2 credentials and bucket |
| `R2_PUBLIC_BASE_URL` | HTTPS custom domain attached to the R2 media Worker; no trailing slash |
| `R2_HLS_SIGNING_SECRET` | High-entropy HMAC key shared by the website and media Worker |
| `CF_STREAM_ACCOUNT_ID`, `CF_STREAM_API_TOKEN` | Optional legacy playback for episodes already stored in Cloudflare Stream |
| `WATCH_PARTY_SECRET`, `WATCH_PARTY_PORT`, `WATCH_PARTY_ALLOWED_ORIGINS` | Signed socket tickets and service configuration |
| `WATCH_PARTY_JOIN_PRICE_CREDITS` | Credit cost for each party participant, including its host (intended value: `5`) |
| `NEXT_PUBLIC_WATCH_PARTY_URL` | Browser-reachable Watch Together Socket.IO URL; route TLS/WebSocket traffic to the service |
| `REDIS_URL` | Optional Socket.IO Redis adapter for multiple service instances |
| `CRON_SECRET` | Bearer secret for the schedule-notification cron endpoint |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional server and browser error reporting |
| `TELEGRAM_STARS_WEBHOOK_SECRET` | Optional internal Stars grant-retry secret |

Never expose secrets through `NEXT_PUBLIC_*` variables; the public Sentry DSN is intentionally publishable. Use a distinct, high-entropy value for each private secret.

For R2, create an S3 API token with Object Read & Write access restricted to the media bucket. Use the Worker in `cloudflare/r2-media-worker.mjs` with a private R2 bucket binding; attach a custom domain such as `media.example.uz` to the Worker and use that HTTPS origin for `R2_PUBLIC_BASE_URL`. Do not enable public bucket access: the Worker serves images and frame assets publicly but requires a short-lived HMAC signature for HLS files. Put the same random secret in the website's `R2_HLS_SIGNING_SECRET` and the Worker's secret binding. The Worker's R2 bucket name must match `R2_BUCKET_NAME`.

Before deploying the Worker, replace the placeholder `bucket_name` in `cloudflare/wrangler.toml`. Deploy it with `npx wrangler deploy --config cloudflare/wrangler.toml`, then set its `R2_HLS_SIGNING_SECRET` using `npx wrangler secret put R2_HLS_SIGNING_SECRET --config cloudflare/wrangler.toml`. Attach the Worker custom domain in Cloudflare and set the same signing secret plus the R2 S3 credentials in the website host's private environment. The S3 secret belongs only in the web server environment and must never be added to Worker variables or browser-visible `NEXT_PUBLIC_*` settings.

Cloudflare R2 Standard currently includes 10 GB-month storage, 1 million Class A requests, and 10 million Class B requests each month; internet egress is free. Above the included quota, storage and request charges apply. These limits are shared by images and HLS videos in the bucket. See [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Avatar and name frames

Frame sources live in `frames-src/`: `imageframeN.png` files are avatar rings and `nameframeN.png`/`.webp` files are name plates. Add each source and its catalog entry to the single `frames.config.ts` file (unique slug, type, name, rarity, price or mission key, version, scale, and per-name-frame safe rectangle/alignment/font settings). Use `priceCredits: null` with a `missionKey` for mission-only rewards. Do not add `rank.png` or standalone artwork unless it is intentionally designed as a frame.

After adding sources/config, deploy the `20261021200000_avatar_name_frames` migration, then run:

```sh
npm run frames:sync
```

The sync command writes 256px and 384px padded avatar WebPs and 480px padded name-plate WebPs under `public/frames/`, uploads versioned WebPs under `frames/avatar/` or `frames/name/` in the configured R2 bucket, and idempotently upserts frame metadata in Neon. Use `npm run frames:sync -- --force` to regenerate and upload existing assets, or add `--only=slug-a,slug-b` to limit the sync to selected frame slugs. Increment each frame's `version` in `frames.config.ts` when replacing its art so browser/CDN caches use a new immutable URL. The R2 helper applies one-year immutable cache headers. Keep original assets in `frames-src/`; generated files should not be edited by hand.

New mission keys must be paired with an achievement in `src/lib/achievements-catalog.ts` and, where needed, a corresponding progress metric in `src/lib/achievements.ts`. Mission rewards are added to `user_frames` when that achievement unlocks and are not purchasable in the shop.

## Creator uploads through Telegram

Creator accounts can link Telegram from Creator Studio. In the bot, `/my_animes` lists only anime owned by that linked site account; `/upload_anime` shows the required format. Send a poster photo with a caption such as:

```text
#anime
Nomi: My Anime
Tavsif: A synopsis with at least 20 characters.
Janr: Action, Drama
Yil: 2026
Holat: ongoing
Turi: TV
Narx: 100
Bepul: yo'q
```

After the anime is created, send each episode video with a caption such as `#my-anime 1-qism — Episode title`. The bot posts poster/video media to its configured private channel and synchronizes metadata and Telegram message IDs to the web application. Creator uploads remain hidden from the public website until approved by an administrator. Telegram episode delivery works through the bot. To make an episode available to Watch Together without Stream, enable “Prepare private R2 HLS” in Creator Studio; the returned object prefix is `hls/<anime-slug>/<episode-number>`. The episode video still needs to be sent to the Telegram bot separately.

Convert a lawful local video copy to HLS with FFmpeg, then upload the output folder from this repository using the private R2 credentials in `.env`:

```sh
mkdir -p ./hls-output
ffmpeg -i ./episode.mp4 -c:v libx264 -c:a aac -hls_time 6 \
  -hls_playlist_type vod -hls_segment_filename './hls-output/segment_%05d.ts' \
  ./hls-output/index.m3u8
node --env-file=.env scripts/upload-hls-to-r2.mjs \
  --source ./hls-output --prefix hls/my-anime/1
```

Replace `my-anime/1` with the exact slug and episode number returned by Creator Studio. The script uploads only HLS playlist/segment formats; the private bucket is never exposed directly. Playback links are short-lived but shareable while valid. Watch Together charges each person, including the host, the configured `WATCH_PARTY_JOIN_PRICE_CREDITS` (default `5`) at first entry; the debit and ledger entry commit atomically with party membership.

For the current shared-secret setup, set the web app's `ANIME_BOT_API_KEY` and `SITE_API_KEY`, and the bot's `API_KEY` and `SITE_API_KEY`, to the same high-entropy value; never use the Telegram bot token for this. The bot also needs `SITE_API_URL`, `PUBLIC_URL`, a PostgreSQL `DATABASE_URL`, and administrator posting rights in `CHANNEL_ID`. Keep the bot API private. Viewer accounts are denied server-side even if they try to call Creator bot commands directly.

## Telegram Stars test mode

In BotFather, enable Telegram Payments test mode for the bot. The app creates Stars invoices with currency `XTR` and an empty provider token as required by Telegram Stars. Test with a Telegram test account before enabling production payments. A purchase is not considered complete until Telegram's successful-payment webhook is verified and processed.

## Admin guide

Set the first administrators through `ADMIN_USER_IDS` and/or `ADMIN_TELEGRAM_IDS`, restart the web application, then sign in with the corresponding account. Admin screens and admin APIs must use the server-side admin allowlist/RBAC; do not grant a user admin status from the client. Use the moderation and achievement-set tools to review user content and configure collection sets. Bot Admin additionally requires the Telegram bot API configuration.

For schedule reminders, run `POST /api/cron/schedule-notifications` every minute with `Authorization: Bearer $CRON_SECRET`. Only users who have linked Telegram and subscribed to that AniList schedule entry can receive a notification. The profile timezone is used when valid; otherwise `Asia/Tashkent` is used. Failed deliveries are retained for retry and successful deliveries are idempotently recorded.

## Tests and checks

```sh
npm test
npx prisma validate
npx tsc --noEmit
npm run lint
npm run build
```

`npm test` creates a temporary SQLite-compatible Prisma client/schema for isolated local tests, then restores the generated PostgreSQL Prisma client. The Watch Together test suite launches an isolated service/database and includes a measured 50-client local simulation. External end-to-end flows require configured Telegram, Stars, bot PostgreSQL/API, R2 Worker, and real browser sessions; they cannot be inferred from unit tests.

## Docker deployment

1. Create a Neon project and a dedicated production database/role. Save its pooled connection URL as `DATABASE_URL` and its direct URL as `DIRECT_URL` in your secret manager or deployment `.env`.
2. Install Docker Engine and the Docker Compose plugin.
3. Create `.env` from `.env.example`, set every required Compose variable, and set `BOT_DIR` to an absolute path containing `bot.py`.
4. Configure `NEXT_PUBLIC_WATCH_PARTY_URL`, TLS/reverse proxy and an exact public `PUBLIC_APP_ORIGIN`. Route browser WebSocket traffic to port 3003; keep the bot API private.
5. Start services:

   ```sh
   docker compose up --build -d
   docker compose ps
   curl --fail http://localhost:3000/api/health
   ```

Compose applies Prisma migrations to Neon before starting the app. New user image uploads use the configured R2 bucket; keep the private bucket backed up. Existing legacy files in `public/uploads` may still need a one-time migration. The built-in Compose file is a single-host application template, not a high-availability topology.

### Backup and restore

Use Neon’s backup/restore or point-in-time restore feature for database recovery. For an independent export, run `pg_dump` with the direct connection string from a trusted host:

```sh
pg_dump --format=custom --no-owner --file=dubanix-backup.dump "$DIRECT_URL"
docker compose cp web:/app/public/uploads ./uploads-backup
```

Store backups encrypted and outside the host. Test restores periodically in a separate Neon branch/database before production incidents. R2 objects need their own backup and restore plan. The bot database also needs a backup unless it is covered by the same Neon backup policy. To restore, use a new/isolated database, apply the matching migration history, restore data and objects, then verify `/api/health` and critical user flows.

## Known deployment limits

- Telegram-hosted episode IDs are not browser HLS URLs. Episodes need an uploaded R2 HLS playlist (or a legacy Cloudflare Stream `streamId`) for Watch Together playback.
- New uploaded profile/community/creator images go to R2, but artwork URLs provided by AniList or the Telegram bot, and existing external catalog images, are not automatically mirrored yet. Legacy files under `public/uploads` also need a one-time migration if they must remain available.
- Schedule delivery is driven by the external cron caller. Configure a reliable once-per-minute scheduler and monitor its response/error counts.
- The Socket.IO service uses Redis for cross-instance pub/sub only when configured. Neon PostgreSQL removes SQLite’s single-writer database constraint, but the current in-process rate limiter still makes multi-replica public API deployment unsafe without a shared replacement.
- Rate limits are in-memory and per process; deploy behind an appropriately configured gateway and use a shared rate-limit store before horizontally scaling public APIs.
- Sentry is optional; configure the DSNs in deployment to receive production events.

## Legal and content operations

Only distribute anime, artwork, audio, and subtitles for which Kiluu or the uploader has documented rights. Provide a published rights/contact address and a takedown process; respond to valid notices promptly, preserve relevant records, remove or disable the reported material while reviewing it, and provide a counter-notice path where legally appropriate. Obtain jurisdiction-specific legal advice before launch.
# Kiluu
