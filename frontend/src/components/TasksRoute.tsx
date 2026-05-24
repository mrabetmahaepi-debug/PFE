import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { isGlobalMember } from '../lib/permissions';
import PermissionRoute from './PermissionRoute';
import Tasks from '../pages/Tasks';
import MemberMyTasks from '../pages/MemberMyTasks';

/** Membre → page My Tasks ClickUp ; autres rôles → page Tâches existante. */
const TasksRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-state">
        <span>Chargement…</span>
      </div>
    );
  }

  if (isGlobalMember(user)) {
    return <MemberMyTasks />;
  }

  return (
    <PermissionRoute permission="TASK_VIEW_ALL">
      <Tasks />
    </PermissionRoute>
  );
};

export default TasksRoute;
