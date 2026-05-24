import React from 'react';
import ListStatusGroupedView from './ListStatusGroupedView';
import { useListPageContext } from './listPageContext';
import type { ListViewColumnKey } from '../lib/listViewColumns';

export interface ListTaskViewProps {
  listId: number;
  searchQuery?: string;
  showClosed?: boolean;
  visibleColumns?: Partial<Record<ListViewColumnKey, boolean>>;
}

const ListTaskView: React.FC<ListTaskViewProps> = ({
  listId,
  searchQuery = '',
  showClosed = true,
  visibleColumns,
}) => {
  const {
    listName,
    parentCtx,
    tasks,
    canCreateTask,
    highlightTaskId,
    onOpenCreateTask,
    onTaskClick,
    onStatusesChange,
    canEditTask,
    canEditTaskStatusFor,
    assigneeOptions,
    projectMembers,
    onTaskFieldChange,
    onTaskStatusChange,
    savingStatusTaskId,
  } = useListPageContext(listId);

  return (
    <ListStatusGroupedView
      variant="clickup"
      memberStatusBadges
      listId={listId}
      listName={listName}
      tasks={tasks}
      searchQuery={searchQuery}
      showClosed={showClosed}
      visibleColumns={visibleColumns}
      parentCtx={parentCtx}
      canCreateTask={canCreateTask}
      highlightTaskId={highlightTaskId}
      onAddTask={(_ctx, statutKey) => onOpenCreateTask(statutKey)}
      onTaskClick={onTaskClick}
      onStatusesChange={onStatusesChange}
      canEditStatusFor={canEditTaskStatusFor}
      canEditStatus={canEditTask}
      canEditFields={canEditTask}
      assigneeOptions={assigneeOptions}
      projectMembers={projectMembers}
      onTaskFieldChange={onTaskFieldChange}
      onTaskStatusChange={onTaskStatusChange}
      savingStatusTaskId={savingStatusTaskId}
    />
  );
};

export default ListTaskView;
