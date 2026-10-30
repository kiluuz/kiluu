import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDonationIntentForUser } from "@/lib/donationalerts";
import { daErrorResponse } from "@/lib/da-internal";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${rateKey(req, "da-intent-poll")}:${user.id}`, 240, 60_000)) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await getDonationIntentForUser(user.id, id));
  } catch (error) {
    return daErrorResponse(error);
  }
}
