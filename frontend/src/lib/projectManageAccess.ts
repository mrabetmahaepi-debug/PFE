import type { User } from '../types/auth.types';
import {
  getRoleKey,
  isEnterpriseAdmin,
  isSuperAdmin,
} from './permissions';
import { isChefDeProjetMemberRole } from './projectRoleLabels';
import { projectCan } from './projectPermissions';
import { localRoleCanManageTeam } from './projectLocalRolePermissions';

export type ProjectManageContext = {
  id_projet?: number | null;
  chef_id?: number | null;
  chef_de_projet_id?: number | null;
  managerId?: number | null;
  responsibleId?: number | null;
  ownerId?: number | null;
  chefProjetId?: number | null;
  projectManagerId?: number | null;
  currentUserProjectRole?: string | null;
  currentUserPermissions?: string[] | null;
};

export function resolveUserNumericId(user?: User | null): number | null {
  if (!user) return null;
  const raw = user.id_utilisateur ?? user.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Map API / list payload to manager id fields used for permission checks. */
export function normalizeProjectManageContext(
  project: ProjectManageContext | Record<string, unknown> | null | undefined
): ProjectManageContext | null {
  if (!project || typeof project !== 'object') return null;
  const p = project as Record<string, unknown>;
  const chefFromList = Number(p.chef_id ?? p.chefId ?? 0);
  const chefFk = Number(
    p.chef_de_projet_id ?? p.chefProjetId ?? p.projectManagerId ?? p.projectManager ?? 0
  );
  const chefId = Number.isFinite(chefFromList) && chefFromList > 0 ? chefFromList : null;
  const chefDeProjet =
    Number.isFinite(chefFk) && chefFk > 0 ? chefFk : chefId;

  return {
    id_projet: Number(p.id_projet) || undefined,
    chef_id: chefId,
    chef_de_projet_id: chefDeProjet,
    chefProjetId: chefDeProjet,
    projectManagerId: chefDeProjet,
    managerId: Number(p.managerId ?? chefDeProjet ?? 0) || chefDeProjet,
    responsibleId: Number(p.responsibleId ?? chefId ?? 0) || chefId,
    ownerId: Number(p.ownerId ?? 0) || null,
    currentUserProjectRole:
      typeof p.currentUserProjectRole === 'string' ? p.currentUserProjectRole : null,
    currentUserPermissions: Array.isArray(p.currentUserPermissions)
      ? (p.currentUserPermissions as string[])
      : null,
  };
}

/** Local project role « Chef de projet » for this project (membre_projet.role_projet). */
export function isLocalProjectChef(
  project?: ProjectManageContext | Record<string, unknown> | null
): boolean {
  const ctx = normalizeProjectManageContext(project);
  return isChefDeProjetMemberRole(ctx?.currentUserProjectRole);
}

/** ADMIN / SUPER_ADMIN / local « Chef de projet » on this project only. */
export function canManageProject(
  user?: User | null,
  project?: ProjectManageContext | Record<string, unknown> | null
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isEnterpriseAdmin(user) || getRoleKey(user) === 'ADMIN') return true;
  return isLocalProjectChef(project);
}

export function canEditProject(
  user?: User | null,
  project?: ProjectManageContext | Record<string, unknown> | null
): boolean {
  return canManageProject(user, project);
}

export function canDeleteProject(
  user?: User | null,
  project?: ProjectManageContext | Record<string, unknown> | null
): boolean {
  return canManageProject(user, project);
}

/** Gérer l'équipe — local chef de projet, admin, or TEAM_MANAGE on this project. */
export function canManageProjectTeam(
  user?: User | null,
  project?: ProjectManageContext | Record<string, unknown> | null
): boolean {
  if (canManageProject(user, project)) return true;
  const ctx = normalizeProjectManageContext(project);
  if (localRoleCanManageTeam(ctx?.currentUserProjectRole)) return true;
  return projectCan(
    ctx?.currentUserPermissions,
    'TEAM_MANAGE'
  );
}

export function assertCanMutateProject(
  user: User | null | undefined,
  project: ProjectManageContext | Record<string, unknown> | null | undefined,
  _action: 'edit' | 'delete'
): void {
  if (!canManageProject(user, project)) {
    throw new Error('Permission refusée : vous ne pouvez pas modifier ou supprimer ce projet.');
  }
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function assertCanMutateProjectFromSession(
  project: ProjectManageContext | Record<string, unknown> | null | undefined,
  _action: 'edit' | 'delete'
): void {
  assertCanMutateProject(readStoredUser(), project, _action);
}

export function assertCanManageProjectTeamFromSession(
  project: ProjectManageContext | Record<string, unknown> | null | undefined,
  user?: User | null
): void {
  const actor = user ?? readStoredUser();
  if (!canManageProjectTeam(actor, project)) {
    throw new Error("Permission refusée : vous ne pouvez pas gérer l'équipe de ce projet.");
  }
}
