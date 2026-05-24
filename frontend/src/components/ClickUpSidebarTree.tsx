import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPaths, buildListPath } from '../lib/workspaceRoutes';
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
  Layers,
  LayoutGrid,
} from 'lucide-react';
import type {
  SpaceTreeNode,
  TreeListNode,
  TreeProjectNode,
  TreeSprintNode,
  TreeTaskNode,
} from '../types/hierarchy';
import ClickUpContextMenu, { type ClickUpMenuItem } from './ClickUpContextMenu';
import ClickUpCreatePopover, {
  type ClickUpCreateAction,
  type ClickUpCreateVariant,
} from './ClickUpCreatePopover';
import ClickUpTaskNameModal, {
  type ClickUpTaskCreatePayload,
} from './ClickUpTaskNameModal';
import CreateListModal from './CreateListModal';
import CreateSprintModal from './CreateSprintModal';
import type { ThemedMemberOption } from './ThemedMemberSelect';
import { useAuth } from '../hooks/useAuth';
import {
  mapTaskCreateErrorMessage,
  resolveCreateTaskAssigneeId,
  shouldPickTaskAssigneeOnCreate,
} from '../lib/taskCreateAssignment';
import {
  normalizeProjectManageContext,
  type ProjectManageContext,
} from '../lib/projectManageAccess';
import HierarchyItemConfirmModal from './HierarchyItemConfirmModal';
import type { DeleteEntityKind } from './DeleteConfirmModal';
import { sidebarCreateService } from '../services/sidebarCreate.service';
import {
  dispatchTrashRefresh,
  dispatchWorkspaceRefresh,
} from '../lib/workspaceEvents';
import { spaceService } from '../services/space.service';
import { projectService } from '../services/project.service';
import { hierarchyService } from '../services/hierarchy.service';
import { workspaceTrashService } from '../services/workspaceTrash.service';
import {
  canCreateListsInProject,
  canCreateSprintInProject,
  canCreateSprintsInProject,
  canCreateTasksInProject,
  canDeleteSubtasksInProject,
  canManageSprintsInProject,
  projectPermissionsFromSpaces,
} from '../lib/projectPermissions';
import {
  localRoleCanCreateList,
  localRoleCanCreateSprint,
  localRoleCanCreateTask,
  projectLocalRoleFromSpaces,
} from '../lib/projectLocalRolePermissions';
import { sprintService } from '../services/sprint.service';
import { recordMemberRecent } from '../lib/memberRecentStorage';
import { findHierarchyContext } from '../lib/memberRecentItems';
import { MON_ESPACE_NAME, findMonEspaceSpaceId } from '../lib/monEspaceRoute';
import EditableSubtaskName from './EditableSubtaskName';
import SubtaskDeleteButton from './SubtaskDeleteButton';
import './ClickUpSidebarTree.css';

export type ClickUpSidebarTreeLayout = 'flat' | 'sprint';

interface ClickUpSidebarTreeProps {
  spaces: SpaceTreeNode[];
  activeSpaceId?: number | null;
  activeProjectId?: number | null;
  activeSprintId?: number | null;
  activeListId?: number | null;
  activeTaskId?: number | null;
  onRefresh: () => void | Promise<void>;
  canCreateProject?: boolean;
  canCreateList?: boolean;
  canCreateTask?: boolean;
  /** When true, also allow create actions from `currentUserPermissions` on each project. */
  useProjectScopedCreate?: boolean;
  /** `sprint` shows Project → Sprint → List → Task (Mon espace member tree). */
  layout?: ClickUpSidebarTreeLayout;
  /** Single « Mon espace » root wrapping accessible projects. */
  monEspaceRoot?: boolean;
  /** Member sidebar — hierarchy fetch in progress. */
  spacesLoading?: boolean;
}

type ConfirmState = {
  itemName: string;
  entityKind: DeleteEntityKind;
  descriptionLine?: string;
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
  listId: number,
  layout: ClickUpSidebarTreeLayout
): { spaceId: number; projectId: number; sprintId: number | null } | null {
  for (const space of spaces) {
    for (const project of space.projects || []) {
      if (layout === 'sprint') {
        for (const sprint of project.sprints || []) {
          for (const list of sprint.lists || []) {
            if (list.id_list === listId) {
              return {
                spaceId: space.id_space,
                projectId: project.id_projet,
                sprintId: list.id_sprint ?? sprint.id_sprint ?? null,
              };
            }
          }
        }
      } else if (listsForProject(project).some((l) => l.id_list === listId)) {
        return {
          spaceId: space.id_space,
          projectId: project.id_projet,
          sprintId: null,
        };
      }
    }
  }
  return null;
}

function filterMonEspaceSpaces(spaces: SpaceTreeNode[]): SpaceTreeNode[] {
  const allProjects: TreeProjectNode[] = [];
  const seen = new Set<number>();
  for (const space of spaces) {
    for (const project of space.projects ?? []) {
      if (seen.has(project.id_projet)) continue;
      seen.add(project.id_projet);
      allProjects.push(project);
    }
  }

  const named = spaces.find(
    (s) => s.nom.trim().toLowerCase() === MON_ESPACE_NAME.toLowerCase()
  );

  if (named) {
    return [{ ...named, nom: MON_ESPACE_NAME, projects: allProjects }];
  }

  if (spaces.length > 0) {
    const anchor = spaces[0];
    return [
      {
        id_space: anchor.id_space,
        nom: MON_ESPACE_NAME,
        description: anchor.description ?? null,
        position: anchor.position ?? 0,
        projects: allProjects,
      },
    ];
  }

  return [];
}

/** Root tasks only — subtasks live under `task.subtasks`. */
function rootTasksForList(list: TreeListNode): TreeTaskNode[] {
  return (list.tasks ?? []).filter((t) => !t.id_parent_tache);
}

function findTaskInSidebar(
  spaces: SpaceTreeNode[],
  taskId: number,
  layout: ClickUpSidebarTreeLayout
): {
  spaceId: number;
  projectId: number;
  sprintId: number | null;
  listId: number;
  parentTaskId: number | null;
} | null {
  const walk = (
    tasks: TreeTaskNode[] | undefined,
    parentTaskId: number | null,
    onMatch: (parentId: number | null) => void
  ) => {
    for (const task of tasks ?? []) {
      if (task.id_tache === taskId) {
        onMatch(parentTaskId);
        return true;
      }
      if (
        walk(task.subtasks, task.id_tache, onMatch)
      ) {
        return true;
      }
    }
    return false;
  };

  for (const space of spaces) {
    for (const project of space.projects || []) {
      const listEntries =
        layout === 'sprint'
          ? (project.sprints || []).flatMap((sprint) =>
              (sprint.lists || []).map((list) => ({
                list,
                sprintId: list.id_sprint ?? sprint.id_sprint ?? null,
              }))
            )
          : listsForProject(project).map((list) => ({
              list,
              sprintId: list.id_sprint ?? null,
            }));

      for (const { list, sprintId } of listEntries) {
        let parentTaskId: number | null = null;
        const found = walk(rootTasksForList(list), null, (parentId) => {
          parentTaskId = parentId;
        });
        if (found) {
          return {
            spaceId: space.id_space,
            projectId: project.id_projet,
            sprintId,
            listId: list.id_list,
            parentTaskId,
          };
        }
      }
    }
  }
  return null;
}

const ClickUpSidebarTree: React.FC<ClickUpSidebarTreeProps> = ({
  spaces,
  activeSpaceId,
  activeProjectId,
  activeSprintId,
  activeListId,
  activeTaskId,
  onRefresh,
  canCreateProject = true,
  canCreateList = true,
  canCreateTask = true,
  useProjectScopedCreate = false,
  layout = 'flat',
  monEspaceRoot = false,
  spacesLoading = false,
}) => {
  const { user } = useAuth();
  const displaySpaces = useMemo(
    () => (monEspaceRoot ? filterMonEspaceSpaces(spaces) : spaces),
    [spaces, monEspaceRoot]
  );
  const canCreateTaskForProject = (projectId: number | undefined) => {
    if (canCreateTask) return true;
    if (!useProjectScopedCreate || projectId == null) return false;
    const localRole = projectLocalRoleFromSpaces(spaces, projectId);
    if (localRoleCanCreateTask(localRole)) return true;
    return canCreateTasksInProject(
      projectPermissionsFromSpaces(spaces, projectId)
    );
  };

  const canCreateListForProject = (projectId: number | undefined) => {
    if (canCreateList) return true;
    if (!useProjectScopedCreate || projectId == null) return false;
    const localRole = projectLocalRoleFromSpaces(spaces, projectId);
    if (localRoleCanCreateList(localRole)) return true;
    return canCreateListsInProject(
      projectPermissionsFromSpaces(spaces, projectId)
    );
  };

  const canCreateSprintForProject = (projectId: number | undefined) => {
    if (projectId == null) return false;
    if (!useProjectScopedCreate) return canCreateProject;
    const localRole = projectLocalRoleFromSpaces(spaces, projectId);
    if (localRoleCanCreateSprint(localRole)) return true;
    const projectPerms = projectPermissionsFromSpaces(spaces, projectId);
    return canCreateSprintInProject(projectPerms);
  };

  const canShowCreateButton = (
    variant: ClickUpCreateVariant,
    projectId?: number
  ): boolean => {
    if (variant === 'space') return canCreateProject;
    if (projectId == null) return false;
    if (variant === 'list') return canCreateTaskForProject(projectId);
    if (variant === 'project') return canCreateListForProject(projectId);
    if (variant === 'sprint') return canCreateSprintForProject(projectId);
    return false;
  };

  const canRenameSubtaskForProject = (projectId: number) => {
    if (!useProjectScopedCreate) return true;
    const perms = projectPermissionsFromSpaces(displaySpaces, projectId);
    return (
      perms.includes('edit_all_tasks') ||
      perms.includes('edit_assigned_tasks')
    );
  };

  const canDeleteSubtaskForProject = (projectId: number) => {
    if (!useProjectScopedCreate) return true;
    return canDeleteSubtasksInProject(
      projectPermissionsFromSpaces(displaySpaces, projectId)
    );
  };

  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    if (monEspaceRoot) init.add('mon-espace');
    if (activeSpaceId) init.add(`space:${activeSpaceId}`);
    if (activeProjectId) init.add(`project:${activeProjectId}`);
    if (activeSprintId) init.add(`sprint:${activeSprintId}`);
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
    sprintId?: number;
  } | null>(null);

  const [taskNameModal, setTaskNameModal] = useState<{
    spaceId: number;
    projectId: number;
    listId: number;
    listLabel: string;
  } | null>(null);
  const [taskCreateLoading, setTaskCreateLoading] = useState(false);
  const [taskCreateError, setTaskCreateError] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskShowAssigneePicker, setTaskShowAssigneePicker] = useState(false);
  const [taskAssigneeOptions, setTaskAssigneeOptions] = useState<
    ThemedMemberOption[]
  >([]);
  const [taskProjectCtx, setTaskProjectCtx] =
    useState<ProjectManageContext | null>(null);
  const [taskProjectMemberIds, setTaskProjectMemberIds] = useState<number[]>(
    []
  );

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [createListModal, setCreateListModal] = useState<{
    spaceId: number;
    projectId: number;
    sprintId?: number | null;
  } | null>(null);
  const [createListLoading, setCreateListLoading] = useState(false);
  const [createListError, setCreateListError] = useState('');
  const [createSprintModal, setCreateSprintModal] = useState<{
    spaceId: number;
    projectId: number;
  } | null>(null);
  const [monEspaceTreePrimed, setMonEspaceTreePrimed] = useState(false);

  const closeMenu = () => setMenu({ items: [], rect: null, key: null });
  const closeCreatePopover = () => setCreatePopover(null);

  const openCreateSprintModal = (spaceId: number, projectId: number) => {
    expandKeys(`space:${spaceId}`, `project:${projectId}`);
    setCreateSprintModal({ spaceId, projectId });
  };

  const getProjectSprints = useCallback(
    (projectId: number): TreeSprintNode[] => {
      for (const space of displaySpaces) {
        const project = space.projects?.find((p) => p.id_projet === projectId);
        if (project) return project.sprints ?? [];
      }
      return [];
    },
    [displaySpaces]
  );

  const resolveCreateListInitialSprintId = useCallback(
    (projectId: number, contextSprintId?: number | null): number | null => {
      const sprints = getProjectSprints(projectId);
      const ids = new Set(sprints.map((s) => s.id_sprint));
      if (
        contextSprintId != null &&
        Number.isFinite(contextSprintId) &&
        ids.has(contextSprintId)
      ) {
        return contextSprintId;
      }
      if (
        activeProjectId === projectId &&
        activeSprintId != null &&
        ids.has(activeSprintId)
      ) {
        return activeSprintId;
      }
      return null;
    },
    [getProjectSprints, activeProjectId, activeSprintId]
  );

  useEffect(() => {
    if (!taskNameModal?.projectId) {
      setTaskProjectCtx(null);
      setTaskAssigneeOptions([]);
      setTaskProjectMemberIds([]);
      setTaskShowAssigneePicker(false);
      setTaskAssigneeId('');
      setTaskCreateError('');
      return;
    }
    let cancelled = false;
    void projectService
      .getById(taskNameModal.projectId)
      .then((p) => {
        if (cancelled) return;
        const ctx = normalizeProjectManageContext(p);
        setTaskProjectCtx(ctx);
        const team = Array.isArray(p.projectTeam) ? p.projectTeam : [];
        const memberIds = team
          .map((m) => Number(m.userId))
          .filter((id) => Number.isFinite(id) && id > 0);
        setTaskProjectMemberIds(memberIds);
        const options: ThemedMemberOption[] = team
          .filter((m) => m.userId != null)
          .map((m) => {
            const label =
              `${m.prenom || ''} ${m.nom || ''}`.trim() || m.email || 'Membre';
            const a = (m.prenom || '').trim()[0] || '';
            const b = (m.nom || '').trim()[0] || '';
            const initials =
              a || b
                ? `${a}${b}`.toUpperCase()
                : (m.email || '?').trim()[0]?.toUpperCase() || '?';
            return {
              value: String(m.userId),
              label,
              role: m.roleProjet?.trim() || 'Membre',
              initials,
            };
          });
        setTaskAssigneeOptions(options);
        const pick = shouldPickTaskAssigneeOnCreate(user, ctx);
        setTaskShowAssigneePicker(pick);
        const uid =
          user?.id_utilisateur != null
            ? Number(user.id_utilisateur)
            : user?.id != null
              ? Number(user.id)
              : null;
        if (!pick && uid) {
          setTaskAssigneeId(String(uid));
        } else {
          setTaskAssigneeId('');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTaskProjectCtx(null);
        setTaskAssigneeOptions([]);
        setTaskProjectMemberIds([]);
        setTaskShowAssigneePicker(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskNameModal?.projectId, user]);

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
    listId?: number,
    sprintId?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    const keys = [`space:${spaceId}`];
    if (projectId) keys.push(`project:${projectId}`);
    if (sprintId) keys.push(`sprint:${sprintId}`);
    if (listId) keys.push(`list:${listId}`);
    expandKeys(...keys);
    const rect = e.currentTarget.getBoundingClientRect();
    setCreatePopover({ variant, rect, spaceId, projectId, listId, sprintId });
  };

  const goToSpace = useCallback(
    (spaceId: number) => navigate(appPaths.space(spaceId)),
    [navigate]
  );

  const trackMemberOpen = useCallback(
    (
      kind: 'project' | 'sprint' | 'list' | 'task',
      id: number,
      name: string,
      parentName: string,
      meta?: {
        spaceId?: number;
        projectId?: number;
        sprintId?: number;
        listId?: number;
      }
    ) => {
      if (!monEspaceRoot) return;
      recordMemberRecent({ kind, id, name, parentName, ...meta });
    },
    [monEspaceRoot]
  );

  const goToFolder = useCallback(
    (spaceId: number, folderId: number) => {
      if (monEspaceRoot) {
        const ctx = findHierarchyContext(displaySpaces, { projectId: folderId });
        trackMemberOpen(
          'project',
          folderId,
          ctx?.projectName || 'Projet',
          ctx?.spaceName || MON_ESPACE_NAME,
          { spaceId, projectId: folderId }
        );
      }
      navigate(appPaths.folder(spaceId, folderId));
    },
    [navigate, monEspaceRoot, displaySpaces, trackMemberOpen]
  );

  const goToList = useCallback(
    (listId: number) => {
      const ctx = findListContext(displaySpaces, listId, layout);
      if (layout === 'sprint' && ctx) {
        if (monEspaceRoot) {
          const h = findHierarchyContext(displaySpaces, { listId });
          trackMemberOpen('list', listId, h?.listName || 'Liste', h?.sprintName || 'Sprint', {
            spaceId: ctx.spaceId,
            projectId: ctx.projectId,
            sprintId: ctx.sprintId ?? undefined,
            listId,
          });
        }
        navigate(
          buildListPath(ctx.spaceId, ctx.projectId, listId, ctx.sprintId)
        );
        return;
      }
      navigate(appPaths.listView(listId));
    },
    [navigate, displaySpaces, layout, monEspaceRoot, trackMemberOpen]
  );

  const goToTask = useCallback(
    (taskId: number) => navigate(appPaths.task(taskId)),
    [navigate]
  );

  useEffect(() => {
    const keys: string[] = [];
    if (monEspaceRoot) keys.push('mon-espace');
    if (activeSpaceId) keys.push(`space:${activeSpaceId}`);
    if (activeProjectId) keys.push(`project:${activeProjectId}`);
    if (activeSprintId) keys.push(`sprint:${activeSprintId}`);
    if (activeListId) {
      keys.push(`list:${activeListId}`);
      const ctx = findListContext(displaySpaces, activeListId, layout);
      if (ctx) {
        keys.push(`project:${ctx.projectId}`, `space:${ctx.spaceId}`);
        if (ctx.sprintId) keys.push(`sprint:${ctx.sprintId}`);
      }
    }
    if (activeTaskId) {
      const taskCtx = findTaskInSidebar(
        displaySpaces,
        activeTaskId,
        layout
      );
      if (taskCtx) {
        keys.push(
          `space:${taskCtx.spaceId}`,
          `project:${taskCtx.projectId}`,
          `list:${taskCtx.listId}`
        );
        if (taskCtx.sprintId) keys.push(`sprint:${taskCtx.sprintId}`);
        if (taskCtx.parentTaskId) keys.push(`task:${taskCtx.parentTaskId}`);
      }
    }
    if (keys.length > 0) expandKeys(...keys);
  }, [
    activeSpaceId,
    activeProjectId,
    activeSprintId,
    activeListId,
    activeTaskId,
    displaySpaces,
    layout,
    monEspaceRoot,
  ]);

  /** Member Mon espace — expand full tree once hierarchy is loaded. */
  useEffect(() => {
    if (!monEspaceRoot || spacesLoading || monEspaceTreePrimed) return;
    const keys: string[] = ['mon-espace'];
    let hasProjects = false;
    for (const space of displaySpaces) {
      for (const project of space.projects ?? []) {
        hasProjects = true;
        keys.push(`project:${project.id_projet}`);
        for (const sprint of project.sprints ?? []) {
          keys.push(`sprint:${sprint.id_sprint}`);
        }
      }
    }
    if (!hasProjects) return;
    expandKeys(...keys);
    setMonEspaceTreePrimed(true);
  }, [monEspaceRoot, spacesLoading, monEspaceTreePrimed, displaySpaces]);

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
      itemName: space.nom,
      entityKind: 'space',
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
      itemName: project.nom_p,
      entityKind: 'folder',
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
    dispatchTrashRefresh();
    await onRefresh();
    if (activeListId === list.id_list) {
      navigate(appPaths.folder(spaceId, projectId));
    }
  };

  const handleRenameSprint = async (
    _spaceId: number,
    projectId: number,
    sprint: TreeSprintNode
  ) => {
    const perms = projectPermissionsFromSpaces(displaySpaces, projectId);
    if (!canManageSprintsInProject(perms)) {
      window.alert('Vous n\'avez pas la permission de modifier ce sprint.');
      return;
    }
    const nom = promptRename('Renommer le sprint', sprint.nom_s);
    if (!nom) return;
    await sprintService.update(String(sprint.id_sprint), { nom_s: nom });
    await onRefresh();
  };

  const trashConfirmDescription = monEspaceRoot
    ? "L'élément sera déplacé dans la corbeille. Vous pourrez le restaurer plus tard."
    : undefined;

  const handleDeleteSprint = (
    spaceId: number,
    projectId: number,
    sprint: TreeSprintNode
  ) => {
    setConfirm({
      itemName: sprint.nom_s,
      entityKind: 'sprint',
      descriptionLine: trashConfirmDescription,
      onConfirm: async () => {
        if (monEspaceRoot) {
          await sprintService.delete(String(sprint.id_sprint));
          dispatchTrashRefresh();
        } else {
          await sprintService.delete(String(sprint.id_sprint));
        }
        await onRefresh();
        if (activeSprintId === sprint.id_sprint) {
          navigate(appPaths.folder(spaceId, projectId));
        }
      },
    });
  };

  const handleDeleteList = (
    spaceId: number,
    projectId: number,
    list: TreeListNode
  ) => {
    setConfirm({
      itemName: list.nom,
      entityKind: 'list',
      descriptionLine: trashConfirmDescription,
      onConfirm: async () => {
        if (monEspaceRoot) {
          await workspaceTrashService.trashList(list.id_list);
          dispatchTrashRefresh();
        } else {
          await workspaceTrashService.deleteListPermanent(list.id_list);
        }
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

  const buildSprintMenu = (
    spaceId: number,
    projectId: number,
    sprint: TreeSprintNode
  ): ClickUpMenuItem[] => {
    const perms = projectPermissionsFromSpaces(displaySpaces, projectId);
    if (!canManageSprintsInProject(perms)) return [];
    return [
      {
        id: 'rename',
        label: 'Rename sprint',
        icon: Pencil,
        onClick: () => void handleRenameSprint(spaceId, projectId, sprint),
      },
      {
        id: 'delete',
        label: 'Delete sprint',
        icon: Trash2,
        danger: true,
        onClick: () => handleDeleteSprint(spaceId, projectId, sprint),
      },
    ];
  };

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

  const handleSubmitTaskName = async (payload: ClickUpTaskCreatePayload) => {
    if (!taskNameModal) return;
    setTaskCreateError('');
    const assigneeResult = resolveCreateTaskAssigneeId(
      user,
      taskProjectCtx,
      taskAssigneeId,
      taskProjectMemberIds
    );
    if ('error' in assigneeResult) {
      setTaskCreateError(assigneeResult.error);
      return;
    }
    setTaskCreateLoading(true);
    try {
      await sidebarCreateService.createTask({
        listId: taskNameModal.listId,
        title: payload.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
        status: 'À faire',
        projectId: taskNameModal.projectId,
        assigneeId: assigneeResult.assigneeId,
      });
      expandKeys(
        `space:${taskNameModal.spaceId}`,
        `project:${taskNameModal.projectId}`,
        `list:${taskNameModal.listId}`
      );
      await onRefresh();
      dispatchWorkspaceRefresh();
      setTaskNameModal(null);
      setTaskCreateError('');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      const raw = ax?.response?.data?.message || 'Impossible de créer la tâche.';
      setTaskCreateError(mapTaskCreateErrorMessage(raw));
    } finally {
      setTaskCreateLoading(false);
    }
  };

  const handleCreateAction = async (action: ClickUpCreateAction) => {
    if (!createPopover) return;
    const { variant, spaceId, projectId, listId, sprintId } = createPopover;
    closeCreatePopover();

    if (action === 'task') {
      if (variant === 'list' && listId != null && projectId != null) {
        if (!canCreateTaskForProject(projectId)) {
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
      const listProjectId = projectId ?? undefined;
      if (!listProjectId) return;
      if (!canCreateListForProject(listProjectId)) {
        setCreateListError(
          "Vous n'avez pas la permission de créer une liste."
        );
        setCreateListModal({
          spaceId,
          projectId: listProjectId,
          sprintId: sprintId ?? null,
        });
        return;
      }
      setCreateListError('');
      setCreateListModal({
        spaceId,
        projectId: listProjectId,
        sprintId: sprintId ?? null,
      });
    }
  };

  const handleSubmitCreateList = async (payload: {
    name: string;
    sprintId: number;
  }) => {
    if (!createListModal) return;
    const { spaceId, projectId } = createListModal;
    setCreateListLoading(true);
    setCreateListError('');
    try {
      const response = await sidebarCreateService.createList({
        id_projet: projectId,
        id_sprint: payload.sprintId,
        nom: payload.name,
      });
      const listId = response.id_list;
      const folderId = response.folderId ?? projectId;
      await onRefresh();
      dispatchWorkspaceRefresh();
      setCreateListModal(null);
      if (listId) {
        const keys = [`space:${spaceId}`, `project:${folderId}`];
        keys.push(`sprint:${payload.sprintId}`);
        keys.push(`list:${listId}`);
        expandKeys(...keys);
        goToList(listId);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setCreateListError(
        ax?.response?.data?.message || 'Impossible de créer la liste.'
      );
    } finally {
      setCreateListLoading(false);
    }
  };

  const renderAddButton = (
    label: string,
    variant: ClickUpCreateVariant,
    spaceId: number,
    projectId?: number,
    listId?: number,
    sprintId?: number
  ) => {
    if (!canShowCreateButton(variant, projectId)) return null;
    const isOpen =
      createPopover?.variant === variant &&
      createPopover.spaceId === spaceId &&
      createPopover.projectId === projectId &&
      createPopover.listId === listId &&
      createPopover.sprintId === sprintId;
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
        onClick={(e) => {
          if (variant === 'sprint' && projectId != null) {
            e.preventDefault();
            e.stopPropagation();
            openCreateSprintModal(spaceId, projectId);
            return;
          }
          openCreatePopover(e, variant, spaceId, projectId, listId, sprintId);
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    );
  };

  const renderTask = (
    task: TreeTaskNode,
    spaceId: number,
    projectId: number,
    listId: number,
    taskIndentClass: string,
    depth = 0
  ) => {
    const subtasks = task.subtasks ?? [];
    const hasSubtasks = subtasks.length > 0;
    const branchKey = `task:${task.id_tache}`;
    const subOpen = expanded.has(branchKey);
    const active = activeTaskId === task.id_tache;
    const isSubtask = depth > 0;
    const subIndent = isSubtask
      ? layout === 'sprint'
        ? 'cu-spaces-tree-indent-5'
        : 'cu-spaces-tree-indent-task-sub'
      : taskIndentClass;

    return (
      <div key={branchKey} className="cu-spaces-tree-branch">
        <div
          className={`cu-spaces-tree-row ${subIndent}${isSubtask ? ' cu-spaces-tree-row--subtask' : ''}${active ? ' is-active' : ''}`}
        >
          {hasSubtasks ? (
            <button
              type="button"
              className="cu-spaces-tree-chevron"
              aria-expanded={subOpen}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(branchKey, e);
              }}
            >
              {subOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="cu-spaces-tree-chevron--spacer" />
          )}
          {isSubtask ? (
            <div className="cu-spaces-tree-main cu-spaces-tree-main--subtask-edit">
              <span
                className="cu-spaces-tree-task-dot cu-spaces-tree-task-dot--sub"
                aria-hidden
              />
              <EditableSubtaskName
                taskId={task.id_tache}
                value={task.nom_t}
                disabled={!canRenameSubtaskForProject(projectId)}
                labelClassName="cu-spaces-tree-label cu-spaces-tree-label--task cu-spaces-tree-label--subtask"
                inputClassName="cu-spaces-tree-subtask-input"
                onNavigate={() => goToTask(task.id_tache)}
              />
              <SubtaskDeleteButton
                taskId={task.id_tache}
                taskName={task.nom_t}
                disabled={!canDeleteSubtaskForProject(projectId)}
                className="subtask-delete-btn--sidebar"
              />
            </div>
          ) : (
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
          )}
        </div>
        {hasSubtasks && subOpen ? (
          <div className="cu-spaces-tree-children">
            {subtasks.map((st) =>
              renderTask(st, spaceId, projectId, listId, taskIndentClass, depth + 1)
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSprint = (
    sprint: TreeSprintNode,
    spaceId: number,
    projectId: number
  ) => {
    const key = `sprint:${sprint.id_sprint}`;
    const open = expanded.has(key);
    const lists = filterLists(sprint.lists || []);
    const count =
      sprint.task_count ??
      lists.reduce((n, l) => n + (l.task_count ?? l.tasks?.length ?? 0), 0);
    const menuItems = buildSprintMenu(spaceId, projectId, sprint);

    return (
      <div key={key} className="cu-spaces-tree-branch">
        <div className="cu-spaces-tree-row cu-spaces-tree-indent-2">
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
            onClick={() => {
              if (monEspaceRoot) {
                const ctx = findHierarchyContext(displaySpaces, {
                  projectId,
                  sprintId: sprint.id_sprint,
                });
                trackMemberOpen(
                  'sprint',
                  sprint.id_sprint,
                  sprint.nom_s,
                  ctx?.projectName || 'Projet',
                  { spaceId, projectId, sprintId: sprint.id_sprint }
                );
              }
              goToFolder(spaceId, projectId);
            }}
          >
            <Layers size={14} className="cu-spaces-tree-icon" />
            <span className="cu-spaces-tree-label cu-spaces-tree-label--sprint">
              {sprint.nom_s}
            </span>
          </button>
          {count > 0 && <span className="cu-spaces-tree-count">{count}</span>}
          <button
            type="button"
            className={`cu-spaces-tree-menu-btn${menu.key === key ? ' is-open' : ''}`}
            aria-label="Sprint options"
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
            projectId,
            undefined,
            sprint.id_sprint
          )}
        </div>
        {open && (
          <div className="cu-spaces-tree-children">
            {lists.length > 0 ? (
              lists.map((l) => renderList(l, spaceId, projectId))
            ) : (
              <div className="cu-spaces-tree-empty">Aucune liste</div>
            )}
          </div>
        )}
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
    const tasks = rootTasksForList(list);
    const count =
      list.task_count ??
      (list.tasks?.length ?? tasks.length);
    const listIndent =
      layout === 'sprint' ? 'cu-spaces-tree-indent-3' : 'cu-spaces-tree-indent-2';
    const taskIndent =
      layout === 'sprint' ? 'cu-spaces-tree-indent-4' : 'cu-spaces-tree-indent-3';

    const menuItems = buildListMenu(spaceId, projectId, list);

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
            onClick={() => goToList(list.id_list)}
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
            {tasks.map((t) =>
              renderTask(t, spaceId, projectId, list.id_list, taskIndent)
            )}
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
    const projectSprints = project.sprints || [];
    const count = project.task_count ?? 0;

    const menuItems = buildProjectMenu(spaceId, project);
    const canAddSprint = canCreateSprintForProject(project.id_projet);

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
          {count > 0 && <span className="cu-spaces-tree-count">{count}</span>}
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
          {layout === 'sprint' && canAddSprint
            ? renderAddButton(
                'Ajouter Sprint',
                'sprint',
                spaceId,
                project.id_projet
              )
            : renderAddButton(
                'Créer une liste',
                'project',
                spaceId,
                project.id_projet
              )}
        </div>
        {open && (
          <div className="cu-spaces-tree-children">
            {layout === 'sprint' ? (
              projectSprints.length > 0 ? (
                projectSprints.map((s) =>
                  renderSprint(s, spaceId, project.id_projet)
                )
              ) : (
                <div className="cu-spaces-tree-empty cu-spaces-tree-empty--sprint">
                  <p className="cu-spaces-tree-empty-label">
                    Aucun sprint disponible
                  </p>
                  {canAddSprint && (
                    <button
                      type="button"
                      className="cu-spaces-tree-empty-action"
                      onClick={() =>
                        openCreateSprintModal(spaceId, project.id_projet)
                      }
                    >
                      <Plus size={13} strokeWidth={2.5} aria-hidden />
                      Créer votre premier sprint
                    </button>
                  )}
                </div>
              )
            ) : (
              projectLists.map((l) => renderList(l, spaceId, project.id_projet))
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

  const treeModals = (
    <>
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
        itemName={confirm?.itemName ?? ''}
        entityKind={confirm?.entityKind}
        descriptionLine={confirm?.descriptionLine}
        loading={confirmLoading}
        onCancel={() => !confirmLoading && setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />

      <ClickUpTaskNameModal
        open={!!taskNameModal}
        listLabel={taskNameModal?.listLabel}
        loading={taskCreateLoading}
        showAssigneePicker={taskShowAssigneePicker}
        assigneeOptions={taskAssigneeOptions}
        assigneeId={taskAssigneeId}
        onAssigneeChange={setTaskAssigneeId}
        externalError={taskCreateError}
        onClearExternalError={() => setTaskCreateError('')}
        onSubmit={(p) => void handleSubmitTaskName(p)}
        onCancel={() => {
          if (taskCreateLoading) return;
          setTaskNameModal(null);
          setTaskCreateError('');
        }}
      />

      <CreateListModal
        open={!!createListModal}
        sprints={
          createListModal
            ? getProjectSprints(createListModal.projectId).map((s) => ({
                id_sprint: s.id_sprint,
                nom_s: s.nom_s,
              }))
            : []
        }
        initialSprintId={
          createListModal
            ? resolveCreateListInitialSprintId(
                createListModal.projectId,
                createListModal.sprintId
              )
            : null
        }
        loading={createListLoading}
        error={createListError}
        onClearError={() => setCreateListError('')}
        onSubmit={(p) => void handleSubmitCreateList(p)}
        onCancel={() => {
          if (createListLoading) return;
          setCreateListModal(null);
          setCreateListError('');
        }}
      />

      <CreateSprintModal
        isOpen={!!createSprintModal}
        projectId={
          createSprintModal ? String(createSprintModal.projectId) : ''
        }
        onClose={() => setCreateSprintModal(null)}
        onSuccess={async () => {
          if (createSprintModal) {
            expandKeys(
              `space:${createSprintModal.spaceId}`,
              `project:${createSprintModal.projectId}`
            );
          }
          setCreateSprintModal(null);
          await onRefresh();
          dispatchWorkspaceRefresh();
        }}
      />
    </>
  );

  if (displaySpaces.length === 0 && !monEspaceRoot) {
    return (
      <>
        <p className="cu-spaces-tree-empty px-2 py-2 text-xs text-cu-text-muted">
          No spaces yet. Use + to create a space.
        </p>
        {treeModals}
      </>
    );
  }

  if (monEspaceRoot) {
    const rootOpen = expanded.has('mon-espace');
    const primarySpace = displaySpaces[0];
    const projectCount = primarySpace?.projects?.length ?? 0;
    const monEspaceSpaceId =
      primarySpace?.id_space ?? findMonEspaceSpaceId(spaces) ?? null;
    const spaceMenuItems = primarySpace ? buildSpaceMenu(primarySpace) : [];
    const monEspaceActive =
      monEspaceSpaceId != null &&
      activeSpaceId === monEspaceSpaceId &&
      activeProjectId == null &&
      activeListId == null &&
      activeTaskId == null;

    const openMonEspaceDashboard = () => {
      expandKeys('mon-espace');
      if (monEspaceSpaceId != null) {
        navigate(appPaths.space(monEspaceSpaceId));
        return;
      }
      navigate(appPaths.monEspace);
    };

    const projectsToRender = primarySpace?.projects ?? [];

    return (
      <>
        <div
          className="cu-spaces-tree cu-spaces-tree--member"
          role="tree"
          aria-label="Mon espace"
        >
          <div className="cu-spaces-tree-branch">
            <div
              className={`cu-spaces-tree-row${monEspaceActive ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="cu-spaces-tree-chevron"
                aria-expanded={rootOpen}
                onClick={(e) => toggle('mon-espace', e)}
              >
                {rootOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                type="button"
                className="cu-spaces-tree-main"
                onClick={() => openMonEspaceDashboard()}
              >
                <LayoutGrid size={14} className="cu-spaces-tree-icon" />
                <span className="cu-spaces-tree-label cu-spaces-tree-label--space">
                  {MON_ESPACE_NAME}
                </span>
              </button>
              {!spacesLoading && projectCount > 0 && (
                <span className="cu-spaces-tree-count">{projectCount}</span>
              )}
              {primarySpace && (
                <>
                  <button
                    type="button"
                    className={`cu-spaces-tree-menu-btn${menu.key === 'mon-espace' ? ' is-open' : ''}`}
                    aria-label="Space options"
                    aria-haspopup="menu"
                    aria-expanded={menu.key === 'mon-espace'}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => openMenu(e, spaceMenuItems, 'mon-espace')}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {renderAddButton('Créer', 'space', primarySpace.id_space)}
                </>
              )}
            </div>
            {rootOpen && (
              <div className="cu-spaces-tree-children">
                {spacesLoading ? (
                  <p className="cu-spaces-tree-empty px-2 py-2 text-xs text-cu-text-muted">
                    Chargement…
                  </p>
                ) : projectCount === 0 ? (
                  <p className="cu-spaces-tree-empty px-2 py-2 text-xs text-cu-text-muted">
                    Aucun contenu disponible pour le moment
                  </p>
                ) : (
                  projectsToRender.map((p) =>
                    renderProject(
                      p,
                      monEspaceSpaceId ?? primarySpace?.id_space ?? 0
                    )
                  )
                )}
              </div>
            )}
          </div>
        </div>
        {treeModals}
      </>
    );
  }

  return (
    <>
      <div className="cu-spaces-tree">{displaySpaces.map(renderSpace)}</div>

      {treeModals}
    </>
  );
};

export default ClickUpSidebarTree;
