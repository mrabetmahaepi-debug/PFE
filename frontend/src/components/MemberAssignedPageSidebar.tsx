import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import { taskService } from '../services/task.service';
import {
  MEMBER_TASKS_VIEWS,
  countTodayAndOverdue,
  parseMemberTasksView,
} from '../lib/memberTasksViews';
import { WORKSPACE_REFRESH_EVENT } from '../lib/workspaceEvents';
import './MemberAssignedPageSidebar.css';

const MemberAssignedPageSidebar: React.FC = () => {
  const location = useLocation();
  const [todayCount, setTodayCount] = useState(0);

  const activeView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return parseMemberTasksView(params.get('view'));
  }, [location.search]);

  const loadCount = useCallback(async () => {
    try {
      const data = await taskService.getMyTasks();
      setTodayCount(countTodayAndOverdue(data));
    } catch {
      setTodayCount(0);
    }
  }, []);

  useEffect(() => {
    void loadCount();
  }, [loadCount, location.pathname, location.search]);

  useEffect(() => {
    const onRefresh = () => void loadCount();
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
  }, [loadCount]);

  return (
    <aside className="member-assigned-page-sidebar" aria-label="Mes tâches">
      <div className="member-assigned-page-sidebar-head">
        <ListTodo size={18} className="member-assigned-page-sidebar-icon" aria-hidden />
        <span className="member-assigned-page-sidebar-title">Mes tâches</span>
      </div>
      <ul className="member-assigned-page-sidebar-list" role="list">
        {MEMBER_TASKS_VIEWS.map((v) => {
          const isActive =
            location.pathname === '/tasks' && activeView === v.id;
          const showBadge = v.id === 'today';
          return (
            <li key={v.id}>
              <NavLink
                to={v.path}
                className={`member-assigned-page-sidebar-link ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {v.id === 'assigned' && isActive ? (
                  <span className="member-assigned-page-sidebar-avatar" aria-hidden>
                    N
                  </span>
                ) : null}
                <span className="member-assigned-page-sidebar-label">{v.label}</span>
                {showBadge ? (
                  <span
                    className="member-assigned-page-sidebar-badge"
                    aria-label={`${todayCount} tâche${todayCount !== 1 ? 's' : ''}`}
                  >
                    {todayCount}
                  </span>
                ) : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default MemberAssignedPageSidebar;
