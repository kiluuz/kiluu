import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Credit packages (in-app purchases simulated)
const CREDIT_PACKAGES = [
  { id: "starter", credits: 200, priceUsd: 1.99, bonus: 0, popular: false },
  { id: "basic", credits: 550, priceUsd: 4.99, bonus: 50, popular: true },
  { id: "plus", credits: 1200, priceUsd: 9.99, bonus: 200, popular: false },
  { id: "pro", credits: 2600, priceUsd: 19.99, bonus: 600, popular: false },
  { id: "mega", credits: 7000, priceUsd: 49.99, bonus: 2000, popular: false },
];

export async function GET() {
  const user = await getCurrentUser();
  let transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }> = [];
  if (user) {
    const tx = await db.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    transactions = tx.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }));
  }
  return NextResponse.json({
    packages: CREDIT_PACKAGES,
    balance: user?.credits ?? 0,
    transactions,
  });
}

// POST /api/credits - buy a credit package (simulated payment)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to buy credits" }, { status: 401 });

  try {
    const { packageId, paymentMethod } = await req.json();
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    if (!["card", "paypal", "crypto"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const totalCredits = pkg.credits + pkg.bonus;

    const result = await db.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: totalCredits,
          type: "TOPUP",
          description: `${pkg.credits} credits${pkg.bonus ? ` + ${pkg.bonus} bonus` : ""} via ${paymentMethod}`,
        },
      });
      return tx.user.update({
        where: { id: user.id },
        data: { credits: { increment: totalCredits } },
      });
    });

    return NextResponse.json({ success: true, credits: result.credits, added: totalCredits });
  } catch (e) {
    console.error("credits purchase error", e);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
