import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CalendarClock, ChevronDown, ListTodo, User } from 'lucide-react';
import { taskService } from '../services/task.service';
import {
  MEMBER_TASKS_VIEWS,
  countTodayAndOverdue,
  isMemberTasksViewActive,
} from '../lib/memberTasksViews';
import { WORKSPACE_REFRESH_EVENT } from '../lib/workspaceEvents';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';
import './MemberTasksSidebarNav.css';

interface MemberTasksSidebarNavProps {
  collapsed: boolean;
}

const MemberTasksSidebarNav: React.FC<MemberTasksSidebarNavProps> = ({ collapsed }) => {
  const location = useLocation();
  const [todayCount, setTodayCount] = useState(0);
  const onTasksRoute = location.pathname === '/tasks';

  const [expanded, setExpanded] = useState(() => onTasksRoute);

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

  useEffect(() => {
    if (onTasksRoute) setExpanded(true);
  }, [onTasksRoute]);

  if (collapsed) {
    return (
      <NavLink
        to="/tasks?view=assigned"
        className={({ isActive }) =>
          cn(
            cu.navItem,
            'justify-center px-2',
            (isActive || onTasksRoute) && cu.navItemActive
          )
        }
        title="Mes tâches"
      >
        <span className={cu.navIcon}>
          <ListTodo size={16} />
        </span>
      </NavLink>
    );
  }

  return (
    <div className="member-tasks-sidebar" aria-label="Mes tâches">
      <button
        type="button"
        className={cn(
          'member-tasks-sidebar-parent',
          onTasksRoute && 'is-route-active',
          expanded && 'is-expanded'
        )}
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls="member-tasks-sidebar-children"
      >
        <span className={cu.navIcon}>
          <ListTodo size={16} className="member-tasks-sidebar-icon" aria-hidden />
        </span>
        <span className="member-tasks-sidebar-parent-label">Mes tâches</span>
        <ChevronDown
          size={14}
          className={cn(
            'member-tasks-sidebar-chevron',
            expanded && 'is-open'
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <ul
          id="member-tasks-sidebar-children"
          className="member-tasks-sidebar-children"
          role="list"
        >
          {MEMBER_TASKS_VIEWS.map((v) => {
            const isActive = isMemberTasksViewActive(
              location.pathname,
              location.search,
              v.id
            );
            const showBadge = v.id === 'today';
            const LinkIcon = v.id === 'assigned' ? User : CalendarClock;

            return (
              <li key={v.id}>
                <Link
                  to={v.path}
                  className={cn(
                    'member-tasks-sidebar-link',
                    isActive && 'is-active'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="member-tasks-sidebar-link-icon" aria-hidden>
                    <LinkIcon size={14} strokeWidth={2} />
                  </span>
                  <span className="member-tasks-sidebar-link-label">{v.label}</span>
                  {showBadge ? (
                    <span
                      className="member-tasks-sidebar-badge"
                      aria-label={`${todayCount} tâche${todayCount !== 1 ? 's' : ''}`}
                    >
                      {todayCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MemberTasksSidebarNav;
