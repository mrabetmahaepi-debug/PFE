import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Calendar,
  GripVertical,
  ListTodo,
  Plus,
} from 'lucide-react';
import {
  TASK_PRIORITY_LABELS,
  TaskStatus,
  normalizeTaskPriority,
  type Tache,
} from '../types/task';
/** Includes synthetic overdue bucket (derived from due date + status). */
export type BoardColumnId = TaskStatus | 'OVERDUE';

interface KanbanBoardProps {
  tasks: Tache[];
  listLookup: Record<number, string>;
  canCreateTask: boolean;
  /** When false, cards are not draggable (RBAC / read-only). */
  canReorderTasks?: boolean;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: number, targetColumn: BoardColumnId) => void | Promise<void>;
  highlightTaskId?: number | null;
  onTaskClick?: (task: Tache) => void;
}

interface ColumnDef {
  id: BoardColumnId;
  label: string;
  accent: string;
  tone: 'slate' | 'indigo' | 'emerald' | 'amber';
}

const COLUMN_DEFS: ColumnDef[] = [
  { id: TaskStatus.TODO, label: 'À faire', accent: '#94a3b8', tone: 'slate' },
  {
    id: TaskStatus.IN_PROGRESS,
    label: 'En cours',
    accent: '#6366f1',
    tone: 'indigo',
  },
  {
    id: TaskStatus.DONE,
    label: 'Terminées',
    accent: '#10b981',
    tone: 'emerald',
  },
  {
    id: 'OVERDUE',
    label: 'En retard',
    accent: '#f59e0b',
    tone: 'amber',
  },
];

const COLUMN_IDS = COLUMN_DEFS.map((c) => c.id);

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isTaskOverdue = (t: Tache): boolean => {
  if (t.statut_t === TaskStatus.DONE) return false;
  if (!t.date_limite_t) return false;
  const due = new Date(t.date_limite_t);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < startOfToday().getTime();
};

type ColumnsMap = Record<BoardColumnId, Tache[]>;

const emptyColumns = (): ColumnsMap => ({
  [TaskStatus.TODO]: [],
  [TaskStatus.IN_PROGRESS]: [],
  [TaskStatus.DONE]: [],
  OVERDUE: [],
});

const taskKey = (id: number | string) => `task:${id}`;
const columnKey = (id: BoardColumnId) => `col:${id}`;
const isColumnKey = (id: UniqueIdentifier) =>
  typeof id === 'string' && id.startsWith('col:');
const parseColumnKey = (id: UniqueIdentifier): BoardColumnId => {
  const raw = String(id).replace('col:', '');
  if (raw === 'OVERDUE') return 'OVERDUE';
  return raw as TaskStatus;
};
const parseTaskKey = (id: UniqueIdentifier) =>
  Number(String(id).replace('task:', ''));

export const groupTasksByBoardColumns = (tasks: Tache[]): ColumnsMap => {
  const map = emptyColumns();
  for (const t of tasks) {
    if (t.statut_t === TaskStatus.DONE) {
      map[TaskStatus.DONE].push(t);
    } else if (isTaskOverdue(t)) {
      map.OVERDUE.push(t);
    } else if (t.statut_t === TaskStatus.IN_PROGRESS) {
      map[TaskStatus.IN_PROGRESS].push(t);
    } else {
      map[TaskStatus.TODO].push(t);
    }
  }
  return map;
};

const formatDate = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return null;
  }
};

const initials = (label?: string) => {
  if (!label) return '?';
  const parts = label.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'À faire',
  [TaskStatus.IN_PROGRESS]: 'En cours',
  [TaskStatus.DONE]: 'Terminée',
};

interface TaskCardProps {
  task: Tache;
  listLabel?: string;
  highlight?: boolean;
  isOverlay?: boolean;
  overdue?: boolean;
  /** Visual grip only; dragging uses the full card surface when reorder is allowed. */
  showGrip?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  listLabel,
  highlight,
  isOverlay,
  overdue,
  showGrip = true,
}) => {
  const prio = normalizeTaskPriority(task.priorite_t);
  const due = formatDate(task.date_limite_t);
  const assignee =
    task.utilisateur &&
    `${task.utilisateur.prenom || ''} ${task.utilisateur.nom || ''}`.trim();
  return (
    <div
      className={`kanban-card ${highlight ? 'kanban-card-highlight' : ''} ${
        isOverlay ? 'kanban-card-overlay' : ''
      } ${overdue ? 'kanban-card-overdue' : ''}`}
    >
      <div className="kanban-card-top">
        {showGrip ? (
          <span
            className="kanban-card-grip"
            aria-hidden
            title="Glisser la carte pour déplacer"
          >
            <GripVertical size={14} />
          </span>
        ) : (
          <span className="kanban-card-grip-spacer" aria-hidden />
        )}
        <div className="kanban-card-title">{task.nom_t}</div>
        <span className={`kanban-status-badge st-${task.statut_t}`}>
          {STATUS_BADGE[task.statut_t] || task.statut_t}
        </span>
      </div>
      {task.description_t && (
        <div className="kanban-card-desc">{task.description_t}</div>
      )}
      <div className="kanban-card-meta">
        <span className={`chip prio-chip prio-${prio}`}>
          {TASK_PRIORITY_LABELS[prio]}
        </span>
        {listLabel && (
          <span className="chip list-chip">
            <ListTodo size={11} /> {listLabel}
          </span>
        )}
        {due && (
          <span
            className={`chip date-chip ${overdue ? 'date-chip-late' : ''}`}
          >
            <Calendar size={11} /> {due}
          </span>
        )}
        {assignee && (
          <span className="kanban-assignee-avatar" title={assignee}>
            {initials(assignee)}
          </span>
        )}
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
    if (start && (Math.abs(e.clientX - start.x) > 12 || Math.abs(e.clientY - start.y) > 12)) {
      return;
    }
    onCardClick();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card-wrapper ${isDragging ? 'is-source' : ''} ${
        !canReorder ? 'kanban-card-no-drag' : ''
      }`}
    >
      <div
        className="kanban-card-click"
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
        <TaskCard {...props} showGrip={canReorder} />
      </div>
    </div>
  );
};

interface ColumnProps {
  column: ColumnDef;
  tasks: Tache[];
  listLookup: Record<number, string>;
  highlightTaskId?: number | null;
  canCreateTask: boolean;
  onAdd: () => void;
  isActiveColumn: boolean;
  onTaskClick?: (task: Tache) => void;
  canReorderTasks: boolean;
}

const Column: React.FC<ColumnProps> = ({
  column,
  tasks,
  listLookup,
  highlightTaskId,
  canCreateTask,
  onAdd,
  isActiveColumn,
  onTaskClick,
  canReorderTasks,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: columnKey(column.id),
    data: { type: 'column', columnId: column.id },
  });

  const items = useMemo(() => tasks.map((t) => taskKey(t.id_tache)), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column tone-${column.tone} ${
        isOver || isActiveColumn ? 'is-over' : ''
      }`}
    >
      <header className="kanban-column-header">
        <div className="kanban-column-title">
          <span
            className="kanban-column-bullet"
            style={{ backgroundColor: column.accent }}
          />
          <span className="kanban-column-label">{column.label}</span>
          <span className="kanban-column-count">{tasks.length}</span>
        </div>
        {column.id !== 'OVERDUE' && canCreateTask && (
          <button
            type="button"
            className="kanban-add-btn"
            onClick={onAdd}
            title="Ajouter une tâche"
          >
            <Plus size={14} />
          </button>
        )}
      </header>

      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="kanban-column-body">
          {tasks.map((t) => (
            <SortableCard
              key={t.id_tache}
              id={taskKey(t.id_tache)}
              task={t}
              overdue={column.id === 'OVERDUE'}
              listLabel={
                t.id_list && listLookup[t.id_list]
                  ? listLookup[t.id_list]
                  : undefined
              }
              highlight={highlightTaskId === t.id_tache}
              canReorder={canReorderTasks}
              onCardClick={() => onTaskClick?.(t)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="kanban-column-empty">
              {canCreateTask && column.id !== 'OVERDUE'
                ? 'Glissez une tâche ici'
                : column.id === 'OVERDUE'
                  ? 'Aucune tâche en retard'
                  : 'Aucune tâche'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  listLookup,
  canCreateTask,
  canReorderTasks = true,
  onAddTask,
  onMoveTask,
  highlightTaskId,
  onTaskClick,
}) => {
  /** Mouse + pointer + touch so drag reliably activates (grip-on-button was flaky). */
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5, tolerance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [columns, setColumns] = useState<ColumnsMap>(() =>
    groupTasksByBoardColumns(tasks)
  );
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const draggingRef = useRef(false);
  const sourceColumnRef = useRef<BoardColumnId | null>(null);
  const lastOverColumnRef = useRef<BoardColumnId | null>(null);

  useEffect(() => {
    if (draggingRef.current) return;
    setColumns(groupTasksByBoardColumns(tasks));
  }, [tasks]);

  const findColumnByItemId = (
    id: UniqueIdentifier,
    snapshot: ColumnsMap
  ): BoardColumnId | null => {
    if (isColumnKey(id)) return parseColumnKey(id);
    for (const col of COLUMN_IDS) {
      if (snapshot[col].some((t) => taskKey(t.id_tache) === id)) return col;
    }
    return null;
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
      if (!fromCol || !toCol) return current;

      lastOverColumnRef.current = toCol;
      if (fromCol === toCol) return current;

      const fromItems = current[fromCol];
      const toItems = current[toCol];
      const activeIdx = fromItems.findIndex(
        (t) => taskKey(t.id_tache) === active.id
      );
      if (activeIdx === -1) return current;

      const overIsContainer = isColumnKey(over.id);
      let insertAt: number;
      if (overIsContainer) {
        insertAt = toItems.length;
      } else {
        const overIdx = toItems.findIndex(
          (t) => taskKey(t.id_tache) === over.id
        );
        insertAt = overIdx >= 0 ? overIdx : toItems.length;
      }

      const moving = { ...fromItems[activeIdx] };
      if (toCol === TaskStatus.DONE) moving.statut_t = TaskStatus.DONE;
      else if (toCol === 'OVERDUE') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        moving.date_limite_t = y.toISOString();
      } else if (toCol === TaskStatus.TODO) {
        moving.statut_t = TaskStatus.TODO;
        const nx = new Date();
        nx.setDate(nx.getDate() + 7);
        moving.date_limite_t = nx.toISOString();
      } else if (toCol === TaskStatus.IN_PROGRESS) {
        moving.statut_t = TaskStatus.IN_PROGRESS;
        const nx = new Date();
        nx.setDate(nx.getDate() + 7);
        moving.date_limite_t = nx.toISOString();
      }

      const newFrom = [...fromItems];
      newFrom.splice(activeIdx, 1);
      const newTo = [...toItems];
      newTo.splice(insertAt, 0, moving);
      return { ...current, [fromCol]: newFrom, [toCol]: newTo };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    draggingRef.current = false;
    setActiveId(null);

    if (!over) {
      setColumns(groupTasksByBoardColumns(tasks));
      sourceColumnRef.current = null;
      lastOverColumnRef.current = null;
      return;
    }

    const sourceCol = sourceColumnRef.current;
    sourceColumnRef.current = null;

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
        const oldIdx = items.findIndex(
          (t) => taskKey(t.id_tache) === active.id
        );
        const newIdx = items.findIndex(
          (t) => taskKey(t.id_tache) === over.id
        );
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return current;
        return { ...current, [fromCol]: arrayMove(items, oldIdx, newIdx) };
      }
      return current;
    });

    if (!canReorderTasks) return;
    if (!finalCol || !sourceCol) return;
    if (finalCol === sourceCol) return;

    const taskId = parseTaskKey(active.id);
    onMoveTask(taskId, finalCol);
  };

  const handleDragCancel = () => {
    draggingRef.current = false;
    setActiveId(null);
    sourceColumnRef.current = null;
    lastOverColumnRef.current = null;
    setColumns(groupTasksByBoardColumns(tasks));
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

  const activeColumn = activeId
    ? findColumnByItemId(activeId, columns)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`kanban-board ${activeId ? 'is-dragging' : ''}`}>
        {COLUMN_DEFS.map((col) => (
          <Column
            key={col.id}
            column={col}
            tasks={columns[col.id] || []}
            listLookup={listLookup}
            highlightTaskId={highlightTaskId}
            canCreateTask={canCreateTask}
            onAdd={() => {
              if (col.id === 'OVERDUE') return;
              onAddTask(col.id as TaskStatus);
            }}
            isActiveColumn={activeColumn === col.id}
            onTaskClick={onTaskClick}
            canReorderTasks={canReorderTasks}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 220,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {activeTask ? (
          <TaskCard
            task={activeTask}
            overdue={isTaskOverdue(activeTask)}
            listLabel={
              activeTask.id_list && listLookup[activeTask.id_list]
                ? listLookup[activeTask.id_list]
                : undefined
            }
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
