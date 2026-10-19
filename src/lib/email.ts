// src/lib/email.ts
// Brevo HTTP API orqali email yuborish (SMTP emas)
// Bepul: 300 email/kun, BREVO_API_KEY env kerak

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kiluu.vercel.app";
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "kiluusupport@gmail.com";
const SENDER_NAME = "Kiluu";

export function isEmailEnabled(): boolean {
  return !!BREVO_API_KEY;
}

async function sendBrevoEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY!,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error: ${err}`);
  }
}

export async function sendVerificationEmail(opts: {
  to: string;
  username: string;
  code: string;
}): Promise<void> {
  if (!BREVO_API_KEY) {
    console.log(`[EMAIL DEV] OTP for ${opts.to}: ${opts.code}`);
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Tasdiqlash - Kiluu</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:linear-gradient(135deg,#f97316,#ef4444);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Kiluu</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Anime streaming platform</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#fff;margin:0 0 8px;font-size:20px;font-weight:700;">Email tasdiqlash</h2>
      <p style="color:#aaa;margin:0 0 28px;font-size:14px;line-height:1.6;">
        Salom <strong style="color:#f97316;">@${opts.username}</strong>! Kiluu'ga xush kelibsiz.<br/>
        Akkountingizni faollashtirish uchun quyidagi kodni kiriting:
      </p>
      <div style="background:#111;border:2px solid #f97316;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="color:#888;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Tasdiqlash kodi</p>
        <p style="color:#fff;margin:0;font-size:42px;font-weight:900;letter-spacing:12px;font-family:monospace;">${opts.code}</p>
        <p style="color:#666;margin:12px 0 0;font-size:12px;">10 daqiqa ichida amal qiladi</p>
      </div>
      <p style="color:#666;margin:0;font-size:12px;line-height:1.6;">
        Agar siz bu akkountni ochishga harakat qilmagan bo'lsangiz, ushbu emailni e'tiborsiz qoldiring.
      </p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;">
      <p style="color:#444;margin:0;font-size:11px;">
        © 2025 Kiluu • <a href="${SITE_URL}" style="color:#f97316;text-decoration:none;">${SITE_URL}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendBrevoEmail({
    to: opts.to,
    subject: `${opts.code} — Kiluu email tasdiqlash`,
    html,
  });
}

export async function sendGiftNotificationEmail(opts: {
  to: string;
  recipientUsername: string;
  senderUsername: string;
  animeTitle: string;
  message?: string | null;
}): Promise<void> {
  if (!BREVO_API_KEY) {
    console.log(`[EMAIL DEV] Gift: ${opts.senderUsername} -> ${opts.to}: ${opts.animeTitle}`);
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="uz">
<head><meta charset="UTF-8"><title>Sovg'a - Kiluu</title></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:linear-gradient(135deg,#f97316,#ef4444);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;">Kiluu</h1>
    </div>
    <div style="padding:36px 32px;">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:48px;">🎁</span></div>
      <h2 style="color:#fff;margin:0 0 12px;font-size:20px;font-weight:700;text-align:center;">Sizga sovg'a yuborildi!</h2>
      <p style="color:#aaa;margin:0 0 20px;font-size:14px;line-height:1.6;text-align:center;">
        <strong style="color:#f97316;">@${opts.senderUsername}</strong> sizga
        <strong style="color:#fff;">"${opts.animeTitle}"</strong> animeni sovg'a qildi!
      </p>
      ${opts.message ? `<div style="background:#111;border-left:3px solid #f97316;padding:16px;border-radius:8px;margin-bottom:20px;">
        <p style="color:#ccc;margin:0;font-size:13px;font-style:italic;">"${opts.message}"</p>
      </div>` : ""}
      <div style="text-align:center;">
        <a href="${SITE_URL}/gifts" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ef4444);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
          Sovg'ani ko'rish →
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;">
      <p style="color:#444;margin:0;font-size:11px;">© 2025 Kiluu</p>
    </div>
  </div>
</body>
</html>`;

  await sendBrevoEmail({
    to: opts.to,
    subject: `🎁 @${opts.senderUsername} sizga "${opts.animeTitle}" sovg'a qildi — Kiluu`,
    html,
  }).catch((err) => console.error("Gift email failed:", err));
}
