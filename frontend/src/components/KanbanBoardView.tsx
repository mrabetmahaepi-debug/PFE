import React, { useMemo } from 'react';
import ClickUpKanbanBoard from './ClickUpKanbanBoard';
import { useListPageContext } from './listPageContext';

export interface KanbanBoardViewProps {
  listId: number;
}

const KanbanBoardView: React.FC<KanbanBoardViewProps> = ({ listId }) => {
  const {
    listName,
    projectName,
    tasks,
    canCreateTask,
    canEditTask,
    onOpenCreateTask,
    onBoardMove,
    highlightTaskId,
    onTaskClick,
  } = useListPageContext(listId);

  const listTasks = useMemo(
    () => tasks.filter((t) => t.id_list == null || Number(t.id_list) === listId),
    [tasks, listId]
  );

  return (
    <>
      <div className="cu-board-group-row">
        <span className="cu-board-group-chip">
          <span className="cu-board-group-chip-muted">Groupe :</span>
          Statut
        </span>
      </div>
      <ClickUpKanbanBoard
        tasks={listTasks}
        listName={listName}
        projectName={projectName}
        canCreateTask={canCreateTask}
        canReorderTasks={canEditTask}
        onAddTask={(statutKey) => onOpenCreateTask(statutKey)}
        onMoveTask={onBoardMove}
        highlightTaskId={highlightTaskId}
        onTaskClick={onTaskClick}
      />
    </>
  );
};

export default KanbanBoardView;
