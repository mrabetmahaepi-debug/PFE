const STORAGE_PREFIX = 'virtide:project-hierarchy-expanded:';

export function loadProjectHierarchyExpanded(
  projectId: number
): Set<string> | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((k) => typeof k === 'string'));
  } catch {
    return null;
  }
}

export function saveProjectHierarchyExpanded(
  projectId: number,
  keys: Set<string>
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${projectId}`,
      JSON.stringify([...keys])
    );
  } catch {
    /* ignore quota */
  }
}

export function defaultExpandedKeysForTree(
  projectId: number,
  sprints: { id_sprint: number; lists?: { id_list: number; tasks?: unknown[] }[] }[]
): Set<string> {
  const keys = new Set<string>([`project:${projectId}`]);
  for (const sprint of sprints) {
    keys.add(`sprint:${sprint.id_sprint}`);
    for (const list of sprint.lists ?? []) {
      keys.add(`list:${list.id_list}`);
    }
  }
  return keys;
}
