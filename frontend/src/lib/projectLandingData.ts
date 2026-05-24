import { formatRecentActivityTime } from './formatRecentActivityTime';
import { countMemberTermineeTasks } from './memberAssignedFilters';
import {
  buildMemberProjectOverviewData,
  getSprintStatusLabel,
  type MemberProjectTaskRow,
} from './memberProjectOverview';
import { isChefDeProjetMemberRole } from './projectRoleLabels';
import type { ProjectTree, TreeSprintNode } from '../types/hierarchy';
import type { Tache } from '../types/task';

export type ProjectLandingSprintCard = {
  id: number;
  name: string;
  dateLabel: string;
  listCount: number;
  taskCount: number;
  progressPercent: number;
  status: string;
};

export type ProjectLandingRecentItem = {
  id: number;
  line: string;
  time: string;
  sortTs: number;
};

export type ProjectLandingData = {
  summary: {
    sprints: number;
    lists: number;
    tasks: number;
    progressionPercent: number;
  };
  sprintCards: ProjectLandingSprintCard[];
  recentActivity: ProjectLandingRecentItem[];
  assignedTaskRows: MemberProjectTaskRow[];
  assignedSectionTitle: string;
  isChefView: boolean;
};

function formatSprintDateRange(sprint: TreeSprintNode): string {
  const start = sprint.date_debut_s
    ? new Date(sprint.date_debut_s).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  const end = sprint.date_fin_s
    ? new Date(sprint.date_fin_s).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  if (start && end) return `${start} – ${end}`;
  return start || end || '—';
}

function taskActivityTimestamp(task: Tache): number {
  const raw = task.updatedAt ?? task.createdAt;
  if (!raw) return 0;
  const n = new Date(raw).getTime();
  return Number.isNaN(n) ? 0 : n;
}

function recentActivityLine(task: Tache): string {
  const updated = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
  const created = task.createdAt ? new Date(task.createdAt).getTime() : 0;
  if (created && (!updated || Math.abs(created - updated) < 2000)) {
    return `Tâche créée : ${task.nom_t || 'Sans titre'}`;
  }
  return `Tâche mise à jour : ${task.nom_t || 'Sans titre'}`;
}

export function buildProjectLandingData(
  tree: ProjectTree | null,
  tasks: Tache[],
  options?: {
    userId?: number;
    progressionPercent?: number | null;
  }
): ProjectLandingData {
  const base = buildMemberProjectOverviewData(tree, tasks);
  const role = tree?.currentUserProjectRole ?? null;
  const isChefView = isChefDeProjetMemberRole(role);
  const userId = options?.userId ?? 0;

  const progressionPercent =
    options?.progressionPercent != null && Number.isFinite(options.progressionPercent)
      ? Math.round(Math.min(100, Math.max(0, options.progressionPercent)))
      : base.summary.tasks > 0
        ? Math.round((base.summary.completed / base.summary.tasks) * 100)
        : 0;

  const sprintCards: ProjectLandingSprintCard[] = (tree?.sprints ?? []).map(
    (sprint) => {
      const sprintTasks = tasks.filter(
        (t) => Number(t.id_sprint) === Number(sprint.id_sprint)
      );
      const done = countMemberTermineeTasks(sprintTasks);
      const total = sprintTasks.length;
      const row = base.sprints.find((s) => s.id === sprint.id_sprint);
      return {
        id: sprint.id_sprint,
        name: sprint.nom_s || `Sprint #${sprint.id_sprint}`,
        dateLabel: formatSprintDateRange(sprint),
        listCount: row?.listCount ?? (sprint.lists ?? []).length,
        taskCount: row?.taskCount ?? total,
        progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
        status: getSprintStatusLabel(sprint),
      };
    }
  );

  const recentActivity: ProjectLandingRecentItem[] = [...tasks]
    .map((task) => {
      const sortTs = taskActivityTimestamp(task);
      const dateIso = task.updatedAt ?? task.createdAt ?? '';
      return {
        id: task.id_tache,
        line: recentActivityLine(task),
        time: dateIso ? formatRecentActivityTime(dateIso) : '—',
        sortTs,
      };
    })
    .filter((item) => item.sortTs > 0)
    .sort((a, b) => b.sortTs - a.sortTs)
    .slice(0, 10);

  const scopedTasks = isChefView
    ? tasks
    : tasks.filter((t) => Number(t.assigne_a) === userId);

  const scopedIds = new Set(scopedTasks.map((t) => t.id_tache));
  const assignedTaskRows = base.taskRows.filter((row) => scopedIds.has(row.id));

  return {
    summary: {
      sprints: base.summary.sprints,
      lists: base.summary.lists,
      tasks: base.summary.tasks,
      progressionPercent,
    },
    sprintCards,
    recentActivity,
    assignedTaskRows,
    assignedSectionTitle: isChefView
      ? 'Tâches du projet'
      : 'Mes tâches assignées',
    isChefView,
  };
}
