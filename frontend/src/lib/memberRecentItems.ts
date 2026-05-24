import type { EnterpriseActivityItem } from '../services/activity.service';
import type { SpaceTreeNode } from '../types/hierarchy';
import { getMemberRecentOpens, type MemberRecentEntry } from './memberRecentStorage';

export type MemberRecentDisplayItem = {
  id: string;
  title: string;
  context: string;
  date: string;
  href?: string;
  kind: MemberRecentEntry['kind'] | 'activity';
};

const MON_ESPACE = 'Mon espace';

function formatContextLine(title: string, parent: string): { title: string; context: string } {
  return { title, context: `dans ${parent}` };
}

function hrefForRecent(entry: MemberRecentEntry): string | undefined {
  if (entry.kind === 'task') return `/tasks/${entry.id}`;
  if (entry.kind === 'list' && entry.listId) return `/lists/${entry.listId}`;
  if (entry.kind === 'project' && entry.projectId && entry.spaceId) {
    return `/spaces/${entry.spaceId}/folders/${entry.projectId}`;
  }
  if (entry.kind === 'sprint' && entry.sprintId && entry.projectId && entry.spaceId) {
    return `/spaces/${entry.spaceId}/folders/${entry.projectId}`;
  }
  return undefined;
}

function recentFromOpens(entries: MemberRecentEntry[]): MemberRecentDisplayItem[] {
  return entries.map((e) => {
    const { title, context } = formatContextLine(e.name, e.parentName);
    return {
      id: `open-${e.kind}-${e.id}`,
      title,
      context,
      date: e.openedAt,
      href: hrefForRecent(e),
      kind: e.kind,
    };
  });
}

function activityToRecent(item: EnterpriseActivityItem): MemberRecentDisplayItem | null {
  const label = (item.entityLabel || item.title || '').trim();
  if (!label) return null;

  if (item.entityType === 'project') {
    const { title, context } = formatContextLine(label, MON_ESPACE);
    return {
      id: item.id,
      title,
      context,
      date: item.date,
      href: item.entityId ? `/projects/${item.entityId}` : undefined,
      kind: 'project',
    };
  }

  if (item.entityType === 'task' && item.entityId) {
    const project = (item.subtitle || 'Projet').trim();
    return {
      id: item.id,
      title: label,
      context: `dans ${project}`,
      date: item.date,
      href: `/tasks/${item.entityId}`,
      kind: 'activity',
    };
  }

  if (/sprint/i.test(item.action) || /sprint/i.test(item.title || '')) {
    const project = (item.subtitle || 'Projet').trim();
    const { title, context } = formatContextLine(label, project);
    return {
      id: item.id,
      title,
      context,
      date: item.date,
      kind: 'sprint',
    };
  }

  return null;
}

/** Merge local recent opens + API activity into a deduped Recent feed. */
export function buildMemberRecentFeed(
  activities: EnterpriseActivityItem[],
  opens: MemberRecentEntry[] = getMemberRecentOpens(16),
  limit = 14
): MemberRecentDisplayItem[] {
  const fromOpens = recentFromOpens(opens);
  const fromActivity = activities
    .map(activityToRecent)
    .filter((x): x is MemberRecentDisplayItem => x != null);

  const seen = new Set<string>();
  const merged: MemberRecentDisplayItem[] = [];

  for (const item of [...fromOpens, ...fromActivity]) {
    const key = `${item.kind}:${item.title}:${item.context}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

/** Resolve parent names from hierarchy for sidebar recent tracking. */
export function findHierarchyContext(
  spaces: SpaceTreeNode[],
  opts: {
    projectId?: number;
    sprintId?: number;
    listId?: number;
  }
): {
  spaceId: number;
  spaceName: string;
  projectName: string;
  sprintName?: string;
  listName?: string;
} | null {
  for (const space of spaces) {
    for (const project of space.projects || []) {
      if (opts.projectId != null && project.id_projet !== opts.projectId) continue;
      if (opts.projectId == null && opts.sprintId == null && opts.listId == null) continue;

      for (const sprint of project.sprints || []) {
        if (opts.sprintId != null && sprint.id_sprint !== opts.sprintId) continue;
        for (const list of sprint.lists || []) {
          if (opts.listId != null && list.id_list !== opts.listId) continue;
          return {
            spaceId: space.id_space,
            spaceName: space.nom,
            projectName: project.nom_p,
            sprintName: sprint.nom_s,
            listName: list.nom,
          };
        }
        if (opts.sprintId != null && sprint.id_sprint === opts.sprintId) {
          return {
            spaceId: space.id_space,
            spaceName: space.nom,
            projectName: project.nom_p,
            sprintName: sprint.nom_s,
          };
        }
      }

      if (opts.projectId === project.id_projet) {
        return {
          spaceId: space.id_space,
          spaceName: space.nom,
          projectName: project.nom_p,
        };
      }
    }
  }
  return null;
}
