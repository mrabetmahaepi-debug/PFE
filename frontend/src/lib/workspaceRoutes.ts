/** Path builders and parsers for workspace sidebar navigation. */

import type { SpaceTreeNode } from '../types/hierarchy';

export const appPaths = {
  home: '/home',
  inbox: '/inbox',
  docs: '/docs',
  dashboard: '/dashboard',
  projects: '/projects',
  team: '/team',
  settings: '/settings',
  spaces: '/spaces',
  /** Membre — alias vers le space « Mon espace » (redirige après chargement hierarchy). */
  monEspace: '/mon-espace',
  space: (spaceId: number | string) => `/spaces/${spaceId}`,
  folder: (spaceId: number | string, folderId: number | string) =>
    `/spaces/${spaceId}/folders/${folderId}`,
  /** Canonical list URL (includes sprint when known). */
  list: (
    spaceId: number | string,
    folderId: number | string,
    sprintId: number | string,
    listId: number | string
  ) =>
    `/spaces/${spaceId}/folders/${folderId}/sprints/${sprintId}/lists/${listId}`,
  /** Legacy list URL without sprint segment. */
  listLegacy: (
    spaceId: number | string,
    folderId: number | string,
    listId: number | string
  ) => `/spaces/${spaceId}/folders/${folderId}/lists/${listId}`,
  task: (taskId: number | string) => `/tasks/${taskId}`,
  /** Dedicated list task page (canonical navigation from sidebar). */
  listView: (listId: number | string) => `/lists/${listId}`,
} as const;

const LIST_VIEW_RE = /^\/lists\/(\d+)\/?$/;

export function parseListViewPath(pathname: string): number | null {
  const m = pathname.match(LIST_VIEW_RE);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

export type WorkspacePathIds = {
  spaceId: number | null;
  folderId: number | null;
  sprintId: number | null;
  listId: number | null;
};

const SPACES_WITH_SPRINT_RE =
  /^\/spaces\/(\d+)\/folders\/(\d+)\/sprints\/(\d+)\/lists\/(\d+)\/?$/;

const SPACES_LEGACY_LIST_RE =
  /^\/spaces\/(\d+)\/folders\/(\d+)\/lists\/(\d+)\/?$/;

const SPACES_FOLDER_RE = /^\/spaces\/(\d+)\/folders\/(\d+)\/?$/;

const SPACES_SPACE_RE = /^\/spaces\/(\d+)\/?$/;

export function parseWorkspacePath(pathname: string): WorkspacePathIds {
  let m = pathname.match(SPACES_WITH_SPRINT_RE);
  if (m) {
    return {
      spaceId: Number(m[1]),
      folderId: Number(m[2]),
      sprintId: Number(m[3]),
      listId: Number(m[4]),
    };
  }
  m = pathname.match(SPACES_LEGACY_LIST_RE);
  if (m) {
    return {
      spaceId: Number(m[1]),
      folderId: Number(m[2]),
      sprintId: null,
      listId: Number(m[3]),
    };
  }
  m = pathname.match(SPACES_FOLDER_RE);
  if (m) {
    return {
      spaceId: Number(m[1]),
      folderId: Number(m[2]),
      sprintId: null,
      listId: null,
    };
  }
  m = pathname.match(SPACES_SPACE_RE);
  if (m) {
    return { spaceId: Number(m[1]), folderId: null, sprintId: null, listId: null };
  }
  return { spaceId: null, folderId: null, sprintId: null, listId: null };
}

/** Build list path; uses sprint segment when list has id_sprint. */
export function buildListPath(
  spaceId: number,
  folderId: number,
  listId: number,
  sprintId?: number | null
): string {
  if (sprintId != null && Number.isFinite(sprintId)) {
    return appPaths.list(spaceId, folderId, sprintId, listId);
  }
  return appPaths.listLegacy(spaceId, folderId, listId);
}

export function findListInSpaces(
  spaces: SpaceTreeNode[],
  listId: number
): { spaceId: number; folderId: number; sprintId: number | null; list: { id_list: number; id_sprint?: number | null } } | null {
  for (const space of spaces) {
    for (const project of space.projects || []) {
      for (const sprint of project.sprints || []) {
        for (const list of sprint.lists || []) {
          if (list.id_list === listId) {
            return {
              spaceId: space.id_space,
              folderId: project.id_projet,
              sprintId: list.id_sprint ?? sprint.id_sprint ?? null,
              list,
            };
          }
        }
      }
    }
  }
  return null;
}

export function parseTaskPath(pathname: string): number | null {
  const m = pathname.match(/^\/tasks\/(\d+)\/?$/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}
