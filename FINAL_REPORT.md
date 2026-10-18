# DubAniX — Final report

**As of:** 2026-10-15

## Delivered in this workspace

- Parts 1–9 are tracked in [PROGRESS.md](./PROGRESS.md): foundation/auth, Stars/credits, catalog and creator delivery, gifts, community, profiles/analytics, XP/achievements, Watch Together, schedule reminders, AI Dubbing “Soon”, and deploy preparation.
- Schedule reminders are persisted per account and AniList media. Subscriptions can be created/removed, and a protected cron endpoint sends an episode alert through Telegram when an AniList airing event is due. It records delivery status, retries failed sends safely, formats the air time in the profile's valid IANA timezone, and defaults to `Asia/Tashkent`.
- AniList schedule requests use a 10-minute revalidation cache, timeout, input bounds, provider response validation, and a visible error/empty state rather than fabricated data. Raw AniList format labels are translated for common schedule formats.
- AI Dubbing is now explicitly “Soon” in navigation and its page. The misleading simulated pipeline and credit charge have been removed; the old dubbing endpoints return HTTP 410. Signed-in users may join or leave a DB-backed notification waitlist.
- Added Docker image/Compose configuration, health checks, migration startup, Sentry instrumentation hooks, environment reference, and backup/deployment/admin instructions in [README.md](./README.md).
- Switched the web application and Watch Together Prisma datasource from local SQLite to Neon-compatible PostgreSQL. `DATABASE_URL` is the pooled runtime URL and `DIRECT_URL` is the direct migration URL. A fresh PostgreSQL baseline is in `prisma/migrations/`; prior SQLite migration history is preserved separately in `prisma/sqlite-migrations-archive/`.
- PostgreSQL web schema is installed in the existing Neon database under `dubanix_web`, isolated from Telegram bot tables in `public`. Existing local SQLite records were deliberately not transferred. Docker Compose now connects web, migration, and Watch Together services to the external PostgreSQL URLs instead of a shared SQLite volume.
- Disabled `typescript.ignoreBuildErrors` so production builds cannot silently skip type failures. Fixed the existing seed typing and Telegram test import errors encountered during final type validation.
- Tightened Bot Admin refund/retry and release-notification endpoints to use the configured admin check rather than treating every creator as an administrator.

## Verification performed

- `npx prisma validate` and `npx prisma generate`: passed after adding the schedule-delivery model.
- Full `npm test`: 28 passed, 0 failed. Includes schedule timezone fallback, Telegram HMAC, profile/privacy, community persistence/award, XP/achievement, and Watch Together authorization/synchronization/reconnect/50-client simulation. Final recorded 50-client result: connect **492.25 ms**, broadcast **39.36 ms**.
- `npx prisma validate`, `npx prisma generate`, and sequential `npx prisma generate && npx tsc --noEmit`: passed.
- `npm run build`: passed with TypeScript enabled. Before switching the production provider, all nine archived SQLite migrations were applied successfully to a disposable SQLite database and its health endpoint returned `200`/`db: up`. The new PostgreSQL schema validates and its initial migration was generated, but it has not yet been applied to Neon.
- Targeted ESLint for changed files passed. Browser smoke-tested the app shell, real AniList schedule entries/translated formats, and the AI Dubbing “Soon” page.
- `npm audit --omit=dev`: 0 vulnerabilities after upgrading Sharp and pinning patched `deepmerge-ts`, `js-yaml`, and `prismjs` transitive releases. Full `npm audit` still reports 5 high findings in the development-only ESLint dependency chain (`braces` → `micromatch` → `fast-glob` → `eslint-config-next`); npm proposes downgrading Next's ESLint config major version, which was not applied.
- Neon is connected and the initial web migration is applied in `dubanix_web`. The production health endpoint returned `200`/`db: up`. The existing bot tables and their row counts were verified unchanged in `public`; the new site schema currently has 0 users and requires real site accounts/catalog data.

## Not verified / launch blockers

- Repository-wide `npm run lint` still fails with 16 React-hook/immutability errors in other existing UI files outside the changed Schedule/Dubbing paths. The touched files pass the targeted ESLint run; clean the remaining baseline errors before claiming a whole-repository lint pass.
- Docker is not installed in this environment. The image/Compose configuration has not been built or started.
- All-page browser/console review was not completed. No claim is made that the “no red issue/no console errors” or full UI acceptance criteria passed.
- A complete business end-to-end run was not performed. Telegram credentials, linked bot/PostgreSQL, Stars test payment, Cloudflare Stream credentials, and two real browser sessions are external prerequisites. No real upload, payment, bot delivery, or HLS playback was exercised.
- The cron route must be called every minute by deployment infrastructure. It only sends Telegram messages to accounts with a linked Telegram ID.
- Existing Telegram-only episode sources still require migration to Cloudflare Stream for web playback. The bot and web app continue to use separate databases.
- The current rate limiter is in-memory and does not coordinate across replicas. Neon is configured for production persistence; use a shared rate-limit backend before horizontal scaling.

## Run and deploy

Follow [README.md](./README.md) for local setup, environment variables, Stars test mode, admin setup, Docker Compose deployment, schedule cron configuration, and backup/restore instructions. In short: configure secrets and external services, run `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, and `npm run dev`; production Docker runs migrations before the web app.

## Security and legal notes

- Repository audit checked Telegram HMAC validation, server-side admin checks, API rate-limit call sites, parameterized Prisma access, user text escaping, and upload validation. No raw unsafe Prisma SQL usage was found by the targeted source search. This was a bounded code inspection, not a formal penetration test.
- Auth, login, Telegram, credit invoice, purchase, community and upload endpoints have selected in-process rate limits; those limits are not distributed across multiple app replicas.
- Production dependencies audit cleanly. Resolve the remaining dev-toolchain advisory with a compatible Next ESLint release when available; do not downgrade the config major to suppress the report.
- User-uploaded anime, art, voice, and subtitle rights remain a material legal risk. Before public launch, establish uploader warranties, a rights-holder contact, takedown/appeal handling, retention rules, and jurisdiction-specific review. Cloudflare or Telegram hosting does not grant distribution rights.

## Recommended next steps

1. Resolve the 16 repository-wide lint errors; rerun full lint, tests, and production build on the final tree.
2. Install Docker in CI, validate Compose, and perform backup/restore rehearsal.
3. Configure secrets and external integrations in staging; apply migrations, set up the once-per-minute schedule job, and complete real browser HLS/Watch Together tests.
4. Run the full register → Telegram link → Stars test payment → purchase → bot delivery → gift → community post → Watch Together scenario with test accounts.
5. Resolve the dev-only ESLint dependency advisory when a compatible upgrade is available; then perform full-page UI/i18n and production-console pass.
6. Publish the rights/takedown policy and monitor Sentry and cron delivery failures.
