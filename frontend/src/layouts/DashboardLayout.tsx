import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';
import { isGlobalMember, isEnterpriseAdmin } from '../lib/permissions';
import { parseMemberTasksView } from '../lib/memberTasksViews';
import {
  MemberTopbarTitleProvider,
  useMemberTopbarTitle,
} from '../context/MemberTopbarTitleContext';

const DashboardLayoutInner: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { title: memberTopbarTitle } = useMemberTopbarTitle();
  const isDashboardHome =
    location.pathname === '/' ||
    location.pathname === '/dashboard' ||
    location.pathname === '/home';
  const isMemberDashboardHome = isGlobalMember(user) && isDashboardHome;
  const isAdminDashboardHome = isEnterpriseAdmin(user) && isDashboardHome;
  const isAdminRecommendationsPage =
    isEnterpriseAdmin(user) && location.pathname === '/recommendations';
  const isMemberListPage =
    isGlobalMember(user) && /^\/lists\/\d+\/?$/.test(location.pathname);
  const isMemberSpacesPage =
    isGlobalMember(user) && location.pathname.startsWith('/spaces');
  const isMemberWorkspaceNav =
    isGlobalMember(user) &&
    (isMemberListPage || isMemberSpacesPage || !!memberTopbarTitle);
  const isMemberMonEspaceRoute =
    isGlobalMember(user) &&
    (location.pathname === '/mon-espace' ||
      /^\/spaces\/\d+\/?$/.test(location.pathname));
  const isTeamPage =
    location.pathname === '/team' || location.pathname.startsWith('/team/');
  const isMemberTasksPage = location.pathname === '/tasks';
  const memberTasksView = parseMemberTasksView(
    new URLSearchParams(location.search).get('view')
  );
  const isMemberAssignedTasks =
    isGlobalMember(user) &&
    isMemberTasksPage &&
    memberTasksView === 'assigned';
  const isMemberTodayTasks =
    isGlobalMember(user) && isMemberTasksPage && memberTasksView === 'today';
  const isMemberInboxPage =
    isGlobalMember(user) && location.pathname === '/inbox';
  const isMemberSettingsPage =
    isGlobalMember(user) && location.pathname === '/settings';
  const isMemberTaskDetailPage =
    isGlobalMember(user) && /^\/tasks\/\d+\/?$/.test(location.pathname);

  return (
    <div
      className={cn(
        'layout-container coach-layout min-h-screen bg-cu-app font-sans',
        collapsed && 'sidebar-collapsed',
        isDashboardHome && !isMemberDashboardHome && 'coach-layout--dashboard',
        isMemberDashboardHome && 'coach-layout--member-space',
        isMemberMonEspaceRoute && 'coach-layout--member-space',
        isMemberWorkspaceNav && 'coach-layout--member-workspace',
        isTeamPage && 'coach-layout--team',
        isMemberAssignedTasks && 'coach-layout--member-assigned',
        isMemberTodayTasks && 'coach-layout--member-today',
        isMemberInboxPage && 'coach-layout--member-inbox',
        isMemberSettingsPage && 'coach-layout--member-settings',
        isMemberTaskDetailPage && 'coach-layout--member-task-detail'
      )}
    >
      <div className="coach-app-shell min-h-screen bg-cu-app transition-[margin-left] duration-300">
        <Sidebar
          collapsed={collapsed}
          toggleCollapsed={() => setCollapsed((v) => !v)}
        />

        <main className="main-content flex min-h-screen min-w-0 flex-1 flex-col bg-white">
          <Navbar />
          <div
            className={cn(
              'page-wrapper min-h-0 flex-1 overflow-x-hidden',
              isMemberMonEspaceRoute
                ? 'page-wrapper--member-mon-espace overflow-y-hidden'
                : 'overflow-y-auto',
              isMemberMonEspaceRoute ||
                isMemberDashboardHome ||
                isAdminDashboardHome ||
                isAdminRecommendationsPage ||
                isMemberTasksPage ||
                isMemberInboxPage ||
                isMemberSettingsPage ||
                isMemberTaskDetailPage ||
                isMemberWorkspaceNav
                ? 'bg-cu-app p-0'
                : isDashboardHome
                  ? 'bg-cu-app px-7 pb-8 pt-6'
                  : 'bg-white px-0 pb-8 pt-0'
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const DashboardLayout: React.FC = () => (
  <MemberTopbarTitleProvider>
    <DashboardLayoutInner />
  </MemberTopbarTitleProvider>
);

export default DashboardLayout;
