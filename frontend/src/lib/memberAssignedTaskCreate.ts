import type { Tache } from '../types/task';
import type { SpaceTreeNode } from '../types/hierarchy';
import { spaceService } from '../services/space.service';
import { findMonEspaceSpaceId } from './monEspaceRoute';
import { getMemberRecentOpens } from './memberRecentStorage';

export type MemberAssignedTaskCreateContext = {
  listId: number;
  projectId: number;
  sprintId: number | null;
  listLabel?: string;
};

const NO_CONTEXT_ERROR =
  'Ouvrez une liste dans Mon espace ou créez une tâche depuis un projet avant d\'ajouter une tâche ici.';

function contextFromTask(task: Tache): MemberAssignedTaskCreateContext | null {
  const listId = task.id_list != null ? Number(task.id_list) : NaN;
  const projectId = task.id_projet != null ? Number(task.id_projet) : NaN;
  if (!Number.isFinite(listId) || listId < 1 || !Number.isFinite(projectId) || projectId < 1) {
    return null;
  }
  const sprintId =
    task.id_sprint != null && Number(task.id_sprint) > 0
      ? Number(task.id_sprint)
      : null;
  return { listId, projectId, sprintId };
}

function firstListInSpaces(
  spaces: SpaceTreeNode[],
  preferSpaceId: number | null
): MemberAssignedTaskCreateContext | null {
  const ordered =
    preferSpaceId != null
      ? [
          ...spaces.filter((s) => s.id_space === preferSpaceId),
          ...spaces.filter((s) => s.id_space !== preferSpaceId),
        ]
      : spaces;

  for (const space of ordered) {
    for (const project of space.projects ?? []) {
      const projectId = Number(project.id_projet);
      if (!Number.isFinite(projectId) || projectId < 1) continue;
      for (const sprint of project.sprints ?? []) {
        const sprintId =
          sprint.id_sprint != null && Number(sprint.id_sprint) > 0
            ? Number(sprint.id_sprint)
            : null;
        for (const list of sprint.lists ?? []) {
          const listId = Number(list.id_list);
          if (!Number.isFinite(listId) || listId < 1) continue;
          return {
            listId,
            projectId,
            sprintId,
            listLabel: list.nom,
          };
        }
      }
    }
  }
  return null;
}

/** Resolve list/project for Member « Assigné à moi » task creation. */
export async function resolveMemberAssignedTaskCreateContext(
  assignedTasks: Tache[]
): Promise<MemberAssignedTaskCreateContext | { error: string }> {
  for (const task of assignedTasks) {
    const ctx = contextFromTask(task);
    if (ctx) return ctx;
  }

  for (const entry of getMemberRecentOpens(16)) {
    if (entry.kind !== 'list') continue;
    const listId = entry.listId ?? entry.id;
    const projectId = entry.projectId;
    if (
      listId != null &&
      Number.isFinite(listId) &&
      listId > 0 &&
      projectId != null &&
      Number.isFinite(projectId) &&
      projectId > 0
    ) {
      return {
        listId: Number(listId),
        projectId: Number(projectId),
        sprintId:
          entry.sprintId != null && Number(entry.sprintId) > 0
            ? Number(entry.sprintId)
            : null,
        listLabel: entry.name,
      };
    }
  }

  try {
    const { spaces } = await spaceService.getHierarchy();
    const monEspaceId = findMonEspaceSpaceId(spaces);
    const fromHierarchy = firstListInSpaces(spaces, monEspaceId);
    if (fromHierarchy) return fromHierarchy;
  } catch {
    /* fall through */
  }

  return { error: NO_CONTEXT_ERROR };
}
