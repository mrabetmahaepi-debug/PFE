import type { Tache } from '../types/task';
import { normalizeTaskStatutKey } from './listStatusGroups';

export type KanbanWorkflowColumnId =
  | 'todo'
  | 'en_cours'
  | 'en_retard'
  | 'terminee';

export type KanbanBadgeTone = 'gray' | 'purple' | 'amber' | 'green';

export const KANBAN_WORKFLOW_COLUMNS: {
  id: KanbanWorkflowColumnId;
  label: string;
  badgeTone: KanbanBadgeTone;
}[] = [
  { id: 'todo', label: 'À FAIRE', badgeTone: 'gray' },
  { id: 'en_cours', label: 'EN COURS', badgeTone: 'purple' },
  { id: 'en_retard', label: 'EN RETARD', badgeTone: 'amber' },
  { id: 'terminee', label: 'TERMINÉ', badgeTone: 'green' },
];

export const KANBAN_WORKFLOW_COLUMN_IDS = KANBAN_WORKFLOW_COLUMNS.map(
  (c) => c.id
);

export type KanbanColumnsMap = Record<KanbanWorkflowColumnId, Tache[]>;

export const emptyKanbanColumns = (): KanbanColumnsMap => ({
  todo: [],
  en_cours: [],
  en_retard: [],
  terminee: [],
});

export function groupTasksByKanbanWorkflow(tasks: Tache[]): KanbanColumnsMap {
  const map = emptyKanbanColumns();
  for (const t of tasks) {
    const k = normalizeTaskStatutKey(t.statut_t);
    if (k === 'en_cours') map.en_cours.push(t);
    else if (k === 'en_retard') map.en_retard.push(t);
    else if (k === 'terminee') map.terminee.push(t);
    else map.todo.push(t);
  }
  return map;
}
