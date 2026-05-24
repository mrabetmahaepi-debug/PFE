import prisma from "../prisma/prismaClient";

const db = prisma as any;

export const DEFAULT_LIST_STATUSES = [
  { label: "À faire", statut_key: "todo", position: 0 },
  { label: "En cours", statut_key: "en_cours", position: 1 },
  { label: "En retard", statut_key: "en_retard", position: 2 },
  { label: "Terminé", statut_key: "terminee", position: 3 },
  { label: "Bloquée", statut_key: "bloquee", position: 4 },
  { label: "En révision", statut_key: "en_revision", position: 5 },
] as const;

export async function ensureListStatuses(id_list: number) {
  let existing = await db.list_status_pm.findMany({
    where: { id_list },
    orderBy: [{ position: "asc" }, { id_status: "asc" }],
  });

  if (existing.length === 0) {
    for (const row of DEFAULT_LIST_STATUSES) {
      await db.list_status_pm.create({
        data: {
          id_list,
          label: row.label,
          statut_key: row.statut_key,
          position: row.position,
          is_system: true,
        },
      });
    }
  } else {
    for (const row of DEFAULT_LIST_STATUSES) {
      const found = existing.find((e: any) => e.statut_key === row.statut_key);
      if (!found) {
        await db.list_status_pm.create({
          data: {
            id_list,
            label: row.label,
            statut_key: row.statut_key,
            position: row.position,
            is_system: true,
          },
        });
      } else if (found.is_system) {
        await db.list_status_pm.update({
          where: { id_status: found.id_status },
          data: { label: row.label },
        });
      }
    }
  }

  return db.list_status_pm.findMany({
    where: { id_list },
    orderBy: [{ position: "asc" }, { id_status: "asc" }],
  });
}

export async function createListStatus(
  id_list: number,
  label: string
): Promise<any> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Le nom du statut est obligatoire");

  const base = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  let statut_key = base || `custom_${Date.now()}`;
  let suffix = 1;
  while (
    await db.list_status_pm.findFirst({
      where: { id_list, statut_key },
    })
  ) {
    statut_key = `${base}_${suffix++}`;
  }

  const maxPos = await db.list_status_pm.aggregate({
    where: { id_list },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  return db.list_status_pm.create({
    data: {
      id_list,
      label: trimmed,
      statut_key,
      position,
      is_system: false,
    },
  });
}
