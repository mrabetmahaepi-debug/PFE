export type MemberRecentKind = 'project' | 'sprint' | 'list' | 'task';

export type MemberRecentEntry = {
  kind: MemberRecentKind;
  id: number;
  name: string;
  parentName: string;
  openedAt: string;
  spaceId?: number;
  projectId?: number;
  sprintId?: number;
  listId?: number;
};

const STORAGE_KEY = 'member-space-recent-v1';
const MAX_ENTRIES = 24;

function readAll(): MemberRecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MemberRecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: MemberRecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

function entryKey(kind: MemberRecentKind, id: number): string {
  return `${kind}:${id}`;
}

export function recordMemberRecent(entry: Omit<MemberRecentEntry, 'openedAt'>): void {
  const openedAt = new Date().toISOString();
  const next: MemberRecentEntry = { ...entry, openedAt };
  const key = entryKey(entry.kind, entry.id);
  const rest = readAll().filter((e) => entryKey(e.kind, e.id) !== key);
  writeAll([next, ...rest]);
}

export function getMemberRecentOpens(limit = 12): MemberRecentEntry[] {
  return readAll()
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
    .slice(0, limit);
}
