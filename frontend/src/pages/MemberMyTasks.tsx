import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import ClickUpTaskNameModal, {

  type ClickUpTaskCreatePayload,

} from '../components/ClickUpTaskNameModal';

import { taskService } from '../services/task.service';

import { useAuth } from '../hooks/useAuth';

import {

  type Tache,

  TaskPriority,

  TaskStatus,

} from '../types/task';

import {

  filterByMemberView,

  filterTasksAssignedToMember,

  parseMemberTasksView,

} from '../lib/memberTasksViews';

import {

  parseMemberAssignedFiltersFromSearch,

  parseTodayGroupFilter,

} from '../lib/memberDashboardNavigation';

import {

  dispatchWorkspaceRefresh,

  WORKSPACE_REFRESH_EVENT,

} from '../lib/workspaceEvents';

import { normalizeTaskStatutKey } from '../lib/listStatusGroups';

import { isoFromDateInput } from '../lib/taskDateValidation';

import { mapTaskCreateErrorMessage } from '../lib/taskCreateAssignment';

import {

  resolveMemberAssignedTaskCreateContext,

  type MemberAssignedTaskCreateContext,

} from '../lib/memberAssignedTaskCreate';

import MemberAssignedTasksView from './MemberAssignedTasksView';

import MemberTodayOverdue from './MemberTodayOverdue';



const MemberMyTasks: React.FC = () => {

  const { user } = useAuth();

  const [searchParams] = useSearchParams();

  const activeView = parseMemberTasksView(searchParams.get('view'));

  const searchKey = searchParams.toString();

  const assignedFiltersFromUrl = useMemo(

    () => parseMemberAssignedFiltersFromSearch(searchParams),

    [searchKey, searchParams]

  );

  const todayGroupFilter = useMemo(

    () => parseTodayGroupFilter(searchParams),

    [searchKey, searchParams]

  );



  const [tasks, setTasks] = useState<Tache[]>([]);

  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [createLoading, setCreateLoading] = useState(false);

  const [createError, setCreateError] = useState('');

  const [createCtx, setCreateCtx] =

    useState<MemberAssignedTaskCreateContext | null>(null);

  const [expandTodoGroup, setExpandTodoGroup] = useState(false);



  const userId = user?.id_utilisateur ?? Number(user?.id);



  const loadTasks = useCallback(async () => {

    setLoading(true);

    try {

      const data = await taskService.getMyTasks();

      setTasks(data);

    } catch (e) {

      console.error(e);

      setTasks([]);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    void loadTasks();

  }, [loadTasks]);



  useEffect(() => {

    const onRefresh = () => void loadTasks();

    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);

    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);

  }, [loadTasks]);



  const viewTasks = useMemo(

    () => filterByMemberView(tasks, activeView, userId),

    [tasks, activeView, userId]

  );



  const handlePriorityChange = useCallback(
    async (t: Tache, priority: TaskPriority) => {
      const previous = t.priorite_t;
      setTasks((prev) =>
        prev.map((x) =>
          x.id_tache === t.id_tache ? { ...x, priorite_t: priority } : x
        )
      );
      try {
        await taskService.update(String(t.id_tache), { priorite_t: priority });
      } catch (err) {
        console.error(err);
        setTasks((prev) =>
          prev.map((x) =>
            x.id_tache === t.id_tache ? { ...x, priorite_t: previous } : x
          )
        );
      }
    },
    []
  );

  const toggleCheck = async (t: Tache, e: React.MouseEvent) => {

    e.stopPropagation();

    const isDone = normalizeTaskStatutKey(t.statut_t) === 'terminee';

    const nextStatus = isDone ? TaskStatus.TODO : TaskStatus.DONE;

    try {

      await taskService.updateStatus(String(t.id_tache), nextStatus);

      setTasks((prev) =>

        prev.map((x) =>

          x.id_tache === t.id_tache ? { ...x, statut_t: nextStatus } : x

        )

      );

      dispatchWorkspaceRefresh();

    } catch (err) {

      console.error(err);

    }

  };



  const handleOpenAddTask = useCallback(async () => {

    setCreateError('');

    if (!userId || !Number.isFinite(userId)) {

      setCreateError('Session invalide. Reconnectez-vous.');

      setCreateModalOpen(true);

      return;

    }

    const resolved = await resolveMemberAssignedTaskCreateContext(viewTasks);

    if ('error' in resolved) {

      setCreateCtx(null);

      setCreateError(resolved.error);

      setCreateModalOpen(true);

      return;

    }

    setCreateCtx(resolved);

    setCreateError('');

    setCreateModalOpen(true);

  }, [viewTasks, userId]);



  const handleCreateTask = useCallback(

    async (payload: ClickUpTaskCreatePayload) => {

      if (!userId || !Number.isFinite(userId) || !createCtx) return;

      setCreateLoading(true);

      setCreateError('');

      try {

        const created = await taskService.create({

          nom_t: payload.title,

          title: payload.title,

          description_t: '',

          id_projet: createCtx.projectId,

          projectId: createCtx.projectId,

          id_list: createCtx.listId,

          listId: createCtx.listId,

          id_sprint: createCtx.sprintId,

          sprintId: createCtx.sprintId,

          assigne_a: userId,

          assigneeId: userId,

          date_debut_t: isoFromDateInput(payload.startDate),

          startDate: payload.startDate,

          date_limite_t: isoFromDateInput(payload.endDate),

          dueDate: isoFromDateInput(payload.endDate),

          endDate: payload.endDate,

          statut_t: 'todo',

          status: TaskStatus.TODO,

          priorite_t: payload.priority ?? TaskPriority.MEDIUM,

        });

        setTasks((prev) => {

          const without = prev.filter((t) => t.id_tache !== created.id_tache);

          return [created, ...without];

        });

        setCreateModalOpen(false);

        setCreateCtx(null);

        setExpandTodoGroup(true);

        dispatchWorkspaceRefresh();

      } catch (err: unknown) {

        const ax = err as { response?: { data?: { message?: string } } };

        const raw =

          ax?.response?.data?.message || 'Impossible de créer la tâche.';

        setCreateError(mapTaskCreateErrorMessage(raw));

      } finally {

        setCreateLoading(false);

      }

    },

    [userId, createCtx]

  );



  const todayTasks = useMemo(

    () => filterTasksAssignedToMember(tasks, userId),

    [tasks, userId]

  );



  if (activeView === 'today') {

    return (

      <MemberTodayOverdue

        tasks={todayTasks}

        loading={loading}

        userId={userId}

        expandGroup={todayGroupFilter}

      />

    );

  }



  return (

    <>

      <MemberAssignedTasksView

        tasks={viewTasks}

        loading={loading}

        onToggleCheck={toggleCheck}

        initialFilters={assignedFiltersFromUrl}

        onAddTask={() => void handleOpenAddTask()}

        onPriorityChange={handlePriorityChange}

        expandTodoGroup={expandTodoGroup}

        onTodoGroupExpanded={() => setExpandTodoGroup(false)}

      />

      <ClickUpTaskNameModal

        open={createModalOpen}

        listLabel={createCtx?.listLabel}

        loading={createLoading}

        showAssigneePicker={false}

        memberMode

        externalError={createError}

        onClearExternalError={() => setCreateError('')}

        onSubmit={(payload) => {
          if (!createCtx) return;
          void handleCreateTask(payload);
        }}

        onCancel={() => {

          if (createLoading) return;

          setCreateModalOpen(false);

          setCreateCtx(null);

          setCreateError('');

        }}

      />

    </>

  );

};



export default MemberMyTasks;

