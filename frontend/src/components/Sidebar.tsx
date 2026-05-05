import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  CheckSquare, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Building2,
  Lock,
  Mail,
  Shield,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, toggleCollapsed }) => {
  const { user, logout, hasPermission } = useAuth();
  const roleName = typeof user?.role === 'object' ? user.role.nom : user?.role;
  const isSuperAdmin = roleName === 'SuperAdmin';
  
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Projets', icon: <Briefcase size={20} />, path: '/projects' },
    { name: 'Tâches', icon: <CheckSquare size={20} />, path: '/tasks' },
    { name: 'Équipe', icon: <Users size={20} />, path: '/team' },
    { name: 'Paramètres', icon: <Settings size={20} />, path: '/settings' },
  ];

  if (roleName === 'SuperAdmin' || roleName === 'Admin') {
    const extraItems = [];
    if (roleName === 'SuperAdmin') {
      extraItems.push({ name: 'Entreprises', icon: <Building2 size={20} />, path: '/enterprises' });
      extraItems.push({ name: 'Approbations', icon: <Mail size={20} />, path: '/approvals' });
      extraItems.push({ name: 'Accès Projets', icon: <Shield size={20} />, path: '/access-management' });
    }
    // Messagerie visible pour SuperAdmin ET Admin
    extraItems.push({ name: 'Messagerie', icon: <MessageSquare size={20} />, path: '/messages' });
    if (roleName === 'Admin' || roleName === 'SuperAdmin' || hasPermission('TEAM_MANAGE_ROLES')) {
      extraItems.push({ name: 'Permissions', icon: <Lock size={20} />, path: '/permissions' });
    }
    navItems.splice(4, 0, ...extraItems);
  }

  const getInitials = (user: any) => {
    if (!user) return '??';
    return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && isSuperAdmin && <span className="logo-text">SuperAdmin</span>}
        {!collapsed && !isSuperAdmin && <span className="logo-text">GestionPro</span>}
        <button onClick={toggleCollapsed} className="toggle-btn">
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <div className="sidebar-content">
        {!isSuperAdmin && hasPermission('PROJECT_CREATE') && (
          <button className="create-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            {!collapsed && <span>Nouveau Projet</span>}
          </button>
        )}

        <nav className="nav-menu">
          {navItems.map((item) => (
            <NavLink 
              key={item.name} 
              to={item.path} 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {!collapsed && <span className="label">{item.name}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        {!collapsed && user && (
          <div className="user-info">
            <div className="avatar">{getInitials(user)}</div>
            <div className="details">
              <p className="name">{user.prenom} {user.nom}</p>
              <p className="role">{typeof user.role === 'object' ? user.role.nom : (user.role || 'Membre')}</p>
            </div>
            <button onClick={logout} className="logout-btn" title="Déconnexion">
              <LogOut size={18} />
            </button>
          </div>
        )}
        {collapsed && (
          <button onClick={logout} className="logout-btn-collapsed" title="Déconnexion">
            <LogOut size={20} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
