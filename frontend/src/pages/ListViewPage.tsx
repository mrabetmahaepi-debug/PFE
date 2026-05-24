import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ListPageView from '../components/ListPageView';
import CreateHierarchyItemModal, {
  type HierarchyParentContext,
  type CreatedHierarchyItem,
} from '../components/CreateHierarchyItemModal';
import { hierarchyService } from '../services/hierarchy.service';
import { projectService } from '../services/project.service';
import { usePermission } from '../hooks/usePermission';
import { useAuth } from '../hooks/useAuth';
import { getRoleKey } from '../lib/permissions';
import { canCreateTasksInProject, canEditTasksInProject } from '../lib/projectPermissions';
import { dispatchWorkspaceRefresh, WORKSPACE_REFRESH_EVENT, PROJECT_PERMISSIONS_CHANGED_EVENT } from '../lib/workspaceEvents';
import type { ListDetail } from '../types/hierarchy';
import './ListViewPage.css';

const ListViewPage: React.FC = () => {
  const { listId: listIdParam } = useParams<{ listId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { isSuperAdmin } = usePermission();

  const listId = listIdParam ? Number(listIdParam) : NaN;
  const validListId = Number.isFinite(listId) && listId > 0 ? listId : null;

  const [listDetail, setListDetail] = useState<ListDetail | null>(null);
  const [projectPermissions, setProjectPermissions] = useState<string[]>([]);
  const [pageRefreshKey, setPageRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalParent, setModalParent] = useState<HierarchyParentContext | null>(null);
  const [modalStatutKey, setModalStatutKey] = useState<string | undefined>();
  const [modalDueDate, setModalDueDate] = useState<string | undefined>();

  useEffect(() => {
    console.log('route', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!validListId) return;
    void hierarchyService
      .getListById(validListId)
      .then(setListDetail)
      .catch(() => setListDetail(null));
  }, [validListId, pageRefreshKey]);

  useEffect(() => {
    const pid = listDetail?.id_projet;
    if (!pid) {
      setProjectPermissions([]);
      return;
    }
    projectService
      .getById(pid)
      .then((p) =>
        setProjectPermissions(
          Array.isArray(p.currentUserPermissions) ? p.currentUserPermissions : []
        )
      )
      .catch(() => setProjectPermissions([]));
  }, [listDetail?.id_projet]);

  const parentCtx: HierarchyParentContext | null = useMemo(() => {
    if (!listDetail || !validListId) return null;
    return {
      id_projet: listDetail.id_projet,
      id_sprint: listDetail.id_sprint ?? null,
      id_list: validListId,
      id_space: listDetail.projet?.id_space ?? null,
    };
  }, [listDetail, validListId]);

  const canCreateTask = useMemo(() => {
    return (
      isSuperAdmin ||
      getRoleKey(user) === 'ADMIN' ||
      canCreateTasksInProject(projectPermissions)
    );
  }, [isSuperAdmin, user, projectPermissions]);

  const canEditTask = useMemo(() => {
    return (
      isSuperAdmin ||
      getRoleKey(user) === 'ADMIN' ||
      canEditTasksInProject(projectPermissions)
    );
  }, [isSuperAdmin, user, projectPermissions]);

  const canDeleteTask =
    isSuperAdmin ||
    getRoleKey(user) === 'ADMIN' ||
    projectPermissions.includes('delete_tasks');

  const refreshPage = useCallback(() => {
    setPageRefreshKey((k) => k + 1);
    dispatchWorkspaceRefresh();
  }, []);

  useEffect(() => {
    const onRefresh = () => refreshPage();
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    window.addEventListener(PROJECT_PERMISSIONS_CHANGED_EVENT, onRefresh);
    return () => {
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
      window.removeEventListener(PROJECT_PERMISSIONS_CHANGED_EVENT, onRefresh);
    };
  }, [refreshPage]);

  const openCreateTask = (
    parent: HierarchyParentContext,
    defaultStatutKey?: string,
    defaultDueDateIso?: string
  ) => {
    setModalParent(parent);
    setModalStatutKey(defaultStatutKey);
    setModalDueDate(defaultDueDateIso);
    setModalOpen(true);
  };

  const handleCreateSuccess = (_item: CreatedHierarchyItem) => {
    setModalOpen(false);
    refreshPage();
  };

  if (!validListId) {
    return (
      <div className="list-view-page list-view-page--error">
        <p>Liste introuvable.</p>
      </div>
    );
  }

  return (
    <div className="list-view-page workspace-page workspace-page--clickup">
      <ListPageView
        key={String(validListId)}
        listId={validListId}
        refreshKey={pageRefreshKey}
        canCreateTask={canCreateTask}
        canEditTask={canEditTask}
        canDeleteTask={canDeleteTask}
        clickUpMode
        onOpenCreateTask={(parent, status, dueDateIso) => {
          if (parent) openCreateTask(parent, status, dueDateIso);
          else if (parentCtx) openCreateTask(parentCtx, status, dueDateIso);
        }}
        onRefreshHierarchy={async () => {
          refreshPage();
        }}
      />

      <CreateHierarchyItemModal
        isOpen={modalOpen}
        level="task"
        parent={modalParent ?? parentCtx}
        defaultStatutKey={modalStatutKey}
        defaultEndDate={modalDueDate}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreateSuccess}
        taskListOptions={
          validListId
            ? [{ id: validListId, label: listDetail?.nom ?? 'Liste' }]
            : []
        }
      />

    </div>
  );
};

export default ListViewPage;
