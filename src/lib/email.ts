// src/lib/email.ts
// Brevo (Sendinblue) SMTP orqali email yuborish
// Bepul: 300 email/kun, domen tasdiqsiz (faqat sender email tasdiqlash kerak)

import nodemailer from "nodemailer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kiluu.vercel.app";

// Email yuborish imkoniyati bormi?
export function isEmailEnabled(): boolean {
  return !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_KEY);
}

function createTransport() {
  const user = process.env.BREVO_SMTP_USER; // Brevo accaunt emailingiz
  const pass = process.env.BREVO_SMTP_KEY;  // Brevo SMTP Key (parol emas!)
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM || `Kiluu <${process.env.BREVO_SMTP_USER}>`;
}

export async function sendVerificationEmail(opts: {
  to: string;
  username: string;
  code: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
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

  await transport.sendMail({
    from: getFromEmail(),
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
  const transport = createTransport();
  if (!transport) {
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

  await transport.sendMail({
    from: getFromEmail(),
    to: opts.to,
    subject: `🎁 @${opts.senderUsername} sizga "${opts.animeTitle}" sovg'a qildi — Kiluu`,
    html,
  }).catch((err) => console.error("Gift email failed:", err));
}
