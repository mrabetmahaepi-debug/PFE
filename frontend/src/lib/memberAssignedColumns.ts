export type MemberAssignedColumnKey =
  | 'name'
  | 'assignee'
  | 'dueDate'
  | 'priority'
  | 'comments'
  | 'assignedComments'
  | 'createdBy';

export type MemberAssignedColumnVisibility = Record<
  MemberAssignedColumnKey,
  boolean
>;

const STORAGE_KEY = 'virtide:member-assigned-columns-v1';

export const MEMBER_ASSIGNED_COLUMN_LABELS: Record<
  MemberAssignedColumnKey,
  string
> = {
  name: 'Nom de la tâche',
  assignee: 'Assigné',
  dueDate: 'Date d\'échéance',
  priority: 'Priorité',
  comments: 'Commentaires',
  assignedComments: 'Commentaires assignés',
  createdBy: 'Créé par',
};

/** Assigné column omitted on Assigné à moi (tasks are already assigned to the member). */
export const MEMBER_ASSIGNED_VISIBLE_KEYS: MemberAssignedColumnKey[] = [
  'name',
  'dueDate',
  'priority',
];

export const MEMBER_ASSIGNED_HIDDEN_KEYS: MemberAssignedColumnKey[] = [
  'comments',
  'assignedComments',
  'createdBy',
];

export const DEFAULT_MEMBER_ASSIGNED_COLUMNS: MemberAssignedColumnVisibility =
  {
    name: true,
    assignee: false,
    dueDate: true,
    priority: true,
    comments: false,
    assignedComments: false,
    createdBy: false,
  };

export function loadMemberAssignedColumnVisibility(): MemberAssignedColumnVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEMBER_ASSIGNED_COLUMNS };
    const parsed = JSON.parse(raw) as Partial<MemberAssignedColumnVisibility>;
    return { ...DEFAULT_MEMBER_ASSIGNED_COLUMNS, ...parsed, assignee: false };
  } catch {
    return { ...DEFAULT_MEMBER_ASSIGNED_COLUMNS };
  }
}

export function saveMemberAssignedColumnVisibility(
  visibility: MemberAssignedColumnVisibility
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    /* ignore quota errors */
  }
}

export function getOrderedVisibleColumns(
  visibility: MemberAssignedColumnVisibility
): MemberAssignedColumnKey[] {
  return [...MEMBER_ASSIGNED_VISIBLE_KEYS, ...MEMBER_ASSIGNED_HIDDEN_KEYS].filter(
    (k) => visibility[k]
  );
}
