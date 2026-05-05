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
import ActivityLogs from './pages/ActivityLogs';

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
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="activities" element={<ActivityLogs />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="team" element={<Team />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="messages" element={<Messages />} />
            <Route path="enterprises" element={<Enterprises />} />
            <Route path="permissions" element={<Permissions />} />
            <Route path="access-management" element={<ProjectAccess />} />
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
