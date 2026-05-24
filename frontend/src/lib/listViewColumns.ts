export type ListViewColumnKey =
  | 'checkbox'
  | 'name'
  | 'assignee'
  | 'dueDate'
  | 'priority'
  | 'status';

export const CLICKUP_LIST_COLUMN_DEFS: {
  key: ListViewColumnKey;
  label: string;
}[] = [
  { key: 'checkbox', label: '' },
  { key: 'name', label: 'Nom' },
  { key: 'assignee', label: 'Assigné' },
  { key: 'dueDate', label: "Date d'échéance" },
  { key: 'priority', label: 'Priorité' },
  { key: 'status', label: 'Statut' },
];

export const DEFAULT_CLICKUP_VISIBLE_COLUMNS: Record<ListViewColumnKey, boolean> =
  {
    checkbox: true,
    name: true,
    assignee: true,
    dueDate: true,
    priority: true,
    status: true,
  };
