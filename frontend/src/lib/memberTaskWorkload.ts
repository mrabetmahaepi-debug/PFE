import { normalizeTaskStatutKey } from './listStatusGroups';
import type { Tache } from '../types/task';

export type MemberWorkloadCounts = {
  todo: number;
  aFaire: number;
  enCours: number;
  enRetard: number;
  termine: number;
  total: number;
};

export type MemberWorkloadSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  gradientEnd?: string;
};

/** Pastel educational palette — Member Dashboard donut only (not workspace overview). */
export const MEMBER_DASHBOARD_WORKLOAD_COLORS = {
  a_faire: '#BFD9EA',
  en_cours: '#B9E7B4',
  en_retard: '#F4A0A8',
  terminee: '#C7A5E8',
} as const;

/** Member → Mon espace — Workload by Status palette. */
export const MEMBER_MON_ESPACE_WORKLOAD_COLORS = {
  a_faire: '#8892A6',
  en_cours: '#7B68EE',
  en_retard: '#FF5A5F',
  terminee: '#20C997',
} as const;

const DASHBOARD_GRADIENT_END: Record<keyof typeof MEMBER_DASHBOARD_WORKLOAD_COLORS, string> = {
  a_faire: '#A8C9DE',
  en_cours: '#A5D9A0',
  en_retard: '#E88A94',
  terminee: '#B894E0',
};

const SEGMENT_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  a_faire: '#7B68EE',
  en_cours: '#3b82f6',
  en_retard: '#f59e0b',
  terminee: '#22c55e',
};

function isPastDueNotDone(task: Tache): boolean {
  const key = normalizeTaskStatutKey(task.statut_t);
  if (key === 'terminee') return false;
  if (!task.date_limite_t) return false;
  const due = new Date(task.date_limite_t);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Exclusive buckets for member workload chart (ClickUp-style). */
export function computeMemberWorkload(tasks: Tache[]): MemberWorkloadCounts {
  let todo = 0;
  let aFaire = 0;
  let enCours = 0;
  let enRetard = 0;
  let termine = 0;

  for (const task of tasks) {
    const key = normalizeTaskStatutKey(task.statut_t);

    if (key === 'terminee') {
      termine += 1;
      continue;
    }
    if (key === 'en_retard' || isPastDueNotDone(task)) {
      enRetard += 1;
      continue;
    }
    if (key === 'en_cours') {
      enCours += 1;
      continue;
    }
    if (key === 'todo_open') {
      todo += 1;
      continue;
    }
    aFaire += 1;
  }

  return {
    todo,
    aFaire,
    enCours,
    enRetard,
    termine,
    total: tasks.length,
  };
}

export function workloadToChartSegments(
  counts: MemberWorkloadCounts
): MemberWorkloadSegment[] {
  const rows: MemberWorkloadSegment[] = [
    { key: 'todo', label: 'TO DO', value: counts.todo, color: SEGMENT_COLORS.todo },
    { key: 'a_faire', label: 'À FAIRE', value: counts.aFaire, color: SEGMENT_COLORS.a_faire },
    { key: 'en_cours', label: 'EN COURS', value: counts.enCours, color: SEGMENT_COLORS.en_cours },
    {
      key: 'en_retard',
      label: 'EN RETARD',
      value: counts.enRetard,
      color: SEGMENT_COLORS.en_retard,
    },
    {
      key: 'terminee',
      label: 'TERMINÉ',
      value: counts.termine,
      color: SEGMENT_COLORS.terminee,
    },
  ];
  return rows.filter((r) => r.value > 0);
}

/** Donut segments for dashboard (4 main statuses, merges todo into à faire). */
export function workloadToDashboardChartSegments(
  counts: MemberWorkloadCounts
): MemberWorkloadSegment[] {
  const rows: MemberWorkloadSegment[] = [
    {
      key: 'a_faire',
      label: 'À FAIRE',
      value: counts.aFaire + counts.todo,
      color: MEMBER_DASHBOARD_WORKLOAD_COLORS.a_faire,
      gradientEnd: DASHBOARD_GRADIENT_END.a_faire,
    },
    {
      key: 'en_cours',
      label: 'EN COURS',
      value: counts.enCours,
      color: MEMBER_DASHBOARD_WORKLOAD_COLORS.en_cours,
      gradientEnd: DASHBOARD_GRADIENT_END.en_cours,
    },
    {
      key: 'en_retard',
      label: 'EN RETARD',
      value: counts.enRetard,
      color: MEMBER_DASHBOARD_WORKLOAD_COLORS.en_retard,
      gradientEnd: DASHBOARD_GRADIENT_END.en_retard,
    },
    {
      key: 'terminee',
      label: 'TERMINÉ',
      value: counts.termine,
      color: MEMBER_DASHBOARD_WORKLOAD_COLORS.terminee,
      gradientEnd: DASHBOARD_GRADIENT_END.terminee,
    },
  ];
  return rows.filter((r) => r.value > 0);
}

/** Donut + legend for Member → Mon espace (4 statuses, todo merged into à faire). */
export function workloadToMonEspaceChartSegments(
  counts: MemberWorkloadCounts
): MemberWorkloadSegment[] {
  const rows: MemberWorkloadSegment[] = [
    {
      key: 'a_faire',
      label: 'À FAIRE',
      value: counts.aFaire + counts.todo,
      color: MEMBER_MON_ESPACE_WORKLOAD_COLORS.a_faire,
    },
    {
      key: 'en_cours',
      label: 'EN COURS',
      value: counts.enCours,
      color: MEMBER_MON_ESPACE_WORKLOAD_COLORS.en_cours,
    },
    {
      key: 'en_retard',
      label: 'EN RETARD',
      value: counts.enRetard,
      color: MEMBER_MON_ESPACE_WORKLOAD_COLORS.en_retard,
    },
    {
      key: 'terminee',
      label: 'TERMINÉ',
      value: counts.termine,
      color: MEMBER_MON_ESPACE_WORKLOAD_COLORS.terminee,
    },
  ];
  return rows.filter((r) => r.value > 0);
}

export function dashboardStatusCounts(counts: MemberWorkloadCounts) {
  return {
    aFaire: counts.aFaire + counts.todo,
    enCours: counts.enCours,
    enRetard: counts.enRetard,
    termine: counts.termine,
  };
}
