import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPaths } from '../lib/workspaceRoutes';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Folder,
  AlignJustify,
  MoreHorizontal,
  Trash2,
  Plus,
  Pencil,
  Archive,
} from 'lucide-react';
import type {
  SpaceTreeNode,
  TreeListNode,
  TreeProjectNode,
  TreeTaskNode,
} from '../types/hierarchy';
import ClickUpContextMenu, { type ClickUpMenuItem } from './ClickUpContextMenu';
import ClickUpCreatePopover, {
  type ClickUpCreateAction,
  type ClickUpCreateVariant,
} from './ClickUpCreatePopover';
import ClickUpTaskNameModal from './ClickUpTaskNameModal';
import HierarchyItemConfirmModal from './HierarchyItemConfirmModal';
import { sidebarCreateService } from '../services/sidebarCreate.service';
import { dispatchWorkspaceRefresh } from '../lib/workspaceEvents';
import { spaceService } from '../services/space.service';
import { projectService } from '../services/project.service';
import { hierarchyService } from '../services/hierarchy.service';
import { workspaceTrashService } from '../services/workspaceTrash.service';
import './ClickUpSidebarTree.css';

interface ClickUpSidebarTreeProps {
  spaces: SpaceTreeNode[];
  activeSpaceId?: number | null;
  activeProjectId?: number | null;
  activeListId?: number | null;
  activeTaskId?: number | null;
  onRefresh: () => void | Promise<void>;
  canCreateProject?: boolean;
  canCreateList?: boolean;
  canCreateTask?: boolean;
}

type ConfirmState = {
  title: string;
  message: React.ReactNode;
  onConfirm: () => Promise<void>;
};

function isDefaultListName(nom: string): boolean {
  return /liste\s+par\s+d[eé]faut/i.test(nom.trim());
}

function filterLists(lists: TreeListNode[]): TreeListNode[] {
  const real = lists.filter((l) => !isDefaultListName(l.nom));
  if (real.length > 0) return real;
  return lists;
}

/** Flatten Project → Sprint → List to Project → List for sidebar (sprints are not shown). */
function listsForProject(project: TreeProjectNode): TreeListNode[] {
  const seen = new Set<number>();
  const out: TreeListNode[] = [];
  for (const list of filterLists(
    (project.sprints || []).flatMap((s) => s.lists || [])
  )) {
    if (seen.has(list.id_list)) continue;
    seen.add(list.id_list);
    out.push(list);
  }
  return out;
}

function findListContext(
  spaces: SpaceTreeNode[],
  listId: number
): { spaceId: number; projectId: number } | null {
  for (const space of spaces) {
    for (const project of space.projects || []) {
      if (listsForProject(project).some((l) => l.id_list === listId)) {
        return { spaceId: space.id_space, projectId: project.id_projet };
      }
    }
  }
  return null;
}

const ClickUpSidebarTree: React.FC<ClickUpSidebarTreeProps> = ({
  spaces,
  activeSpaceId,
  activeProjectId,
  activeListId,
  activeTaskId,
  onRefresh,
  canCreateProject = true,
  canCreateList = true,
  canCreateTask = true,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    if (activeSpaceId) init.add(`space:${activeSpaceId}`);
    if (activeProjectId) init.add(`project:${activeProjectId}`);
    if (activeListId) init.add(`list:${activeListId}`);
    return init;
  });

  const [menu, setMenu] = useState<{
    items: ClickUpMenuItem[];
    rect: DOMRect | null;
    key: string | null;
  }>({ items: [], rect: null, key: null });

  const [createPopover, setCreatePopover] = useState<{
    variant: ClickUpCreateVariant;
    rect: DOMRect;
    spaceId: number;
    projectId?: number;
    listId?: number;
  } | null>(null);

  const [taskNameModal, setTaskNameModal] = useState<{
    spaceId: number;
    projectId: number;
    listId: number;
    listLabel: string;
  } | null>(null);
  const [taskCreateLoading, setTaskCreateLoading] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const closeMenu = () => setMenu({ items: [], rect: null, key: null });
  const closeCreatePopover = () => setCreatePopover(null);

  const expandKeys = (...keys: string[]) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const openCreatePopover = (
    e: React.MouseEvent<HTMLButtonElement>,
    variant: ClickUpCreateVariant,
    spaceId: number,
    projectId?: number,
    listId?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    const keys = [`space:${spaceId}`];
    if (projectId) keys.push(`project:${projectId}`);
    if (listId) keys.push(`list:${listId}`);
    expandKeys(...keys);
    const rect = e.currentTarget.getBoundingClientRect();
    setCreatePopover({ variant, rect, spaceId, projectId, listId });
  };

  const goToSpace = useCallback(
    (spaceId: number) => navigate(appPaths.space(spaceId)),
    [navigate]
  );

  const goToFolder = useCallback(
    (spaceId: number, folderId: number) =>
      navigate(appPaths.folder(spaceId, folderId)),
    [navigate]
  );

  const goToList = useCallback(
    (listId: number) => {
      console.log('clicked list', listId);
      navigate(appPaths.listView(listId));
    },
    [navigate]
  );

  const goToTask = useCallback(
    (taskId: number) => navigate(appPaths.task(taskId)),
    [navigate]
  );

  useEffect(() => {
    const keys: string[] = [];
    if (activeSpaceId) keys.push(`space:${activeSpaceId}`);
    if (activeProjectId) keys.push(`project:${activeProjectId}`);
    if (activeListId) {
      keys.push(`list:${activeListId}`);
      const ctx = findListContext(spaces, activeListId);
      if (ctx) {
        keys.push(`project:${ctx.projectId}`, `space:${ctx.spaceId}`);
      }
    }
    if (keys.length > 0) expandKeys(...keys);
  }, [activeSpaceId, activeProjectId, activeListId, spaces]);

  const toggle = (key: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    items: ClickUpMenuItem[],
    menuKey: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    closeCreatePopover();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ items, rect, key: menuKey });
  };

  const promptRename = (label: string, current: string): string | null => {
    const raw = window.prompt(label, current);
    if (raw == null) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      window.alert(ax?.response?.data?.message || 'Action impossible.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleRenameSpace = async (space: SpaceTreeNode) => {
    const nom = promptRename('Renommer l\'espace', space.nom);
    if (!nom) return;
    await spaceService.update(space.id_space, { nom });
    await onRefresh();
  };

  const handleTrashSpace = async (space: SpaceTreeNode) => {
    await workspaceTrashService.trashSpace(space.id_space);
    await onRefresh();
    if (activeSpaceId === space.id_space) navigate(appPaths.spaces);
  };

  const handleDeleteSpace = (space: SpaceTreeNode) => {
    setConfirm({
      title: 'Supprimer l\'espace ?',
      message: (
        <>
          L'espace <strong>{space.nom}</strong> sera supprimé définitivement.
          Cette action est irréversible.
        </>
      ),
      onConfirm: async () => {
        await workspaceTrashService.deleteSpacePermanent(space.id_space);
        await onRefresh();
        if (activeSpaceId === space.id_space) navigate(appPaths.spaces);
      },
    });
  };

  const handleRenameProject = async (
    spaceId: number,
    project: TreeProjectNode
  ) => {
    const nom = promptRename('Renommer le dossier', project.nom_p);
    if (!nom) return;
    await projectService.update(project.id_projet, { nom_p: nom, name: nom });
    await onRefresh();
    goToFolder(spaceId, project.id_projet);
  };

  const handleTrashProject = async (spaceId: number, project: TreeProjectNode) => {
    await workspaceTrashService.trashProject(project.id_projet);
    await onRefresh();
    if (activeProjectId === project.id_projet) {
      navigate(appPaths.space(spaceId));
    }
  };

  const handleDeleteProject = (spaceId: number, project: TreeProjectNode) => {
    setConfirm({
      title: 'Supprimer le dossier ?',
      message: (
        <>
          Le dossier <strong>{project.nom_p}</strong> sera supprimé
          définitivement. Cette action est irréversible.
        </>
      ),
      onConfirm: async () => {
        await workspaceTrashService.deleteProjectPermanent(project.id_projet);
        await onRefresh();
        if (activeProjectId === project.id_projet) {
          navigate(appPaths.space(spaceId));
        }
      },
    });
  };

  const handleRenameList = async (
    spaceId: number,
    projectId: number,
    list: TreeListNode
  ) => {
    const nom = promptRename('Renommer la liste', list.nom);
    if (!nom) return;
    await hierarchyService.updateList(list.id_list, { nom });
    await onRefresh();
    goToList(list.id_list);
  };

  const handleTrashList = async (
    spaceId: number,
    projectId: number,
    list: TreeListNode
  ) => {
    await workspaceTrashService.trashList(list.id_list);
    await onRefresh();
    if (activeListId === list.id_list) {
      navigate(appPaths.folder(spaceId, projectId));
    }
  };

  const handleDeleteList = (
    spaceId: number,
    projectId: number,
    list: TreeListNode
  ) => {
    setConfirm({
      title: 'Supprimer la liste ?',
      message: (
        <>
          La liste <strong>{list.nom}</strong> sera supprimée définitivement.
          Les tâches associées peuvent être affectées.
        </>
      ),
      onConfirm: async () => {
        await workspaceTrashService.deleteListPermanent(list.id_list);
        await onRefresh();
        if (activeListId === list.id_list) {
          navigate(appPaths.folder(spaceId, projectId));
        }
      },
    });
  };

  const buildSpaceMenu = (space: SpaceTreeNode): ClickUpMenuItem[] => [
    {
      id: 'rename',
      label: 'Rename space',
      icon: Pencil,
      onClick: () => void handleRenameSpace(space),
    },
    {
      id: 'delete',
      label: 'Delete space',
      icon: Trash2,
      danger: true,
      onClick: () => handleDeleteSpace(space),
    },
    {
      id: 'trash',
      label: 'Move space to trash',
      icon: Archive,
      onClick: () => void handleTrashSpace(space),
    },
  ];

  const buildProjectMenu = (
    spaceId: number,
    project: TreeProjectNode
  ): ClickUpMenuItem[] => [
    {
      id: 'rename',
      label: 'Rename folder',
      icon: Pencil,
      onClick: () => void handleRenameProject(spaceId, project),
    },
    {
      id: 'delete',
      label: 'Delete folder',
      icon: Trash2,
      danger: true,
      onClick: () => handleDeleteProject(spaceId, project),
    },
    {
      id: 'trash',
      label: 'Move folder to trash',
      icon: Archive,
      onClick: () => void handleTrashProject(spaceId, project),
    },
  ];

  const buildListMenu = (
    spaceId: number,
    projectId: number,
    list: TreeListNode
  ): ClickUpMenuItem[] => [
    {
      id: 'rename',
      label: 'Rename list',
      icon: Pencil,
      onClick: () => void handleRenameList(spaceId, projectId, list),
    },
    {
      id: 'delete',
      label: 'Delete list',
      icon: Trash2,
      danger: true,
      onClick: () => handleDeleteList(spaceId, projectId, list),
    },
    {
      id: 'trash',
      label: 'Move list to trash',
      icon: Archive,
      onClick: () => void handleTrashList(spaceId, projectId, list),
    },
  ];

  const promptName = (label: string, defaultName: string): string | null => {
    const raw = window.prompt(label, defaultName);
    if (raw == null) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const handleSubmitTaskName = async (title: string) => {
    if (!taskNameModal) return;
    setTaskCreateLoading(true);
    try {
      await sidebarCreateService.createTask({
        listId: taskNameModal.listId,
        title,
        status: 'À faire',
        projectId: taskNameModal.projectId,
      });
      expandKeys(
        `space:${taskNameModal.spaceId}`,
        `project:${taskNameModal.projectId}`,
        `list:${taskNameModal.listId}`
      );
      await onRefresh();
      dispatchWorkspaceRefresh();
      setTaskNameModal(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      window.alert(ax?.response?.data?.message || 'Impossible de créer la tâche.');
    } finally {
      setTaskCreateLoading(false);
    }
  };

  const handleCreateAction = async (action: ClickUpCreateAction) => {
    if (!createPopover) return;
    const { variant, spaceId, projectId, listId } = createPopover;
    closeCreatePopover();

    if (action === 'task') {
      if (variant === 'list' && listId != null && projectId != null) {
        if (!canCreateTask) {
          window.alert('Vous n\'avez pas la permission de créer une tâche.');
          return;
        }
        const listLabel =
          spaces
            .find((s) => s.id_space === spaceId)
            ?.projects?.flatMap((p) =>
              (p.sprints || []).flatMap((sp) => sp.lists || [])
            )
            .find((l) => l.id_list === listId)?.nom ?? 'Liste';
        expandKeys(`space:${spaceId}`, `project:${projectId}`, `list:${listId}`);
        setTaskNameModal({ spaceId, projectId, listId, listLabel });
      }
      return;
    }

    if (action === 'folder') {
      if (!canCreateProject) {
        window.alert('Vous n\'avez pas la permission de créer un dossier.');
        return;
      }
      const name = promptName('Nom du dossier', 'Nouveau dossier');
      if (!name) return;
      try {
        const response = await sidebarCreateService.createFolder({
          spaceId,
          name,
        });
        const folderId =
          response.folderId ?? response.id_projet ?? response.id_folder;
        await onRefresh();
        if (folderId) {
          expandKeys(`space:${spaceId}`, `project:${folderId}`);
          goToFolder(spaceId, folderId);
        }
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        window.alert(ax?.response?.data?.message || 'Impossible de créer le dossier.');
      }
      return;
    }

    if (action === 'list') {
      if (!canCreateList) {
        window.alert('Vous n\'avez pas la permission de créer une liste.');
        return;
      }
      const name = promptName('Nom de la liste', 'Nouvelle liste');
      if (!name) return;
      const payload = {
        spaceId,
        folderId: variant === 'project' && projectId ? projectId : null,
        name,
      };
      try {
        const response = await sidebarCreateService.createList(payload);
        const listId = response.id_list;
        const folderId =
          response.folderId ?? payload.folderId ?? projectId ?? null;
        await onRefresh();
        if (listId) {
          const keys = [`space:${spaceId}`];
          if (folderId) keys.push(`project:${folderId}`);
          keys.push(`list:${listId}`);
          expandKeys(...keys);
          if (listId) {
            goToList(listId);
          }
        }
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        window.alert(ax?.response?.data?.message || 'Impossible de créer la liste.');
      }
    }
  };

  const renderAddButton = (
    label: string,
    variant: ClickUpCreateVariant,
    spaceId: number,
    projectId?: number,
    listId?: number
  ) => {
    const isOpen =
      createPopover?.variant === variant &&
      createPopover.spaceId === spaceId &&
      createPopover.projectId === projectId &&
      createPopover.listId === listId;
    return (
      <button
        type="button"
        className={`cu-spaces-tree-add-btn${isOpen ? ' is-open' : ''}`}
        aria-label={label}
        title={label}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => openCreatePopover(e, variant, spaceId, projectId, listId)}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    );
  };

  const renderTask = (
    task: TreeTaskNode,
    spaceId: number,
    projectId: number,
    listId: number
  ) => {
    const active = activeTaskId === task.id_tache;
    return (
      <div
        key={`task:${task.id_tache}`}
        className={`cu-spaces-tree-row cu-spaces-tree-indent-3${active ? ' is-active' : ''}`}
      >
        <span className="cu-spaces-tree-chevron--spacer" />
        <button
          type="button"
          className="cu-spaces-tree-main"
          onClick={() => goToTask(task.id_tache)}
        >
          <span className="cu-spaces-tree-task-dot" aria-hidden />
          <span className="cu-spaces-tree-label cu-spaces-tree-label--task">
            {task.nom_t}
          </span>
        </button>
      </div>
    );
  };

  const renderList = (
    list: TreeListNode,
    spaceId: number,
    projectId: number
  ) => {
    const key = `list:${list.id_list}`;
    const open = expanded.has(key);
    const active = activeListId === list.id_list && activeTaskId == null;
    const tasks = list.tasks || [];
    const count = list.task_count ?? tasks.length;

    const menuItems = buildListMenu(spaceId, projectId, list);

    return (
      <div key={key} className="cu-spaces-tree-branch">
        <div
          className={`cu-spaces-tree-row cu-spaces-tree-indent-2${active ? ' is-active' : ''}`}
        >
          {tasks.length > 0 ? (
            <button
              type="button"
              className="cu-spaces-tree-chevron"
              aria-expanded={open}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(key, e);
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
              console.log('clicked list', list.id_list);
              goToList(list.id_list);
            }}
          >
            <AlignJustify size={14} className="cu-spaces-tree-icon" />
            <span className="cu-spaces-tree-label cu-spaces-tree-label--list">
              {list.nom}
            </span>
          </button>
          {count > 0 && <span className="cu-spaces-tree-count">{count}</span>}
          <button
            type="button"
            className={`cu-spaces-tree-menu-btn${menu.key === key ? ' is-open' : ''}`}
            aria-label="List options"
            aria-haspopup="menu"
            aria-expanded={menu.key === key}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => openMenu(e, menuItems, key)}
          >
            <MoreHorizontal size={14} />
          </button>
          {renderAddButton(
            'Créer une tâche',
            'list',
            spaceId,
            projectId,
            list.id_list
          )}
        </div>
        {open && tasks.length > 0 && (
          <div className="cu-spaces-tree-children">
            {tasks.map((t) => renderTask(t, spaceId, projectId, list.id_list))}
          </div>
        )}
      </div>
    );
  };

  const renderProject = (project: TreeProjectNode, spaceId: number) => {
    const key = `project:${project.id_projet}`;
    const open = expanded.has(key);
    const active =
      activeProjectId === project.id_projet &&
      activeListId == null &&
      activeTaskId == null;
    const projectLists = listsForProject(project);

    const menuItems = buildProjectMenu(spaceId, project);

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
              toggle(key, e);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button
            type="button"
            className="cu-spaces-tree-main"
            onClick={() => goToFolder(spaceId, project.id_projet)}
          >
            <Folder size={14} className="cu-spaces-tree-icon" />
            <span className="cu-spaces-tree-label cu-spaces-tree-label--project">
              {project.nom_p}
            </span>
          </button>
          <button
            type="button"
            className={`cu-spaces-tree-menu-btn${menu.key === key ? ' is-open' : ''}`}
            aria-label="Folder options"
            aria-haspopup="menu"
            aria-expanded={menu.key === key}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => openMenu(e, menuItems, key)}
          >
            <MoreHorizontal size={14} />
          </button>
          {renderAddButton(
            'Créer une liste',
            'project',
            spaceId,
            project.id_projet
          )}
        </div>
        {open && (
          <div className="cu-spaces-tree-children">
            {projectLists.map((l) =>
              renderList(l, spaceId, project.id_projet)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSpace = (space: SpaceTreeNode) => {
    const key = `space:${space.id_space}`;
    const open = expanded.has(key);
    const active =
      activeSpaceId === space.id_space &&
      activeProjectId == null &&
      activeListId == null;
    const projects = space.projects || [];

    const menuItems = buildSpaceMenu(space);

    return (
      <div key={key} className="cu-spaces-tree-branch">
        <div className={`cu-spaces-tree-row${active ? ' is-active' : ''}`}>
          <button
            type="button"
            className="cu-spaces-tree-chevron"
            aria-expanded={open}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(key, e);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button
            type="button"
            className="cu-spaces-tree-main"
            onClick={() => goToSpace(space.id_space)}
          >
            <Globe size={14} className="cu-spaces-tree-icon" />
            <span className="cu-spaces-tree-label cu-spaces-tree-label--space">
              {space.nom}
            </span>
          </button>
          <button
            type="button"
            className={`cu-spaces-tree-menu-btn${menu.key === key ? ' is-open' : ''}`}
            aria-label="Space options"
            aria-haspopup="menu"
            aria-expanded={menu.key === key}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => openMenu(e, menuItems, key)}
          >
            <MoreHorizontal size={14} />
          </button>
          {renderAddButton('Créer', 'space', space.id_space)}
        </div>
        {open && (
          <div className="cu-spaces-tree-children">
            {projects.map((p) => renderProject(p, space.id_space))}
          </div>
        )}
      </div>
    );
  };

  if (spaces.length === 0) {
    return (
      <p className="px-2 py-2 text-[12px] text-[#87909e]">
        No spaces yet. Use + to create a space.
      </p>
    );
  }

  return (
    <>
      <div className="cu-spaces-tree">{spaces.map(renderSpace)}</div>

      <ClickUpContextMenu
        open={menu.items.length > 0}
        anchorRect={menu.rect}
        items={menu.items}
        onClose={closeMenu}
      />

      <ClickUpCreatePopover
        open={!!createPopover}
        variant={createPopover?.variant ?? 'space'}
        anchorRect={createPopover?.rect ?? null}
        showFolder={
          createPopover?.variant === 'space' ? canCreateProject : false
        }
        onSelect={(action) => void handleCreateAction(action)}
        onClose={closeCreatePopover}
      />

      <HierarchyItemConfirmModal
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? null}
        loading={confirmLoading}
        onCancel={() => !confirmLoading && setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />

      <ClickUpTaskNameModal
        open={!!taskNameModal}
        listLabel={taskNameModal?.listLabel}
        loading={taskCreateLoading}
        onSubmit={(title) => void handleSubmitTaskName(title)}
        onCancel={() => !taskCreateLoading && setTaskNameModal(null)}
      />
    </>
  );
};

export default ClickUpSidebarTree;
