import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Flag, Plus, User } from 'lucide-react';
import {
  TASK_PRIORITY_LABELS,
  normalizeTaskPriority,
  type Tache,
} from '../types/task';
import {
  KANBAN_WORKFLOW_COLUMNS,
  KANBAN_WORKFLOW_COLUMN_IDS,
  groupTasksByKanbanWorkflow,
  emptyKanbanColumns,
  type KanbanWorkflowColumnId,
  type KanbanColumnsMap,
  type KanbanBadgeTone,
} from '../lib/kanbanWorkflowColumns';
import { appPaths } from '../lib/workspaceRoutes';
import './ClickUpKanbanBoard.css';

export type ClickUpColumnId = KanbanWorkflowColumnId;

const COLUMN_DEFS = KANBAN_WORKFLOW_COLUMNS;
const COLUMN_IDS = KANBAN_WORKFLOW_COLUMN_IDS;

type ColumnsMap = KanbanColumnsMap;

export function groupTasksByClickUpColumns(tasks: Tache[]): ColumnsMap {
  return groupTasksByKanbanWorkflow(tasks);
}

const taskKey = (id: number) => `task:${id}`;
const columnKey = (id: ClickUpColumnId) => `col:${id}`;
const isColumnKey = (id: UniqueIdentifier) =>
  typeof id === 'string' && id.startsWith('col:');
const parseColumnKey = (id: UniqueIdentifier): ClickUpColumnId =>
  String(id).replace('col:', '') as ClickUpColumnId;
const parseTaskKey = (id: UniqueIdentifier) =>
  Number(String(id).replace('task:', ''));

function formatDate(raw?: string | null) {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return null;
  }
}

function assigneeLabel(task: Tache): string | null {
  if (!task.utilisateur) return null;
  const name =
    `${task.utilisateur.prenom || ''} ${task.utilisateur.nom || ''}`.trim();
  return name || task.utilisateur.email || null;
}

function assigneeInitials(task: Tache): string {
  const label = assigneeLabel(task);
  if (!label) return '?';
  const parts = label.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface TaskCardProps {
  task: Tache;
  contextLabel: string;
  highlight?: boolean;
  isOverlay?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  contextLabel,
  highlight,
  isOverlay,
}) => {
  const prio = normalizeTaskPriority(task.priorite_t);
  const due = formatDate(task.date_limite_t);
  const assignee = assigneeLabel(task);

  return (
    <div
      className={`cu-kanban-card ${highlight ? 'cu-kanban-card--highlight' : ''} ${
        isOverlay ? 'cu-kanban-card--overlay' : ''
      }`}
    >
      <h3 className="cu-kanban-card-title">{task.nom_t}</h3>
      <p className="cu-kanban-card-subtitle">Dans {contextLabel}</p>
      <div className="cu-kanban-card-lines">
        <div className="cu-kanban-card-line">
          {assignee ? (
            <>
              <span className="cu-kanban-card-avatar">{assigneeInitials(task)}</span>
              <span className="cu-kanban-card-line-text">{assignee}</span>
            </>
          ) : (
            <>
              <User size={14} aria-hidden />
              <span className="cu-kanban-card-line-text">Non assigné</span>
            </>
          )}
        </div>
        <div className="cu-kanban-card-line">
          <Calendar size={14} aria-hidden />
          <span className="cu-kanban-card-line-text">{due ?? 'Aucune date'}</span>
        </div>
        <div className={`cu-kanban-card-line cu-kanban-card-priority--${prio}`}>
          <Flag size={14} aria-hidden />
          <span className="cu-kanban-card-line-text">
            {TASK_PRIORITY_LABELS[prio]}
          </span>
        </div>
      </div>
    </div>
  );
};

interface SortableCardProps extends TaskCardProps {
  id: string;
  onCardClick?: () => void;
  canReorder?: boolean;
}

const SortableCard: React.FC<SortableCardProps> = ({
  id,
  onCardClick,
  canReorder = true,
  ...props
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canReorder });

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const rawPointerDown = listeners?.onPointerDown;
  const mergedListeners =
    canReorder && listeners
      ? {
          ...listeners,
          onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            pointerStart.current = { x: e.clientX, y: e.clientY };
            rawPointerDown?.(e);
          },
        }
      : undefined;

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!onCardClick) return;
    const start = pointerStart.current;
    pointerStart.current = null;
    if (
      start &&
      (Math.abs(e.clientX - start.x) > 12 || Math.abs(e.clientY - start.y) > 12)
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onCardClick();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cu-kanban-card-wrap ${isDragging ? 'is-dragging' : ''}`}
    >
      <div
        className="cu-kanban-card-click"
        role="button"
        tabIndex={0}
        {...attributes}
        {...(mergedListeners ?? {})}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCardClick?.();
          }
        }}
      >
        <TaskCard {...props} />
      </div>
    </div>
  );
};

interface ColumnProps {
  columnId: ClickUpColumnId;
  label: string;
  badgeTone: KanbanBadgeTone;
  tasks: Tache[];
  contextLabel: string;
  canCreateTask: boolean;
  canReorder: boolean;
  highlightTaskId?: number | null;
  onAdd: () => void;
  onTaskClick: (task: Tache) => void;
  isActiveColumn: boolean;
}

const Column: React.FC<ColumnProps> = ({
  columnId,
  label,
  badgeTone,
  tasks,
  contextLabel,
  canCreateTask,
  canReorder,
  highlightTaskId,
  onAdd,
  onTaskClick,
  isActiveColumn,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: columnKey(columnId),
    data: { type: 'column', columnId },
  });
  const items = useMemo(() => tasks.map((t) => taskKey(t.id_tache)), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={`cu-kanban-column ${isOver || isActiveColumn ? 'is-over' : ''}`}
    >
      <header className="cu-kanban-column-header">
        <span className={`cu-kanban-status-badge cu-kanban-status-badge--${badgeTone}`}>
          {label}
        </span>
        <span className="cu-kanban-column-count">{tasks.length}</span>
      </header>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="cu-kanban-column-body">
          {tasks.map((t) => (
            <SortableCard
              key={t.id_tache}
              id={taskKey(t.id_tache)}
              task={t}
              contextLabel={contextLabel}
              highlight={highlightTaskId === t.id_tache}
              canReorder={canReorder}
              onCardClick={() => onTaskClick(t)}
            />
          ))}
        </div>
      </SortableContext>
      {canCreateTask && (
        <button type="button" className="cu-kanban-column-add" onClick={onAdd}>
          <Plus size={14} aria-hidden />
          Ajouter Tâche
        </button>
      )}
    </div>
  );
};

export interface ClickUpKanbanBoardProps {
  tasks: Tache[];
  listName: string;
  projectName?: string;
  canCreateTask: boolean;
  canReorderTasks?: boolean;
  onAddTask: (statutKey: ClickUpColumnId) => void;
  onMoveTask: (taskId: number, statutKey: ClickUpColumnId) => void | Promise<void>;
  highlightTaskId?: number | null;
  onTaskClick?: (task: Tache) => void;
}

const ClickUpKanbanBoard: React.FC<ClickUpKanbanBoardProps> = ({
  tasks,
  listName,
  projectName,
  canCreateTask,
  canReorderTasks = true,
  onAddTask,
  onMoveTask,
  highlightTaskId,
  onTaskClick,
}) => {
  const navigate = useNavigate();
  const contextLabel = projectName
    ? `${projectName} / ${listName}`
    : listName;

  const handleTaskClick = (task: Tache) => {
    if (onTaskClick) {
      onTaskClick(task);
      return;
    }
    navigate(appPaths.task(task.id_tache));
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8, tolerance: 10 },
    }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [columns, setColumns] = useState<ColumnsMap>(() =>
    groupTasksByKanbanWorkflow(tasks)
  );
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const draggingRef = useRef(false);
  /** Prevents props sync from wiping optimistic column layout during PATCH */
  const syncLockedRef = useRef(false);
  const sourceColumnRef = useRef<ClickUpColumnId | null>(null);
  const lastOverColumnRef = useRef<ClickUpColumnId | null>(null);

  useEffect(() => {
    if (draggingRef.current || syncLockedRef.current) return;
    setColumns(groupTasksByKanbanWorkflow(tasks));
  }, [tasks]);

  const findColumnByItemId = (
    id: UniqueIdentifier,
    snapshot: ColumnsMap
  ): ClickUpColumnId | null => {
    if (isColumnKey(id)) return parseColumnKey(id);
    for (const col of COLUMN_IDS) {
      if (snapshot[col].some((t) => taskKey(t.id_tache) === id)) return col;
    }
    return null;
  };

  const applyCrossColumnMove = (
    current: ColumnsMap,
    activeItemId: UniqueIdentifier,
    overItemId: UniqueIdentifier,
    destCol: ClickUpColumnId
  ): ColumnsMap => {
    const fromCol = findColumnByItemId(activeItemId, current);
    if (!fromCol || fromCol === destCol) return current;

    const fromItems = [...current[fromCol]];
    const activeIdx = fromItems.findIndex(
      (t) => taskKey(t.id_tache) === activeItemId
    );
    if (activeIdx === -1) return current;

    const overIsContainer = isColumnKey(overItemId);
    const toItems = [...current[destCol]];
    let insertAt = overIsContainer
      ? toItems.length
      : toItems.findIndex((t) => taskKey(t.id_tache) === overItemId);
    if (insertAt < 0) insertAt = toItems.length;

    const moving = { ...fromItems[activeIdx], statut_t: destCol };
    fromItems.splice(activeIdx, 1);
    toItems.splice(insertAt, 0, moving);
    return { ...current, [fromCol]: fromItems, [destCol]: toItems };
  };

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const intersections = rectIntersection(args);
    if (intersections.length > 0) return intersections;
    return closestCorners(args);
  };

  const handleDragStart = (e: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(e.active.id);
    sourceColumnRef.current = findColumnByItemId(e.active.id, columns);
    lastOverColumnRef.current = sourceColumnRef.current;
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

    setColumns((current) => {
      const fromCol = findColumnByItemId(active.id, current);
      const toCol = findColumnByItemId(over.id, current);
      if (!fromCol || !toCol || fromCol === toCol) return current;

      lastOverColumnRef.current = toCol;
      const fromItems = current[fromCol];
      const toItems = current[toCol];
      const activeIdx = fromItems.findIndex(
        (t) => taskKey(t.id_tache) === active.id
      );
      if (activeIdx === -1) return current;

      const overIsContainer = isColumnKey(over.id);
      let insertAt = overIsContainer
        ? toItems.length
        : toItems.findIndex((t) => taskKey(t.id_tache) === over.id);
      if (insertAt < 0) insertAt = toItems.length;

      const moving = { ...fromItems[activeIdx], statut_t: toCol };
      const newFrom = [...fromItems];
      newFrom.splice(activeIdx, 1);
      const newTo = [...toItems];
      newTo.splice(insertAt, 0, moving);
      return { ...current, [fromCol]: newFrom, [toCol]: newTo };
    });
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    draggingRef.current = false;
    setActiveId(null);

    const sourceCol = sourceColumnRef.current;
    sourceColumnRef.current = null;

    if (!over) {
      lastOverColumnRef.current = null;
      setColumns(groupTasksByKanbanWorkflow(tasks));
      return;
    }

    const snap = columnsRef.current;
    const targetFromOver =
      over?.id != null ? findColumnByItemId(over.id, snap) : null;
    const finalCol = targetFromOver ?? lastOverColumnRef.current;
    lastOverColumnRef.current = null;

    setColumns((current) => {
      const fromCol = findColumnByItemId(active.id, current);
      const toCol = findColumnByItemId(over.id, current);
      if (!fromCol || !toCol) return current;
      if (fromCol === toCol) {
        const items = current[fromCol];
        const oldIdx = items.findIndex((t) => taskKey(t.id_tache) === active.id);
        const newIdx = items.findIndex((t) => taskKey(t.id_tache) === over.id);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return current;
        return { ...current, [fromCol]: arrayMove(items, oldIdx, newIdx) };
      }
      return current;
    });

    if (!canReorderTasks || !finalCol || !sourceCol) return;

    if (finalCol === sourceCol) return;

    const taskId = parseTaskKey(active.id);
    const stillInSource = snap[sourceCol]?.some(
      (t) => taskKey(t.id_tache) === active.id
    );
    const nextColumns = stillInSource
      ? applyCrossColumnMove(snap, active.id, over.id, finalCol)
      : snap;

    syncLockedRef.current = true;
    setColumns(nextColumns);

    try {
      await onMoveTask(taskId, finalCol);
    } catch {
      setColumns(groupTasksByKanbanWorkflow(tasks));
    } finally {
      syncLockedRef.current = false;
    }
  };

  const handleDragCancel = () => {
    draggingRef.current = false;
    setActiveId(null);
    sourceColumnRef.current = null;
    lastOverColumnRef.current = null;
    setColumns(groupTasksByKanbanWorkflow(tasks));
  };

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    const id = parseTaskKey(activeId);
    for (const col of COLUMN_IDS) {
      const found = columns[col].find((t) => t.id_tache === id);
      if (found) return found;
    }
    return tasks.find((t) => t.id_tache === id) || null;
  }, [activeId, columns, tasks]);

  const activeColumn = activeId ? findColumnByItemId(activeId, columns) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="cu-kanban-board-scroll">
        <div className={`cu-kanban-board ${activeId ? 'is-dragging' : ''}`}>
          {COLUMN_DEFS.map((col) => (
            <Column
              key={col.id}
              columnId={col.id}
              label={col.label}
              badgeTone={col.badgeTone}
              tasks={columns[col.id]}
              contextLabel={contextLabel}
              canCreateTask={canCreateTask}
              canReorder={canReorderTasks}
              highlightTaskId={highlightTaskId}
              onAdd={() => onAddTask(col.id)}
              onTaskClick={handleTaskClick}
              isActiveColumn={activeColumn === col.id}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} contextLabel={contextLabel} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ClickUpKanbanBoard;
