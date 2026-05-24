import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ListTodo,
  Plus,
  CheckSquare,
  Briefcase,
  MoreHorizontal,
} from 'lucide-react';
import type {
  ProjectTree,
  TreeFolderNode,
  TreeListNode,
  HierarchyLevel,
} from '../types/hierarchy';
import type { HierarchyParentContext } from './CreateHierarchyItemModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import './WorkspaceTree.css';

export interface WorkspaceSelection {
  level: HierarchyLevel | 'project';
  id_projet: number;
  id_group?: number | null;
  id_folder?: number | null;
  id_sprint?: number | null;
  id_list?: number | null;
  label: string;
}

interface WorkspaceTreeProps {
  tree: ProjectTree;
  selection: WorkspaceSelection | null;
  canEdit: boolean;
  canCreateFolder: boolean;
  canCreateList: boolean;
  canCreateTask: boolean;
  onSelect: (sel: WorkspaceSelection) => void;
  onAdd: (level: HierarchyLevel, parent: HierarchyParentContext) => void;
  onDelete?: (level: HierarchyLevel, id: number) => void;
  /**
   * Optional controlled expansion. If provided, the tree uses these keys
   * instead of its internal state, and notifies the parent via
   * `onToggleExpand`. Keys follow the format
   *  `project:<id>` | `folder:<id>`.
   */
  expanded?: Set<string>;
  onToggleExpand?: (key: string) => void;
}

// Simplified ClickUp-style hierarchy:
//   Workspace / Enterprise -> Project -> Folder -> List -> Task
// Projects can still hold direct Tasks, and Folders can hold direct Tasks.
// The backend can still store legacy Group/Sprint nodes, but the creation
// menu now guides users toward the cleaner product model.
const ADD_OPTIONS_PROJECT: { level: HierarchyLevel; label: string }[] = [
  { level: 'folder', label: 'Dossier' },
  { level: 'task', label: 'Tâche' },
];

const ADD_OPTIONS_FOLDER: { level: HierarchyLevel; label: string }[] = [
  { level: 'list', label: 'Liste' },
  { level: 'task', label: 'Tâche' },
];

const ADD_OPTIONS_LIST: { level: HierarchyLevel; label: string }[] = [
  { level: 'task', label: 'Tâche' },
];

interface AddMenuProps {
  options: { level: HierarchyLevel; label: string }[];
  parent: HierarchyParentContext;
  canCreateFolder: boolean;
  canCreateList: boolean;
  canCreateTask: boolean;
  onAdd: (level: HierarchyLevel, parent: HierarchyParentContext) => void;
}

const AddMenu: React.FC<AddMenuProps> = ({
  options,
  parent,
  canCreateFolder,
  canCreateList,
  canCreateTask,
  onAdd,
}) => {
  const [open, setOpen] = useState(false);
  const visible = options.filter((o) => {
    if (o.level === 'folder') return canCreateFolder;
    if (o.level === 'list') return canCreateList;
    if (o.level === 'task') return canCreateTask;
    return false;
  });
  if (visible.length === 0) return null;

  return (
    <div
      className="tree-add-menu"
      onClick={(e) => e.stopPropagation()}
    >
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

const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  tree,
  selection,
  canEdit,
  canCreateFolder,
  canCreateList,
  canCreateTask,
  onSelect,
  onAdd,
  onDelete,
  expanded: controlledExpanded,
  onToggleExpand,
}) => {
  const [pendingDeleteList, setPendingDeleteList] = useState<{
    id: number;
    nom: string;
  } | null>(null);

  const isControlled = !!controlledExpanded && !!onToggleExpand;
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
    new Set([`project:${tree.id_projet}`])
  );

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

  const projectCtx: HierarchyParentContext = { id_projet: tree.id_projet };

  // Backward compatibility: old data may still contain Groups/Sprints.
  // We keep it visible in the simplified tree by folding group-owned folders
  // into the Project and sprint-owned lists into their Folder/root context.
  // New creation flows no longer expose Group/Sprint.
  const projectFolders = [
    ...(tree.folders || []),
    ...(tree.groups || []).flatMap((g) => g.folders || []),
  ];

  const projectLists = [
    ...(tree.lists || []),
    ...(tree.groups || []).flatMap((g) => g.lists || []),
    ...(tree.sprints || []).flatMap((s) => s.lists || []),
    ...(tree.groups || []).flatMap((g) =>
      (g.sprints || []).flatMap((s) => s.lists || [])
    ),
  ];

  const isSelected = (sel: WorkspaceSelection) => {
    if (!selection) return false;
    return (
      selection.level === sel.level &&
      (selection.id_group ?? null) === (sel.id_group ?? null) &&
      (selection.id_folder ?? null) === (sel.id_folder ?? null) &&
      (selection.id_sprint ?? null) === (sel.id_sprint ?? null) &&
      (selection.id_list ?? null) === (sel.id_list ?? null)
    );
  };

  const renderList = (
    list: TreeListNode,
    parent: HierarchyParentContext
  ) => {
    const sel: WorkspaceSelection = {
      level: 'list',
      id_projet: tree.id_projet,
      id_group: parent.id_group,
      id_folder: parent.id_folder,
      id_sprint: parent.id_sprint,
      id_list: list.id_list,
      label: list.nom,
    };
    const ctx: HierarchyParentContext = {
      ...parent,
      id_list: list.id_list,
    };
    return (
      <div
        key={`list:${list.id_list}`}
        className={`tree-row leaf ${isSelected(sel) ? 'selected' : ''}`}
        onClick={() => onSelect(sel)}
      >
        <span className="tree-spacer" />
        <ListTodo size={14} className="tree-row-icon" />
        <span className="tree-row-label">{list.nom}</span>
        {typeof list.task_count === 'number' && (
          <span className="tree-count">{list.task_count}</span>
        )}
        <div className="tree-row-actions">
          <AddMenu
            options={ADD_OPTIONS_LIST}
            parent={ctx}
            canCreateFolder={canCreateFolder}
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
    );
  };

  const renderFolder = (
    folder: TreeFolderNode,
    parent: HierarchyParentContext
  ) => {
    const key = `folder:${folder.id_folder}`;
    const open = isExpanded(key);
    const sel: WorkspaceSelection = {
      level: 'folder',
      id_projet: tree.id_projet,
      id_group: folder.id_group ?? parent.id_group,
      id_folder: folder.id_folder,
      label: folder.nom,
    };
    const ctx: HierarchyParentContext = {
      ...parent,
      id_group: folder.id_group ?? parent.id_group,
      id_folder: folder.id_folder,
    };
    const folderLists = [
      ...(folder.lists || []),
      ...(folder.sprints || []).flatMap((s) => s.lists || []),
    ];
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
          {open ? (
            <FolderOpen size={14} className="tree-row-icon" />
          ) : (
            <Folder size={14} className="tree-row-icon" />
          )}
          <span className="tree-row-label">{folder.nom}</span>
          {typeof folder.task_count === 'number' && (
            <span className="tree-count">{folder.task_count}</span>
          )}
          <div className="tree-row-actions">
            <AddMenu
              options={ADD_OPTIONS_FOLDER}
              parent={ctx}
            canCreateFolder={canCreateFolder}
            canCreateList={canCreateList}
              canCreateTask={canCreateTask}
              onAdd={onAdd}
            />
          </div>
        </div>
        {open && (
          <div className="tree-children">
            {folderLists.map((l) => renderList(l, ctx))}
            {folderLists.length === 0 && folder.task_count === 0 && (
              <div className="tree-empty">
                <CheckSquare size={14} /> Ajoutez une liste ou une tâche.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const projectKey = `project:${tree.id_projet}`;
  const projectOpen = isExpanded(projectKey);
  const projectSel: WorkspaceSelection = {
    level: 'project',
    id_projet: tree.id_projet,
    label: tree.nom_p,
  };
  return (
    <div className="workspace-tree">
      <div className="tree-branch root">
        <div
          className={`tree-row root-row ${isSelected(projectSel) ? 'selected' : ''}`}
          onClick={() => onSelect(projectSel)}
        >
          <button
            type="button"
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggle(projectKey);
            }}
          >
            {projectOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          <Briefcase size={14} className="tree-row-icon" />
          <span className="tree-row-label">{tree.nom_p}</span>
          {typeof tree.task_count === 'number' && (
            <span className="tree-count">{tree.task_count}</span>
          )}
          <div className="tree-row-actions">
            <AddMenu
              options={ADD_OPTIONS_PROJECT}
              parent={projectCtx}
            canCreateFolder={canCreateFolder}
            canCreateList={canCreateList}
              canCreateTask={canCreateTask}
              onAdd={onAdd}
            />
          </div>
        </div>
        {projectOpen && (
          <div className="tree-children">
            {projectFolders.map((f) => renderFolder(f, projectCtx))}
            {projectLists.map((l) => renderList(l, projectCtx))}
            {tree.task_count === 0 &&
              projectFolders.length === 0 &&
              projectLists.length === 0 && (
                <div className="tree-empty">
                  <CheckSquare size={14} /> Ajoutez un dossier ou une tâche.
                </div>
              )}
          </div>
        )}
      </div>

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
    </div>
  );
};

export default WorkspaceTree;
