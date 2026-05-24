import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ListTodo,
  Menu,
  Plus,
  CheckSquare,
  Briefcase,
  MoreHorizontal,
  Globe,
} from 'lucide-react';
import type {
  HierarchyLevel,
  SpaceTreeNode,
  TreeListNode,
  TreeProjectNode,
  TreeSprintNode,
  TreeTaskNode,
} from '../types/hierarchy';
import type { HierarchyParentContext } from './CreateHierarchyItemModal';
import TreeTaskContextMenu, {
  type TreeTaskMenuAction,
} from './TreeTaskContextMenu';
import DeleteConfirmModal from './DeleteConfirmModal';
import './WorkspaceTree.css';

export interface SidebarTaskMenuContext {
  task: TreeTaskNode;
  list: TreeListNode;
  parent: HierarchyParentContext;
  spaceId: number;
}

export interface SpaceSelection {
  level: HierarchyLevel | 'space';
  id_space?: number;
  id_projet?: number;
  id_sprint?: number | null;
  id_list?: number | null;
  id_tache?: number | null;
  label: string;
}

interface SpaceHierarchyTreeProps {
  spaces: SpaceTreeNode[];
  selection: SpaceSelection | null;
  canEdit: boolean;
  canCreateSpace: boolean;
  canCreateProject: boolean;
  canCreateSprint: boolean;
  canCreateList: boolean;
  canCreateTask: boolean;
  onSelect: (sel: SpaceSelection) => void;
  onAdd: (level: HierarchyLevel | 'space', parent: HierarchyParentContext) => void;
  onDelete?: (level: HierarchyLevel | 'space', id: number) => void;
  expanded?: Set<string>;
  onToggleExpand?: (key: string) => void;
  canDeleteTask?: boolean;
  onTaskMenuAction?: (
    action: TreeTaskMenuAction,
    ctx: SidebarTaskMenuContext
  ) => void;
}

interface TreeTaskRowProps {
  task: TreeTaskNode;
  list: TreeListNode;
  parent: HierarchyParentContext;
  spaceId: number;
  selected: boolean;
  menuOpen: boolean;
  canDeleteTask: boolean;
  onSelect: (sel: SpaceSelection) => void;
  onToggleMenu: (taskId: number | null) => void;
  onTaskMenuAction?: (
    action: TreeTaskMenuAction,
    ctx: SidebarTaskMenuContext
  ) => void;
}

const TreeTaskRow: React.FC<TreeTaskRowProps> = ({
  task,
  list,
  parent,
  spaceId,
  selected,
  menuOpen,
  canDeleteTask,
  onSelect,
  onToggleMenu,
  onTaskMenuAction,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const sel: SpaceSelection = {
    level: 'task',
    id_space: spaceId,
    id_projet: parent.id_projet,
    id_sprint: parent.id_sprint,
    id_list: list.id_list,
    id_tache: task.id_tache,
    label: task.nom_t,
  };
  const ctx: SidebarTaskMenuContext = {
    task,
    list,
    parent,
    spaceId,
  };

  const handleMenuAction = (action: TreeTaskMenuAction) => {
    onToggleMenu(null);
    onTaskMenuAction?.(action, ctx);
  };

  return (
    <>
      <div
        ref={rowRef}
        className={`tree-row tree-row-task tree-depth-task ${
          selected ? 'selected' : ''
        } ${menuOpen ? 'menu-open' : ''}`}
        onClick={() => onSelect(sel)}
      >
        <span className="tree-spacer" />
        <span className="tree-task-dot" aria-hidden />
        <span className="tree-row-label">{task.nom_t}</span>
        <div
          className="tree-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`tree-icon-btn tree-task-menu-btn ${
              menuOpen ? 'is-open' : ''
            }`}
            title="Options de la tâche"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(menuOpen ? null : task.id_tache);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
      <TreeTaskContextMenu
        open={menuOpen}
        anchorRef={rowRef}
        onClose={() => onToggleMenu(null)}
        onAction={handleMenuAction}
        canDelete={canDeleteTask}
      />
    </>
  );
};

const ADD_OPTIONS_SPACE: { level: HierarchyLevel | 'space'; label: string }[] = [
  { level: 'project', label: 'Projet' },
];

const ADD_OPTIONS_PROJECT: { level: HierarchyLevel; label: string }[] = [
  { level: 'sprint', label: 'Sprint' },
  { level: 'task', label: 'Tâche' },
];

const ADD_OPTIONS_SPRINT: { level: HierarchyLevel; label: string }[] = [
  { level: 'list', label: 'Liste' },
];

const ADD_OPTIONS_LIST: { level: HierarchyLevel; label: string }[] = [
  { level: 'task', label: 'Tâche' },
];

interface AddMenuProps {
  options: { level: HierarchyLevel | 'space'; label: string }[];
  parent: HierarchyParentContext;
  canCreateSpace: boolean;
  canCreateProject: boolean;
  canCreateSprint: boolean;
  canCreateList: boolean;
  canCreateTask: boolean;
  onAdd: (level: HierarchyLevel | 'space', parent: HierarchyParentContext) => void;
}

const AddMenu: React.FC<AddMenuProps> = ({
  options,
  parent,
  canCreateSpace,
  canCreateProject,
  canCreateSprint,
  canCreateList,
  canCreateTask,
  onAdd,
}) => {
  const [open, setOpen] = useState(false);
  const visible = options.filter((o) => {
    if (o.level === 'space') return canCreateSpace;
    if (o.level === 'project') return canCreateProject;
    if (o.level === 'sprint') return canCreateSprint;
    if (o.level === 'list') return canCreateList;
    if (o.level === 'task') return canCreateTask;
    return false;
  });
  if (visible.length === 0) return null;

  return (
    <div className="tree-add-menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="tree-icon-btn"
        title="Ajouter"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={14} />
      </button>
      {open && (
        <div className="tree-menu-popover">
          {visible.map((o) => (
            <button
              key={o.level}
              type="button"
              className="tree-menu-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                onAdd(o.level, parent);
              }}
            >
              <Plus size={12} /> {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SpaceHierarchyTree: React.FC<SpaceHierarchyTreeProps> = ({
  spaces,
  selection,
  canEdit,
  canCreateSpace,
  canCreateProject,
  canCreateSprint,
  canCreateList,
  canCreateTask,
  onSelect,
  onAdd,
  onDelete,
  expanded: controlledExpanded,
  onToggleExpand,
  canDeleteTask = false,
  onTaskMenuAction,
}) => {
  const [openMenuTaskId, setOpenMenuTaskId] = useState<number | null>(null);
  const [pendingDeleteList, setPendingDeleteList] = useState<{
    id: number;
    nom: string;
  } | null>(null);
  const isControlled = !!controlledExpanded && !!onToggleExpand;
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (spaces[0]) initial.add(`space:${spaces[0].id_space}`);
    return initial;
  });

  const expanded = isControlled
    ? (controlledExpanded as Set<string>)
    : internalExpanded;

  const toggle = (key: string) => {
    if (isControlled && onToggleExpand) {
      onToggleExpand(key);
      return;
    }
    setInternalExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isExpanded = (key: string) => expanded.has(key);

  const isSelected = (sel: SpaceSelection) => {
    if (!selection) return false;
    return (
      selection.level === sel.level &&
      (selection.id_space ?? null) === (sel.id_space ?? null) &&
      (selection.id_projet ?? null) === (sel.id_projet ?? null) &&
      (selection.id_sprint ?? null) === (sel.id_sprint ?? null) &&
      (selection.id_list ?? null) === (sel.id_list ?? null) &&
      (selection.id_tache ?? null) === (sel.id_tache ?? null)
    );
  };

  const renderTask = (
    task: TreeTaskNode,
    list: TreeListNode,
    parent: HierarchyParentContext,
    spaceId: number
  ) => {
    const sel: SpaceSelection = {
      level: 'task',
      id_space: spaceId,
      id_projet: parent.id_projet,
      id_sprint: parent.id_sprint,
      id_list: list.id_list,
      id_tache: task.id_tache,
      label: task.nom_t,
    };
    return (
      <TreeTaskRow
        key={`task:${task.id_tache}`}
        task={task}
        list={list}
        parent={parent}
        spaceId={spaceId}
        selected={isSelected(sel)}
        menuOpen={openMenuTaskId === task.id_tache}
        canDeleteTask={canDeleteTask}
        onSelect={onSelect}
        onToggleMenu={setOpenMenuTaskId}
        onTaskMenuAction={onTaskMenuAction}
      />
    );
  };

  const renderList = (
    list: TreeListNode,
    parent: HierarchyParentContext,
    spaceId: number
  ) => {
    const listKey = `list:${list.id_list}`;
    const listOpen = isExpanded(listKey);
    const listTasks = list.tasks ?? [];
    const sel: SpaceSelection = {
      level: 'list',
      id_space: spaceId,
      id_projet: parent.id_projet,
      id_sprint: parent.id_sprint,
      id_list: list.id_list,
      label: list.nom,
    };
    const ctx: HierarchyParentContext = { ...parent, id_list: list.id_list };
    const listSelected =
      isSelected(sel) && (selection?.level === 'list' || !selection?.id_tache);
    return (
      <div key={listKey} className="tree-branch tree-branch-list">
        <div
          className={`tree-row tree-row-list tree-depth-list ${
            listSelected ? 'selected' : ''
          }`}
        >
          <button
            type="button"
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggle(listKey);
            }}
            aria-expanded={listOpen}
            aria-label={listOpen ? 'Replier la liste' : 'Déplier la liste'}
          >
            {listOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div
            className="tree-row-main"
            onClick={() => onSelect(sel)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(sel);
              }
            }}
          >
            <Menu size={14} className="tree-row-icon tree-row-icon-list" aria-hidden />
            <span className="tree-row-label">{list.nom}</span>
          </div>
          {typeof list.task_count === 'number' && list.task_count > 0 && (
            <span className="tree-count">{list.task_count}</span>
          )}
          <div className="tree-row-actions" onClick={(e) => e.stopPropagation()}>
            <AddMenu
              options={ADD_OPTIONS_LIST}
              parent={ctx}
              canCreateSpace={false}
              canCreateProject={false}
              canCreateSprint={false}
              canCreateList={canCreateList}
              canCreateTask={canCreateTask}
              onAdd={onAdd}
            />
            {canEdit && onDelete && (
              <button
                type="button"
                className="tree-icon-btn"
                title="Plus d'options"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDeleteList({ id: list.id_list, nom: list.nom });
                }}
              >
                <MoreHorizontal size={14} />
              </button>
            )}
          </div>
        </div>
        {listOpen && (
          <div className="tree-list-tasks">
            {listTasks.map((t) => renderTask(t, list, parent, spaceId))}
            {listTasks.length === 0 && (
              <div className="tree-empty tree-depth-task">Aucune tâche</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSprint = (
    sprint: TreeSprintNode,
    parent: HierarchyParentContext,
    spaceId: number
  ) => {
    const key = `sprint:${sprint.id_sprint}`;
    const open = isExpanded(key);
    const ctx: HierarchyParentContext = {
      ...parent,
      id_sprint: sprint.id_sprint,
    };
    const lists = sprint.lists || [];
    return (
      <div key={key} className="tree-branch">
        <div
          className="tree-row tree-row-folder tree-depth-sprint"
          onClick={(e) => {
            e.stopPropagation();
            toggle(key);
          }}
        >
          <button
            type="button"
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggle(key);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {open ? (
            <FolderOpen size={14} className="tree-row-icon" />
          ) : (
            <Folder size={14} className="tree-row-icon" />
          )}
          <span className="tree-row-label">{sprint.nom_s}</span>
          <div className="tree-row-actions" onClick={(e) => e.stopPropagation()}>
            <AddMenu
              options={ADD_OPTIONS_SPRINT}
              parent={ctx}
              canCreateSpace={false}
              canCreateProject={false}
              canCreateSprint={canCreateSprint}
              canCreateList={canCreateList}
              canCreateTask={false}
              onAdd={onAdd}
            />
          </div>
        </div>
        {open && (
          <div className="tree-children">
            {lists.map((l) => renderList(l, ctx, spaceId))}
            {lists.length === 0 && (
              <div className="tree-empty">
                <CheckSquare size={14} /> Ajoutez une liste.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderProject = (project: TreeProjectNode, spaceId: number) => {
    const key = `project:${project.id_projet}`;
    const open = isExpanded(key);
    const sel: SpaceSelection = {
      level: 'project',
      id_space: spaceId,
      id_projet: project.id_projet,
      label: project.nom_p,
    };
    const ctx: HierarchyParentContext = { id_projet: project.id_projet };
    const sprints = project.sprints || [];
    return (
      <div key={key} className="tree-branch">
        <div
          className={`tree-row ${isSelected(sel) ? 'selected' : ''}`}
          onClick={() => onSelect(sel)}
        >
          <button
            type="button"
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggle(key);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <Briefcase size={14} className="tree-row-icon" />
          <span className="tree-row-label">{project.nom_p}</span>
          {typeof project.task_count === 'number' && (
            <span className="tree-count">{project.task_count}</span>
          )}
          <div className="tree-row-actions">
            <AddMenu
              options={ADD_OPTIONS_PROJECT}
              parent={ctx}
              canCreateSpace={false}
              canCreateProject={canCreateProject}
              canCreateSprint={canCreateSprint}
              canCreateList={canCreateList}
              canCreateTask={canCreateTask}
              onAdd={onAdd}
            />
          </div>
        </div>
        {open && (
          <div className="tree-children">
            {sprints.map((s) => renderSprint(s, ctx, spaceId))}
            {sprints.length === 0 && (
              <div className="tree-empty">
                <CheckSquare size={14} /> Ajoutez un sprint.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSpace = (space: SpaceTreeNode) => {
    const key = `space:${space.id_space}`;
    const open = isExpanded(key);
    const sel: SpaceSelection = {
      level: 'space',
      id_space: space.id_space,
      label: space.nom,
    };
    const ctx: HierarchyParentContext = {
      id_projet: 0,
      id_space: space.id_space,
    };
    return (
      <div key={key} className="tree-branch root">
        <div
          className={`tree-row root-row ${isSelected(sel) ? 'selected' : ''}`}
          onClick={() => onSelect(sel)}
        >
          <button
            type="button"
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggle(key);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <Globe size={14} className="tree-row-icon" />
          <span className="tree-row-label">{space.nom}</span>
          <div className="tree-row-actions">
            <AddMenu
              options={ADD_OPTIONS_SPACE}
              parent={ctx}
              canCreateSpace={canCreateSpace}
              canCreateProject={canCreateProject}
              canCreateSprint={false}
              canCreateList={false}
              canCreateTask={false}
              onAdd={onAdd}
            />
          </div>
        </div>
        {open && (
          <div className="tree-children">
            {(space.projects || []).map((p) => renderProject(p, space.id_space))}
            {(space.projects || []).length === 0 && (
              <div className="tree-empty">
                <CheckSquare size={14} /> Ajoutez un projet.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const deleteListModal = (
    <DeleteConfirmModal
      open={!!pendingDeleteList}
      itemName={pendingDeleteList?.nom ?? ''}
      entityKind="list"
      onCancel={() => setPendingDeleteList(null)}
      onConfirm={() => {
        if (pendingDeleteList && onDelete) {
          onDelete('list', pendingDeleteList.id);
          setPendingDeleteList(null);
        }
      }}
    />
  );

  if (!spaces.length) {
    return (
      <>
        <div className="workspace-tree">
          <div className="tree-empty">Aucun espace. Créez un espace pour commencer.</div>
        </div>
        {deleteListModal}
      </>
    );
  }

  return (
    <>
      <div className="workspace-tree">
        {spaces.map(renderSpace)}
      </div>
      {deleteListModal}
    </>
  );
};

export default SpaceHierarchyTree;
