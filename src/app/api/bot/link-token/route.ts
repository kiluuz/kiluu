import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { issueLinkToken } from "@/lib/telegram-link";
import { createLinkToken } from "@/lib/bot-api";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(rateKey(req, "link-token") + user.id, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  try {
    const issued = await issueLinkToken(user.id);
    let link = issued.link;
    try {
      const botToken = await createLinkToken(user.id, issued.token);
      if (typeof botToken.link === "string" && botToken.link.startsWith("https://t.me/")) {
        link = botToken.link;
      }
    } catch (e) {
      log.warn("bot link-token sync failed; web token still valid", { err: String(e) });
    }
    return NextResponse.json({
      link,
      expires_in: issued.expires_in,
      token: issued.token,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "link failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
