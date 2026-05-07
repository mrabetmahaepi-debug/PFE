import React from 'react';
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
  MessageSquare,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SidebarItem from './SidebarItem';

interface SidebarProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
  isMobileOpen?: boolean;
  closeMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, toggleCollapsed, isMobileOpen, closeMobile }) => {
  const { user, logout, hasPermission } = useAuth();
  const roleName = typeof user?.role === 'object' ? user.role?.nom : user?.role;
  const isSuperAdmin = (roleName?.toString() || '').trim().toUpperCase() === 'SUPERADMIN';
  
  let navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Projects', icon: Briefcase, path: '/projects' },
    { name: 'Tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'Team', icon: Users, path: '/team' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  if (isSuperAdmin) {
    navItems = navItems.filter(item => item.name !== 'Projects' && item.name !== 'Tasks');
  }

  if (roleName?.toString().trim().toUpperCase() === 'SUPERADMIN' || roleName?.toString().trim().toUpperCase() === 'ADMIN') {
    const extraItems = [];
    if (roleName?.toString().trim().toUpperCase() === 'SUPERADMIN') {
      extraItems.push({ name: 'Enterprises', icon: Building2, path: '/enterprises' });
      extraItems.push({ name: 'Approvals', icon: Mail, path: '/approvals' });
    }
    extraItems.push({ name: 'Messages', icon: MessageSquare, path: '/messages' });
    const r = roleName?.toString().trim().toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN' || hasPermission('TEAM_MANAGE_ROLES')) {
      extraItems.push({ name: 'Permissions', icon: Lock, path: '/permissions' });
    }
    
    const settingsIndex = navItems.findIndex(item => item.name === 'Settings');
    if (settingsIndex !== -1) {
      navItems.splice(settingsIndex, 0, ...extraItems);
    } else {
      navItems.push(...extraItems);
    }
  }

  const getInitials = (user: any) => {
    if (!user) return '??';
    return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase();
  };

  return (
    <>
      {isMobileOpen && <button className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={closeMobile} aria-label="Close menu overlay" />}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen border-r border-slate-200 bg-[#F9FAFB] transition-all duration-200 ${
          collapsed ? 'w-[88px]' : 'w-[268px]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
      <div className="flex h-full w-full flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="text-base font-semibold text-slate-900">{isSuperAdmin ? 'SuperAdmin' : 'ProManager'}</p>
              <p className="text-xs text-slate-500">Project Workspace</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCollapsed}
              className="hidden rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 lg:inline-flex"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button onClick={closeMobile} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 lg:hidden">
              <X size={16} />
            </button>
          </div>
        </div>

      <div className="flex flex-1 flex-col">
        {!isSuperAdmin && hasPermission('PROJECT_CREATE') && (
          <button className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-[#5B5FEF]/20 bg-[#5B5FEF] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#4E53DD]">
            <span className="text-base leading-none">+</span>
            {!collapsed ? <span>New Project</span> : null}
          </button>
        )}

        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <SidebarItem
              key={item.name}
              to={item.path}
              label={item.name}
              icon={item.icon}
              collapsed={collapsed}
              onClick={closeMobile}
            />
          ))}
        </nav>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        {!collapsed && user && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-700">
              {getInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{user.prenom} {user.nom}</p>
              <p className="truncate text-xs text-slate-500">{typeof user.role === 'object' ? user.role?.nom : (user.role || 'Member')}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        )}
        {collapsed && (
          <button onClick={logout} className="mx-auto flex rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100" title="Logout">
            <LogOut size={16} />
          </button>
        )}
      </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
