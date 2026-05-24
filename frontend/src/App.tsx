import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionRoute from './components/PermissionRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import TasksRoute from './components/TasksRoute';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Approvals from './pages/Approvals';
import Enterprises from './pages/Enterprises';
import InboxRoute from './components/InboxRoute';
import Permissions from './pages/Permissions';
import ProjectAccess from './pages/ProjectAccess';
import Workspace from './pages/Workspace';
import Docs from './pages/Docs';
import TaskDetailsPage from './pages/TaskDetail';
import ListViewPage from './pages/ListViewPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvitation from './pages/AcceptInvitation';
import InvitationSetupPassword from './pages/InvitationSetupPassword';
import Invite from './pages/Invite';
import AdminRecommendationsRoute from './components/AdminRecommendationsRoute';
import ProjectEquipePage from './pages/ProjectEquipePage';


import ProjectDetail from './pages/ProjectDetail';
import EnterpriseDetail from './pages/EnterpriseDetail';
import UserDetail from './pages/UserDetail';
import ActivityLogs from './pages/ActivityLogs';
import { useAuth } from './hooks/useAuth';
import { isSuperAdmin, isEnterpriseAdmin, isGlobalMember } from './lib/permissions';
import MemberMonEspaceRedirect from './components/MemberMonEspaceRedirect';
import { appPaths } from './lib/workspaceRoutes';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const NoSuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (isSuperAdmin(user)) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

/** Tenant Admin: /workspace is not used; redirect home (route kept for other roles). */
const AdminWorkspaceRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <span>Chargement…</span>
      </div>
    );
  }
  if (isEnterpriseAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const IndexRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <span>Chargement…</span>
      </div>
    );
  }
  return <Navigate to={appPaths.home} replace />;
};

/** Activity logs are global; backend requires SuperAdmin. */
const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!isSuperAdmin(user)) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invitations/accept/:token" element={<AcceptInvitation />} />
          <Route
            path="/invitations/setup-password/:token"
            element={<InvitationSetupPassword />}
          />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route path="/invitation/:token" element={<AcceptInvitation />} />

          {/* Protected Dashboard Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<IndexRedirect />} />
            <Route path="home" element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="mon-espace"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']}>
                  <NoSuperAdminRoute>
                    <MemberMonEspaceRedirect />
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route path="inbox" element={<InboxRoute />} />
            <Route path="messages" element={<Navigate to="/inbox" replace />} />
            <Route path="docs" element={<Docs />} />
            <Route
              path="projects"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']}>
                  <NoSuperAdminRoute>
                    <RouteErrorBoundary pageLabel="la liste des projets">
                      <Projects />
                    </RouteErrorBoundary>
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route
              path="lists/:listId"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']}>
                  <NoSuperAdminRoute>
                    <RouteErrorBoundary pageLabel="la liste">
                      <ListViewPage />
                    </RouteErrorBoundary>
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route
              path="spaces/*"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']}>
                  <NoSuperAdminRoute>
                    <AdminWorkspaceRedirect>
                      <Workspace />
                    </AdminWorkspaceRedirect>
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route path="workspace" element={<Navigate to="/spaces" replace />} />
            <Route
              path="tasks/:taskId"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW', 'TASK_VIEW', 'TASK_VIEW_ALL']}>
                  <NoSuperAdminRoute>
                    <RouteErrorBoundary pageLabel="la tâche">
                      <TaskDetailsPage />
                    </RouteErrorBoundary>
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route
              path="projects/:id"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']}>
                  <RouteErrorBoundary pageLabel="le détail du projet">
                    <ProjectDetail />
                  </RouteErrorBoundary>
                </PermissionRoute>
              }
            />
            <Route
              path="activities"
              element={
                <SuperAdminRoute>
                  <ActivityLogs />
                </SuperAdminRoute>
              }
            />
            <Route
              path="tasks"
              element={
                <NoSuperAdminRoute>
                  <TasksRoute />
                </NoSuperAdminRoute>
              }
            />
            <Route
              path="team"
              element={
                <PermissionRoute permission="TEAM_VIEW">
                  <Team />
                </PermissionRoute>
              }
            />
            <Route path="team/:id" element={<UserDetail />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route
              path="approvals"
              element={
                <PermissionRoute permission="SYSTEM_APPROVE_ADMINS">
                  <Approvals />
                </PermissionRoute>
              }
            />
            <Route
              path="enterprises"
              element={
                <PermissionRoute permission="SYSTEM_MANAGE_ENTERPRISES">
                  <Enterprises />
                </PermissionRoute>
              }
            />
            <Route
              path="enterprises/:id"
              element={
                <PermissionRoute permission="SYSTEM_MANAGE_ENTERPRISES">
                  <EnterpriseDetail />
                </PermissionRoute>
              }
            />
            <Route
              path="recommendations"
              element={
                <NoSuperAdminRoute>
                  <AdminRecommendationsRoute />
                </NoSuperAdminRoute>
              }
            />
            <Route
              path="permissions"
              element={
                <PermissionRoute permission="TEAM_MANAGE_ROLES">
                  <NoSuperAdminRoute>
                    <Permissions />
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route
              path="invite"
              element={
                <PermissionRoute any={['TEAM_INVITE', 'TEAM_MANAGE_ROLES']}>
                  <NoSuperAdminRoute>
                    <Invite />
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route
              path="access-management"
              element={
                <PermissionRoute permission="PROJECT_MANAGE_ACCESS">
                  <NoSuperAdminRoute>
                    <ProjectAccess />
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route
              path="equipe/:projectId?"
              element={
                <PermissionRoute any={['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']}>
                  <NoSuperAdminRoute>
                    <RouteErrorBoundary pageLabel="l'équipe projet">
                      <ProjectEquipePage />
                    </RouteErrorBoundary>
                  </NoSuperAdminRoute>
                </PermissionRoute>
              }
            />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
