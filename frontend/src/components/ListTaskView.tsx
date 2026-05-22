import React from 'react';
import ListStatusGroupedView from './ListStatusGroupedView';
import { useListPageContext } from './listPageContext';

export interface ListTaskViewProps {
  listId: number;
}

const ListTaskView: React.FC<ListTaskViewProps> = ({ listId }) => {
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
    assigneeOptions,
    projectMembers,
    onTaskFieldChange,
    onTaskStatusChange,
    savingStatusTaskId,
  } = useListPageContext(listId);

  return (
    <ListStatusGroupedView
      variant="clickup"
      listId={listId}
      listName={listName}
      tasks={tasks}
      parentCtx={parentCtx}
      canCreateTask={canCreateTask}
      highlightTaskId={highlightTaskId}
      onAddTask={(ctx, statutKey) => onOpenCreateTask(statutKey)}
      onTaskClick={onTaskClick}
      onStatusesChange={onStatusesChange}
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
