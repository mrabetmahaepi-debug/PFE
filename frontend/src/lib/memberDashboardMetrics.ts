import { getTodayDateKey, isMemberTaskDone } from './taskDueDate';
import type { EnterpriseActivityItem } from '../services/activity.service';
import type { Tache } from '../types/task';
import { filterMemberChartActivities } from './memberDashboardChartEvents';

const FR_WEEKDAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] as const;

function weekdayLabelFr(d: Date): string {
  return FR_WEEKDAY_SHORT[d.getDay()] ?? 'dim';
}

export type MemberActivityDay = {
  label: string;
  count: number;
  dateKey: string;
};

export type MemberDashboardInsights = {
  completionRate: number;
  activityByDay: MemberActivityDay[];
};

export function computeCompletionRate(tasks: Tache[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => isMemberTaskDone(t)).length;
  return Math.round((done / tasks.length) * 100);
}

function activityDateKey(iso: string): string | null {
  const trimmed = iso?.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return getTodayDateKey(d);
}

export function buildActivityLast7Days(
  items: EnterpriseActivityItem[],
  now: Date = new Date()
): MemberActivityDay[] {
  const days: MemberActivityDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateKey = getTodayDateKey(d);
    const label = weekdayLabelFr(d);
    days.push({ label, count: 0, dateKey });
  }
  const allowed = new Set(days.map((d) => d.dateKey));
  const chartItems = filterMemberChartActivities(items);
  for (const item of chartItems) {
    const key = activityDateKey(item.date);
    if (!key || !allowed.has(key)) continue;
    const day = days.find((d) => d.dateKey === key);
    if (day) day.count += 1;
  }
  return days;
}

export function computeMemberDashboardInsights(
  tasks: Tache[],
  activityItems: EnterpriseActivityItem[],
  now: Date = new Date()
): MemberDashboardInsights {
  return {
    completionRate: computeCompletionRate(tasks),
    activityByDay: buildActivityLast7Days(activityItems, now),
  };
}
