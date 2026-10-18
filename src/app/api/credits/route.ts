import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ensureRuntimeSeed } from "@/lib/seed-runtime";

export async function GET() {
  await ensureRuntimeSeed();
  const user = await getCurrentUser();
  const packages = await db.creditPackage.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
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
      take: 50,
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
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      starsPrice: p.starsPrice,
      bonus: p.bonus,
      popular: p.popular,
    })),
    balance: user?.credits ?? 0,
    transactions,
  });
}
