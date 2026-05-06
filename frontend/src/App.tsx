import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Approvals from './pages/Approvals';
import Enterprises from './pages/Enterprises';
import Messages from './pages/Messages';
import Permissions from './pages/Permissions';
import ProjectAccess from './pages/ProjectAccess';
import Login from './pages/Login';
import Register from './pages/Register';


import ProjectDetail from './pages/ProjectDetail';
import EnterpriseDetail from './pages/EnterpriseDetail';
import UserDetail from './pages/UserDetail';
import ActivityLogs from './pages/ActivityLogs';
import { useAuth } from './hooks/useAuth';

const NoSuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const roleName = typeof user?.role === 'object' ? user.role?.nom : user?.role;
  
  const r = roleName?.toString().trim().toUpperCase();
  if (r === 'SUPERADMIN') {
    return <Navigate to="/" replace />;
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
          
          {/* Protected Dashboard Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
             <Route path="projects" element={<NoSuperAdminRoute><Projects /></NoSuperAdminRoute>} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="activities" element={<ActivityLogs />} />
            <Route path="tasks" element={<NoSuperAdminRoute><Tasks /></NoSuperAdminRoute>} />
            <Route path="team" element={<Team />} />
            <Route path="team/:id" element={<UserDetail />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="messages" element={<Messages />} />
            <Route path="enterprises" element={<Enterprises />} />
            <Route path="enterprises/:id" element={<EnterpriseDetail />} />
            <Route path="permissions" element={<Permissions />} />
            <Route path="access-management" element={<NoSuperAdminRoute><ProjectAccess /></NoSuperAdminRoute>} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
