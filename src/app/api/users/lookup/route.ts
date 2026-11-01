import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findUserByHandle } from "@/lib/handles";
import { isCreator } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("username") ?? "";
  const username = raw.replace(/^@/, "").trim().toLowerCase();
  if (!username || username.length > 40) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Same resolution rule as sendGift, so the form never accepts what the API rejects.
  const user = await findUserByHandle(username);

  const recipient = user && user.id !== me.id ? user : null;
  return NextResponse.json(
    {
      user: recipient
        ? {
            id: recipient.id,
            username: recipient.username,
            displayName: recipient.displayName,
            avatarUrl: recipient.avatarUrl,
            accentColor: recipient.accentColor,
            canReceiveGift: !isCreator(recipient),
          }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
