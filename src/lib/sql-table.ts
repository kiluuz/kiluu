import { Prisma } from "@prisma/client";

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function sqlTable(name: string): Prisma.Sql {
  const databaseUrl = process.env.DATABASE_URL || "";
  const table = quoteIdentifier(name);

  if (databaseUrl.startsWith("file:")) {
    return Prisma.raw(table);
  }

  const schema = new URL(databaseUrl).searchParams.get("schema") || "public";
  return Prisma.raw(`${quoteIdentifier(schema)}.${table}`);
}
