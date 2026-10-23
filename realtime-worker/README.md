# Kiluu / DubAniX Real-time Worker

Cloudflare Workers + Durable Objects (WebSocket Hibernation API) asosida qurilgan real-time chat va cron servisi.

## Xususiyatlari
- **Rooms:** `global`, `club:<clubId>`, `anime:<animeId>`
- **WebSocket Hibernation API:** `ctx.acceptWebSocket` bo'sh xonalarda CPU duration sarflamaydi (bo'sh turganda xona uxlaydi).
- **Arxitektura:** Brauzerlar xabarni Vercel API ga yuboradi (auth, moderatsiya, DB Neon'ga yozish). Vercel esa `POST /push/:roomId` orqali ushbu Worker'ga push qiladi. Worker ulangan barcha foydalanuvchilarga WebSocket orqali yetkazadi.
- **Cron Trigger:** `* * * * *` (har daqiqada) Vercel'dagi `/api/cron/schedule-notifications` va `/api/cron/chat-retention` ni chaqiradi.

---

## Deploy Yo'riqnomasi

### 1. Cloudflare ga kirish
```bash
cd realtime-worker
npx wrangler login
```
Brauzer ochiladi va Cloudflare akkauntingiz orqali tasdiqlaysiz.

### 2. Sirlarni (Secrets) kiritish
Quyidagi buyruqlarni ketma-ket ishga tushiring va qiymatlarni kiriting:

```bash
# 32+ belgili tasodifiy kalit (openssl rand -hex 32)
npx wrangler secret put REALTIME_JWT_SECRET

# Vercel push uchun 32+ belgili tasodifiy kalit
npx wrangler secret put REALTIME_PUSH_SECRET

# Vercel sayt API manzili (masalan: https://kiluu.vercel.app)
npx wrangler secret put SITE_API_URL

# Cron autentifikatsiya kaliti
npx wrangler secret put CRON_SECRET
```

### 3. Deploy qilish
```bash
npx wrangler deploy
```

Deploy yakunlangach, konsolda Worker manzili chiqadi (masalan: `https://kiluu-realtime.<subdomain>.workers.dev`).

---

## Vercel Environment Variables sozlash

Vercel loyihangiz boshqaruv panelida (Settings -> Environment Variables) quyidagilarni kiriting:

| O'zgaruvchi | Qiymat | Tavsif |
|---|---|---|
| `NEXT_PUBLIC_REALTIME_WS_URL` | `wss://kiluu-realtime.<subdomain>.workers.dev` | Worker WebSocket manzili |
| `REALTIME_JWT_SECRET` | Worker'ga kiritilgan bir xil secret | WebSocket JWT imzolash uchun |
| `REALTIME_PUSH_SECRET` | Worker'ga kiritilgan bir xil secret | Xabar push qilish uchun |
| `REALTIME_PROVIDER` | `cloudflare` (yoki `polling`) | Real-time provayder |
| `CRON_SECRET` | Worker'ga kiritilgan bir xil secret | Cron chaqiruvlari himoyasi |
