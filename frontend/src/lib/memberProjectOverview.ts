import { KANBAN_WORKFLOW_COLUMNS } from './kanbanWorkflowColumns';
import { normalizeTaskStatutKey } from './listStatusGroups';
import {
  statutKeyToPillTone,
  type MemberStatusPillTone,
  type MemberPriorityPillTone,
  memberListPriorityLabel,
  taskPriorityToPillTone,
} from './memberStatusPill';
import { countMemberTermineeTasks } from './memberAssignedFilters';
import { MEMBER_DASHBOARD_PROJECT_NAME } from './memberDashboardNavigation';
import type { ProjectTree, TreeListNode, TreeSprintNode } from '../types/hierarchy';
import type { Tache } from '../types/task';

export type MemberProjectSprintRow = {
  id: number;
  name: string;
  listCount: number;
  taskCount: number;
  status: string;
  statusTone: MemberStatusPillTone;
};

export type MemberProjectListRow = {
  id: number;
  name: string;
  sprintName: string;
  taskCount: number;
};

export type MemberProjectTaskRow = {
  id: number;
  name: string;
  sprintName: string;
  listName: string;
  statusLabel: string;
  statusTone: MemberStatusPillTone;
  dueLabel: string;
  priorityLabel: string;
  priorityTone: MemberPriorityPillTone;
  sortSprint: string;
  sortList: string;
};

export type MemberProjectOverviewSummary = {
  sprints: number;
  lists: number;
  tasks: number;
  completed: number;
};

export type MemberProjectOverviewData = {
  summary: MemberProjectOverviewSummary;
  sprints: MemberProjectSprintRow[];
  lists: MemberProjectListRow[];
  taskRows: MemberProjectTaskRow[];
};

function formatDateFr(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function getSprintStatusLabel(sprint: TreeSprintNode): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = sprint.date_debut_s ? new Date(sprint.date_debut_s) : null;
  const end = sprint.date_fin_s ? new Date(sprint.date_fin_s) : null;
  if (start && !Number.isNaN(start.getTime())) {
    start.setHours(0, 0, 0, 0);
    if (today.getTime() < start.getTime()) return 'À venir';
  }
  if (end && !Number.isNaN(end.getTime())) {
    end.setHours(0, 0, 0, 0);
    if (today.getTime() > end.getTime()) return 'Terminé';
  }
  return 'En cours';
}

function taskStatusLabel(statut?: string | null): string {
  const key = normalizeTaskStatutKey(statut);
  const col = KANBAN_WORKFLOW_COLUMNS.find((c) => c.id === key);
  if (col) return col.label;
  if (key === 'todo' || key === 'todo_open') return 'À FAIRE';
  return String(statut ?? '—').toUpperCase();
}

/** Sprint lifecycle label → badge tone (Gestion de projet tables). */
export function sprintLifecycleToPillTone(status: string): MemberStatusPillTone {
  if (status === 'Terminé') return 'green';
  if (status === 'En cours') return 'purple';
  return 'gray';
}

function buildLookupMaps(sprints: TreeSprintNode[]) {
  const sprintById = new Map<number, TreeSprintNode>();
  const listById = new Map<number, { list: TreeListNode; sprintName: string }>();

  for (const sprint of sprints) {
    sprintById.set(sprint.id_sprint, sprint);
    for (const list of sprint.lists ?? []) {
      listById.set(list.id_list, {
        list,
        sprintName: sprint.nom_s || `Sprint #${sprint.id_sprint}`,
      });
    }
  }

  return { sprintById, listById };
}

function countTasksForSprint(tasks: Tache[], sprintId: number): number {
  return tasks.filter((t) => Number(t.id_sprint) === sprintId).length;
}

function countTasksForList(tasks: Tache[], listId: number): number {
  return tasks.filter((t) => Number(t.id_list) === listId).length;
}

export function buildMemberProjectOverviewData(
  tree: ProjectTree | null,
  tasks: Tache[]
): MemberProjectOverviewData {
  const sprints = [...(tree?.sprints ?? [])].sort((a, b) =>
    (a.nom_s || '').localeCompare(b.nom_s || '', 'fr', { sensitivity: 'base' })
  );
  const { sprintById, listById } = buildLookupMaps(sprints);

  const allLists: MemberProjectListRow[] = [];
  for (const sprint of sprints) {
    const sprintName = sprint.nom_s || `Sprint #${sprint.id_sprint}`;
    for (const list of sprint.lists ?? []) {
      allLists.push({
        id: list.id_list,
        name: list.nom || `Liste #${list.id_list}`,
        sprintName,
        taskCount: countTasksForList(tasks, list.id_list),
      });
    }
  }

  const sprintRows: MemberProjectSprintRow[] = sprints.map((sprint) => {
    const status = getSprintStatusLabel(sprint);
    return {
      id: sprint.id_sprint,
      name: sprint.nom_s || `Sprint #${sprint.id_sprint}`,
      listCount: (sprint.lists ?? []).length,
      taskCount: countTasksForSprint(tasks, sprint.id_sprint),
      status,
      statusTone: sprintLifecycleToPillTone(status),
    };
  });

  const taskRows: MemberProjectTaskRow[] = tasks.map((task) => {
    const listMeta = task.id_list ? listById.get(Number(task.id_list)) : undefined;
    const sprint =
      task.id_sprint != null
        ? sprintById.get(Number(task.id_sprint))
        : undefined;
    const sprintName =
      listMeta?.sprintName ??
      sprint?.nom_s ??
      (task.id_sprint ? `Sprint #${task.id_sprint}` : '—');
    const listName =
      listMeta?.list.nom ??
      (task.id_list ? `Liste #${task.id_list}` : '—');

    return {
      id: task.id_tache,
      name: task.nom_t || '—',
      sprintName,
      listName,
      statusLabel: taskStatusLabel(task.statut_t),
      statusTone: statutKeyToPillTone(task.statut_t ?? ''),
      dueLabel: formatDateFr(task.date_limite_t),
      priorityLabel: memberListPriorityLabel(task.priorite_t),
      priorityTone: taskPriorityToPillTone(task.priorite_t),
      sortSprint: sprintName.toLowerCase(),
      sortList: listName.toLowerCase(),
    };
  });

  taskRows.sort((a, b) => {
    const s = a.sortSprint.localeCompare(b.sortSprint, 'fr', { sensitivity: 'base' });
    if (s !== 0) return s;
    const l = a.sortList.localeCompare(b.sortList, 'fr', { sensitivity: 'base' });
    if (l !== 0) return l;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });

  return {
    summary: {
      sprints: sprints.length,
      lists: allLists.length,
      tasks: tasks.length,
      completed: countMemberTermineeTasks(tasks),
    },
    sprints: sprintRows,
    lists: allLists,
    taskRows,
  };
}

export function isMemberGestionProjetProject(
  projectName: string | null | undefined
): boolean {
  return (
    String(projectName ?? '')
      .trim()
      .toLowerCase() === MEMBER_DASHBOARD_PROJECT_NAME.trim().toLowerCase()
  );
}
