import { Prisma } from "@prisma/client";

/** True when `utilisateur_access_grant(s)` table is not migrated yet. */
export function isMissingAccessGrantsTable(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    const msg = String((err as Error)?.message || err || "");
    return (
      /does not exist/i.test(msg) &&
      /utilisateur_access_grant/i.test(msg)
    );
  }
  if (err.code === "P2021") return true;
  const meta = err.meta as { table?: string } | undefined;
  const t = meta?.table;
  if (t && /utilisateur_access_grant/i.test(String(t))) return true;
  const msg = String(err.message || "");
  return (
    /does not exist/i.test(msg) &&
    /utilisateur_access_grant/i.test(msg)
  );
}
