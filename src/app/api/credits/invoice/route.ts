import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createStarsInvoice } from "@/lib/bot-api";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";
import { ensureRuntimeSeed } from "@/lib/seed-runtime";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(rateKey(req, "stars-inv") + user.id, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  await ensureRuntimeSeed();
  const { packageId } = (await req.json()) as { packageId?: string };
  const pkg = packageId ? await db.creditPackage.findFirst({ where: { id: packageId, active: true } }) : null;
  if (!pkg) return NextResponse.json({ error: "Invalid package" }, { status: 400 });

  const payload = `cred:${user.id}:${pkg.id}:${randomBytes(8).toString("hex")}`;
  const credits = pkg.credits + pkg.bonus;
  const payment = await db.starsPayment.create({
    data: {
      userId: user.id,
      kind: "CREDITS",
      packageId: pkg.id,
      starsAmount: pkg.starsPrice,
      creditsGranted: credits,
      status: "pending",
      invoicePayload: payload,
    },
  });

  try {
    const inv = await createStarsInvoice({
      site_user_id: user.id,
      kind: "CREDITS",
      title: `DubAniX ${pkg.name}`,
      description: `${pkg.credits}+${pkg.bonus} credits`,
      stars: pkg.starsPrice,
      payload,
    });
    return NextResponse.json({
      paymentId: payment.id,
      invoiceLink: inv.invoice_link,
      stars: pkg.starsPrice,
      credits,
    });
  } catch (e) {
    log.error("stars invoice failed", { err: String(e) });
    await db.starsPayment.update({ where: { id: payment.id }, data: { status: "failed" } });
    return NextResponse.json({ error: "Could not create Stars invoice. Link Telegram and try again." }, { status: 502 });
  }
}
