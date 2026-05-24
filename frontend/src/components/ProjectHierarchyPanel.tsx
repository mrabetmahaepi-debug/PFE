import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  AlignJustify,
  Circle,
  Loader2,
} from 'lucide-react';
import type {
  ProjectTree,
  TreeListNode,
  TreeSprintNode,
  TreeTaskNode,
} from '../types/hierarchy';
import {
  defaultExpandedKeysForTree,
  loadProjectHierarchyExpanded,
  saveProjectHierarchyExpanded,
} from '../lib/projectHierarchyExpanded';
import './ClickUpSidebarTree.css';
import './ProjectHierarchyPanel.css';

function rootTasksForList(list: TreeListNode): TreeTaskNode[] {
  const tasks = list.tasks ?? [];
  return tasks.filter((t) => !t.id_parent_tache);
}

function formatSprintDates(sprint: TreeSprintNode): string | null {
  const start = sprint.date_debut_s
    ? new Date(sprint.date_debut_s).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  const end = sprint.date_fin_s
    ? new Date(sprint.date_fin_s).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  if (start && end) return `${start} – ${end}`;
  return start || end || null;
}

export type ProjectHierarchyPanelProps = {
  tree: ProjectTree | null;
  loading?: boolean;
  spaceId: number | null;
  activeSprintId?: number | null;
  activeListId?: number | null;
  activeTaskId?: number | null;
  canCreateSprint?: boolean;
  onCreateSprint?: () => void;
  onSelectList: (payload: {
    listId: number;
    spaceId: number;
    projectId: number;
    sprintId: number | null;
  }) => void;
  onSelectTask: (taskId: number) => void;
};

const ProjectHierarchyPanel: React.FC<ProjectHierarchyPanelProps> = ({
  tree,
  loading = false,
  spaceId,
  activeSprintId = null,
  activeListId = null,
  activeTaskId = null,
  canCreateSprint = false,
  onCreateSprint,
  onSelectList,
  onSelectTask,
}) => {
  const projectId = tree?.id_projet ?? null;
  const sprints = tree?.sprints ?? [];

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!projectId || !tree) {
      setExpanded(new Set());
      return;
    }
    const stored = loadProjectHierarchyExpanded(projectId);
    const sprintData = tree.sprints ?? [];
    if (stored && stored.size > 0) {
      setExpanded(stored);
    } else {
      setExpanded(defaultExpandedKeysForTree(projectId, sprintData));
    }
  }, [projectId, tree]);

  useEffect(() => {
    if (!projectId || expanded.size === 0) return;
    saveProjectHierarchyExpanded(projectId, expanded);
  }, [projectId, expanded]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const taskCount = tree?.task_count ?? 0;
  const listCount = useMemo(
    () => sprints.reduce((n, s) => n + (s.lists?.length ?? 0), 0),
    [sprints]
  );

  const renderTask = (
    task: TreeTaskNode,
    list: TreeListNode,
    sprintId: number | null,
    indentClass: string
  ) => {
    const active = activeTaskId === task.id_tache;
    return (
      <div
        key={`task:${task.id_tache}`}
        className={`cu-spaces-tree-row ${indentClass}${active ? ' is-active' : ''}`}
      >
        <span className="cu-spaces-tree-chevron--spacer" />
        <button
          type="button"
          className="cu-spaces-tree-main"
          onClick={() => onSelectTask(task.id_tache)}
        >
          <Circle size={12} className="cu-spaces-tree-icon" />
          <span className="cu-spaces-tree-label">{task.nom_t || 'Tâche'}</span>
        </button>
      </div>
    );
  };

  const renderList = (
    list: TreeListNode,
    sprintId: number | null,
    listIndent: string,
    taskIndent: string
  ) => {
    const key = `list:${list.id_list}`;
    const open = expanded.has(key);
    const active = activeListId === list.id_list && activeTaskId == null;
    const tasks = rootTasksForList(list);
    const count = list.task_count ?? tasks.length;

    return (
      <div key={key} className="cu-spaces-tree-branch">
        <div
          className={`cu-spaces-tree-row ${listIndent}${active ? ' is-active' : ''}`}
        >
          {tasks.length > 0 ? (
            <button
              type="button"
              className="cu-spaces-tree-chevron"
              aria-expanded={open}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(key);
              }}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="cu-spaces-tree-chevron--spacer" />
          )}
          <button
            type="button"
            className="cu-spaces-tree-main"
            onClick={() => {
              if (spaceId == null || projectId == null) return;
              onSelectList({
                listId: list.id_list,
                spaceId,
                projectId,
                sprintId: list.id_sprint ?? sprintId,
              });
            }}
          >
            <AlignJustify size={14} className="cu-spaces-tree-icon" />
            <span className="cu-spaces-tree-label cu-spaces-tree-label--list">
              {list.nom}
            </span>
          </button>
          {count > 0 && (
            <span className="cu-spaces-tree-count" title="Tâches">
              {count}
            </span>
          )}
        </div>
        {open && tasks.length > 0 && (
          <div className="cu-spaces-tree-children">
            {tasks.map((t) => renderTask(t, list, sprintId, taskIndent))}
          </div>
        )}
      </div>
    );
  };

  const renderSprint = (sprint: TreeSprintNode) => {
    const key = `sprint:${sprint.id_sprint}`;
    const open = expanded.has(key);
    const active =
      activeSprintId === sprint.id_sprint &&
      activeListId == null &&
      activeTaskId == null;
    const lists = sprint.lists ?? [];
    const count =
      sprint.task_count ??
      lists.reduce(
        (n, l) => n + (l.task_count ?? l.tasks?.length ?? 0),
        0
      );
    const dateLabel = formatSprintDates(sprint);

    return (
      <div key={key} className="cu-spaces-tree-branch">
        <div
          className={`cu-spaces-tree-row cu-spaces-tree-indent-1${active ? ' is-active' : ''}`}
        >
          <button
            type="button"
            className="cu-spaces-tree-chevron"
            aria-expanded={open}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(key);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button
            type="button"
            className="cu-spaces-tree-main"
            onClick={() => toggle(key)}
          >
            <Layers size={14} className="cu-spaces-tree-icon" />
            <span className="cu-spaces-tree-label cu-spaces-tree-label--sprint">
              {sprint.nom_s}
            </span>
          </button>
          <span className="project-hierarchy-sprint-badge" aria-hidden>
            Sprint
          </span>
          {dateLabel && (
            <span className="cu-spaces-tree-count" title="Période">
              {dateLabel}
            </span>
          )}
          {count > 0 && (
            <span className="cu-spaces-tree-count" title="Tâches">
              {count}
            </span>
          )}
        </div>
        {open && (
          <div className="cu-spaces-tree-children">
            {lists.length > 0 ? (
              lists.map((l) =>
                renderList(l, sprint.id_sprint, 'cu-spaces-tree-indent-2', 'cu-spaces-tree-indent-3')
              )
            ) : (
              <div className="cu-spaces-tree-empty">Aucune liste</div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading && !tree) {
    return (
      <div className="project-hierarchy-panel project-hierarchy-panel--loading">
        <Loader2 size={22} className="animate-spin" aria-hidden />
        <span>Chargement du projet…</span>
      </div>
    );
  }

  if (!tree || projectId == null) {
    return null;
  }

  const projectOpen = expanded.has(`project:${projectId}`);
  const noContent =
    !loading && sprints.length === 0 && taskCount === 0;

  return (
    <div className="project-hierarchy-panel">
      <header className="project-hierarchy-header">
        <div className="project-hierarchy-header-main">
          <Folder size={22} className="project-hierarchy-header-icon" aria-hidden />
          <div>
            <h1 className="project-hierarchy-title">{tree.nom_p}</h1>
            <p className="project-hierarchy-subtitle">
              {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} ·{' '}
              {listCount} liste{listCount !== 1 ? 's' : ''} · {taskCount} tâche
              {taskCount !== 1 ? 's' : ''}
            </p>
            {tree.currentUserProjectRole && (
              <span className="project-hierarchy-role">
                {tree.currentUserProjectRole}
              </span>
            )}
          </div>
        </div>
        {canCreateSprint && onCreateSprint && (
          <button
            type="button"
            className="project-hierarchy-add-sprint"
            onClick={onCreateSprint}
          >
            + Sprint
          </button>
        )}
      </header>

      {noContent ? (
        <div className="project-hierarchy-empty" role="status">
          <p className="project-hierarchy-empty-title">
            Aucun contenu accessible
          </p>
          <p>
            Les sprints, listes et tâches visibles pour votre rôle dans ce projet
            apparaîtront ici.
          </p>
        </div>
      ) : (
        <div
          className="project-hierarchy-tree cu-spaces-tree"
          role="tree"
          aria-label={`Structure du projet ${tree.nom_p}`}
        >
          <div className="cu-spaces-tree-branch">
            <div
              className={`cu-spaces-tree-row${activeListId == null && activeTaskId == null ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="cu-spaces-tree-chevron"
                aria-expanded={projectOpen}
                onClick={() => toggle(`project:${projectId}`)}
              >
                {projectOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
              <button
                type="button"
                className="cu-spaces-tree-main"
                onClick={() => toggle(`project:${projectId}`)}
              >
                <Folder size={14} className="cu-spaces-tree-icon" />
                <span className="cu-spaces-tree-label cu-spaces-tree-label--project">
                  {tree.nom_p}
                </span>
              </button>
              {taskCount > 0 && (
                <span className="cu-spaces-tree-count">{taskCount}</span>
              )}
            </div>
            {projectOpen && (
              <div className="cu-spaces-tree-children">
                {sprints.length > 0 ? (
                  sprints.map((s) => renderSprint(s))
                ) : (
                  <div className="cu-spaces-tree-empty">Aucun sprint</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectHierarchyPanel;
