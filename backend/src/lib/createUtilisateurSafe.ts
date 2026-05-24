import prisma from "../prisma/prismaClient";
import { roleNomSelect } from "./utilisateurSelect";
import { resolveProjectPosteLabel } from "./projectRoleLabels";
import { logRoleAssignment } from "./roleAssignmentLog";

export type CreateUtilisateurSafeInput = {
  email: string;
  password?: string | null;
  id_role: number;
  id_entreprise?: number | null;
  nom: string;
  prenom: string;
  statut?: string;
  poste?: string | null;
  telephone?: string | null;
};

const reloadAfterRawSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  password: true,
  id_role: true,
  id_entreprise: true,
  poste: true,
  telephone: true,
  statut: true,
  role: { select: roleNomSelect },
} as const;

const reloadMinimalSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  password: true,
  id_role: true,
  id_entreprise: true,
  poste: true,
  role: { select: roleNomSelect },
} as const;

function isSchemaColumnMismatch(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  const code = (err as { code?: string })?.code;
  return (
    code === "P2022" ||
    /Unknown column|does not exist|doesn't exist|n'existe pas|Column not found/i.test(
      msg
    ) ||
    /\bisOnline\b|\blastSeen\b|\bcreatedAt\b|\blastLogin\b|\bphotoUrl\b/i.test(msg)
  );
}

async function readCreatedUser(id: number) {
  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: id },
      select: reloadAfterRawSelect,
    });
    if (user) return user as any;
  } catch (e) {
    console.warn("[createUtilisateurSafe] reload with statut failed:", e);
  }
  const user = await prisma.utilisateur.findUnique({
    where: { id_utilisateur: id },
    select: reloadMinimalSelect,
  });
  if (!user) throw new Error("Utilisateur introuvable après création");
  return { ...user, statut: (user as any).statut ?? null } as any;
}

/**
 * Create a utilisateur row. Uses Prisma `create` when the DB matches the schema;
 * falls back to legacy INSERT + reload when optional columns are missing.
 * INSERT + LAST_INSERT_ID run in one transaction so pooling cannot return 0.
 */
export async function createUtilisateurSafe(input: CreateUtilisateurSafeInput) {
  const statut = input.statut ?? "ACTIVE";
  const selectedRole = input.poste != null ? String(input.poste).trim() : "";
  const resolvedPoste = selectedRole ? resolveProjectPosteLabel(selectedRole) : null;

  const data: Record<string, unknown> = {
    email: input.email,
    id_role: input.id_role,
    id_entreprise: input.id_entreprise ?? undefined,
    nom: input.nom,
    prenom: input.prenom,
    statut,
  };
  if (input.password != null && input.password !== "") {
    data.password = input.password;
  }
  if (resolvedPoste) data.poste = resolvedPoste;
  if (input.telephone != null) data.telephone = input.telephone;

  let created: any;
  try {
    created = await prisma.utilisateur.create({
      data: data as any,
      include: { role: true },
    });
  } catch (err) {
    if (!isSchemaColumnMismatch(err)) throw err;
    console.warn(
      "[createUtilisateurSafe] prisma.create failed (DB/schema mismatch); using legacy INSERT:",
      err
    );
  }

  if (created) {
    logRoleAssignment("createUtilisateurSafe", {
      selectedRole: selectedRole || null,
      savedRole: resolvedPoste,
      loadedRole: created.poste ?? resolvedPoste,
      globalRoleNom: created.role?.nom ?? null,
      poste: created.poste ?? resolvedPoste,
      userId: created.id_utilisateur,
      email: created.email,
    });
    return created;
  }

  const idEnt = input.id_entreprise ?? null;
  const pwd = input.password ?? null;
  const poste = resolvedPoste;
  const tel = input.telephone ?? null;

  const newId = await prisma.$transaction(async (tx) => {
    const insertMinimal = async () => {
      await tx.$executeRaw`
        INSERT INTO utilisateur (email, password, id_role, id_entreprise, nom, prenom, statut)
        VALUES (${input.email}, ${pwd}, ${input.id_role}, ${idEnt}, ${input.nom}, ${input.prenom}, ${statut})
      `;
    };

    const insertWithCreatedAt = async () => {
      await tx.$executeRaw`
        INSERT INTO utilisateur (email, password, id_role, id_entreprise, nom, prenom, statut, createdAt)
        VALUES (${input.email}, ${pwd}, ${input.id_role}, ${idEnt}, ${input.nom}, ${input.prenom}, ${statut}, NOW(3))
      `;
    };

    const insertExtended = async () => {
      await tx.$executeRaw`
        INSERT INTO utilisateur (email, password, id_role, id_entreprise, nom, prenom, statut, poste, telephone)
        VALUES (${input.email}, ${pwd}, ${input.id_role}, ${idEnt}, ${input.nom}, ${input.prenom}, ${statut}, ${poste}, ${tel})
      `;
    };

    if (poste != null || tel != null) {
      try {
        await insertExtended();
      } catch (e1) {
        console.warn("[createUtilisateurSafe] extended INSERT failed, trying minimal:", e1);
        await insertMinimal();
      }
    } else {
      try {
        await insertMinimal();
      } catch (e2) {
        console.warn(
          "[createUtilisateurSafe] minimal INSERT failed, trying with createdAt:",
          e2
        );
        await insertWithCreatedAt();
      }
    }

    const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`
      SELECT LAST_INSERT_ID() AS id
    `;
    const raw = rows[0]?.id;
    const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
    return n;
  });

  if (!Number.isFinite(newId) || newId < 1) {
    throw new Error("Échec création utilisateur (identifiant invalide)");
  }

  const reloaded = await readCreatedUser(newId);
  logRoleAssignment("createUtilisateurSafe:legacy", {
    selectedRole: selectedRole || null,
    savedRole: resolvedPoste,
    loadedRole: reloaded.poste ?? resolvedPoste,
    globalRoleNom: reloaded.role?.nom ?? null,
    poste: reloaded.poste ?? resolvedPoste,
    userId: reloaded.id_utilisateur,
    email: reloaded.email,
  });
  return reloaded;
}
