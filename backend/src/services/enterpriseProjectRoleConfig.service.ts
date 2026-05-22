import { Prisma } from "@prisma/client";
import prisma from "../prisma/prismaClient";
import {
  PROJECT_PERMISSION_KEYS,
  PROJECT_ROLE_BUCKETS,
  type StoredProjectRoleBucket,
  getDefaultPermissionsForBucket,
  isValidProjectPermissionSlug,
  normalizeProjectRoleBucket,
} from "../lib/projectRolePermissions";

/** Table absente tant que `npx prisma migrate deploy` n’a pas été exécuté sur cette base. */
function isMissingProjectRoleConfigTable(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === "P2021") return true;
  const meta = err.meta as { table?: string } | undefined;
  const t = meta?.table;
  if (t && String(t).toLowerCase().includes("entreprise_project_role_config")) {
    return true;
  }
  const msg = String(err.message || "");
  return (
    /does not exist/i.test(msg) &&
    /entreprise_project_role_config/i.test(msg)
  );
}

function sortSlugs(slugs: string[]): string[] {
  const order = new Map<string, number>(
    PROJECT_PERMISSION_KEYS.map((k, i) => [k, i])
  );
  return [...slugs].sort(
    (a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999)
  );
}

function cleanSlugArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const x of raw) {
    if (typeof x === "string" && isValidProjectPermissionSlug(x)) out.add(x);
  }
  return sortSlugs([...out]);
}

export type ProjectRolePermissionMatrix = Record<
  StoredProjectRoleBucket,
  string[]
>;

async function readConfigJsonSafe(
  id_entreprise: number
): Promise<Record<string, unknown> | null> {
  try {
    const row = await prisma.entreprise_project_role_config.findUnique({
      where: { id_entreprise },
      select: { config_json: true },
    });
    return (row?.config_json as Record<string, unknown> | null) ?? null;
  } catch (e) {
    if (isMissingProjectRoleConfigTable(e)) return null;
    throw e;
  }
}

export async function getEnterpriseProjectRoleMatrix(
  id_entreprise: number
): Promise<ProjectRolePermissionMatrix> {
  const stored = await readConfigJsonSafe(id_entreprise);
  const out = {} as ProjectRolePermissionMatrix;
  for (const key of PROJECT_ROLE_BUCKETS) {
    const custom = stored?.[key];
    const cleaned = cleanSlugArray(custom);
    if (cleaned.length > 0) {
      out[key] = cleaned;
    } else {
      out[key] = sortSlugs([...getDefaultPermissionsForBucket(key)]);
    }
  }
  return out;
}

const MIGRATION_HINT =
  "Exécutez les migrations Prisma sur le backend : `npx prisma migrate deploy` (dossier backend), puis redémarrez le serveur.";

export async function saveEnterpriseProjectRoleMatrix(
  id_entreprise: number,
  matrix: Record<string, unknown>
): Promise<ProjectRolePermissionMatrix> {
  const payload = {} as ProjectRolePermissionMatrix;
  for (const key of PROJECT_ROLE_BUCKETS) {
    const cleaned = cleanSlugArray(matrix[key]);
    if (cleaned.length === 0) {
      throw new Error(
        `Au moins une permission projet est requise pour le rôle ${key}.`
      );
    }
    payload[key] = cleaned;
  }
  try {
    await prisma.entreprise_project_role_config.upsert({
      where: { id_entreprise },
      create: { id_entreprise, config_json: payload as object },
      update: { config_json: payload as object },
    });
  } catch (e) {
    if (isMissingProjectRoleConfigTable(e)) {
      throw new Error(
        `La table de configuration des rôles projet est absente. ${MIGRATION_HINT}`
      );
    }
    throw e;
  }
  return payload;
}

export async function deleteEnterpriseProjectRoleConfig(
  id_entreprise: number
): Promise<void> {
  try {
    await prisma.entreprise_project_role_config.deleteMany({
      where: { id_entreprise },
    });
  } catch (e) {
    if (isMissingProjectRoleConfigTable(e)) return;
    throw e;
  }
}

/**
 * Permissions effectives pour un libellé `role_projet` dans une entreprise
 * (hors SuperAdmin / admin tenant fullAccess).
 */
export async function resolvePermissionsForProjectRoleLabel(
  id_entreprise: number,
  roleProjetLabel: string
): Promise<ReadonlySet<string>> {
  const bucket = normalizeProjectRoleBucket(roleProjetLabel);
  const storageKey: StoredProjectRoleBucket =
    bucket === "OTHER" ? "MEMBRE" : bucket;

  const stored = await readConfigJsonSafe(id_entreprise);
  const cleaned = cleanSlugArray(stored?.[storageKey]);
  if (cleaned.length > 0) return new Set(cleaned);
  return getDefaultPermissionsForBucket(storageKey);
}
