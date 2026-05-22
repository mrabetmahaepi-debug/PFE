import React, { createContext, useContext } from 'react';
import type { HierarchyParentContext } from './CreateHierarchyItemModal';
import type { ClickUpColumnId } from './ClickUpKanbanBoard';
import type { Tache } from '../types/task';
import type { TaskFieldPatch } from './ListStatusGroupedView';

export interface ListPageContextValue {
  listId: number;
  listName: string;
  projectName: string;
  parentCtx: HierarchyParentContext;
  tasks: Tache[];
  canCreateTask: boolean;
  canEditTask: boolean;
  highlightTaskId?: number | null;
  onOpenCreateTask: (statutKey?: string, dueDateIso?: string) => void;
  onTaskClick?: (task: Tache) => void;
  onStatusesChange: () => void;
  assigneeOptions: { id: number; label: string }[];
  projectMembers: { id: number; label: string }[];
  onTaskFieldChange: (taskId: number, patch: TaskFieldPatch) => void | Promise<void>;
  onTaskStatusChange: (taskId: number, statutKey: string) => void | Promise<void>;
  onBoardMove: (taskId: number, statutKey: ClickUpColumnId) => void | Promise<void>;
  savingStatusTaskId: number | null;
}

const ListPageContext = createContext<ListPageContextValue | null>(null);

export function ListPageProvider({
  value,
  children,
}: {
  value: ListPageContextValue;
  children: React.ReactNode;
}) {
  return (
    <ListPageContext.Provider value={value}>{children}</ListPageContext.Provider>
  );
}

export function useListPageContext(listId: number): ListPageContextValue {
  const ctx = useContext(ListPageContext);
  if (!ctx || ctx.listId !== listId) {
    throw new Error('ListPageContext: invalid or missing provider for listId');
  }
  return ctx;
}
