import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Inbox,
  FileText,
  LayoutDashboard,
  Film,
  Clock,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Lock,
  Mail,
  MessageSquare,
  UserPlus,
  Briefcase,
  Users,
  Settings,
  Plus,
  ChevronDown,
  ListTodo,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import UserAvatar from './UserAvatar';
import { resolveProfilePhotoUrl, getUserInitials } from '../lib/profilePhoto';
import { usePermission } from '../hooks/usePermission';
import { isSuperAdmin, isEnterpriseAdmin } from '../lib/permissions';
import { spaceService } from '../services/space.service';
import type { SpaceTreeNode } from '../types/hierarchy';
import ClickUpSidebarTree from './ClickUpSidebarTree';
import SidebarCorbeille from './SidebarCorbeille';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';
import {
  appPaths,
  parseListViewPath,
  parseTaskPath,
  parseWorkspacePath,
} from '../lib/workspaceRoutes';

interface SidebarProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

interface PrimaryNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  end?: boolean;
  permission?: string;
  anyPermissions?: string[];
  hideForSuperAdmin?: boolean;
}

interface MoreNavItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
  anyPermissions?: string[];
  hideForSuperAdmin?: boolean;
  hideForAdmin?: boolean;
  requiresEnterpriseAdmin?: boolean;
}

const PRIMARY_NAV: PrimaryNavItem[] = [
  { id: 'home', label: 'Home', icon: <Home size={16} />, path: appPaths.home, end: true },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: <Inbox size={16} />,
    path: appPaths.inbox,
    permission: 'MESSAGING_USE',
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: <FileText size={16} />,
    path: appPaths.docs,
    anyPermissions: ['PROJECT_VIEW_ALL', 'WORKSPACE_VIEW'],
    hideForSuperAdmin: true,
  },
  {
    id: 'dashboards',
    label: 'Dashboard',
    icon: <LayoutDashboard size={16} />,
    path: appPaths.dashboard,
  },
  { id: 'clips', label: 'Clips', icon: <Film size={16} /> },
  { id: 'timesheets', label: 'Timesheets', icon: <Clock size={16} /> },
];

const MORE_ITEMS: MoreNavItem[] = [
  {
    id: 'tasks',
    name: 'Mes tâches',
    icon: <ListTodo size={16} />,
    path: appPaths.spaces,
    anyPermissions: ['PROJECT_VIEW_ALL', 'WORKSPACE_VIEW'],
    hideForSuperAdmin: true,
    hideForAdmin: true,
  },
  {
    id: 'projects',
    name: 'Projets',
    icon: <Briefcase size={16} />,
    path: appPaths.projects,
    anyPermissions: ['PROJECT_VIEW_ALL', 'WORKSPACE_VIEW'],
    hideForSuperAdmin: true,
  },
  {
    id: 'messages',
    name: 'Messagerie',
    icon: <MessageSquare size={16} />,
    path: appPaths.inbox,
    permission: 'MESSAGING_USE',
  },
  {
    id: 'team',
    name: 'Équipe',
    icon: <Users size={16} />,
    path: appPaths.team,
    permission: 'TEAM_VIEW',
    requiresEnterpriseAdmin: true,
  },
  {
    id: 'enterprises',
    name: 'Entreprises',
    icon: <Building2 size={16} />,
    path: '/enterprises',
    permission: 'SYSTEM_MANAGE_ENTERPRISES',
  },
  {
    id: 'approvals',
    name: 'Approbations',
    icon: <Mail size={16} />,
    path: '/approvals',
    permission: 'SYSTEM_APPROVE_ADMINS',
  },
  {
    id: 'permissions',
    name: 'Permissions',
    icon: <Lock size={16} />,
    path: '/permissions',
    permission: 'TEAM_MANAGE_ROLES',
    hideForSuperAdmin: true,
  },
  {
    id: 'invite',
    name: 'Inviter',
    icon: <UserPlus size={16} />,
    path: '/invite',
    anyPermissions: ['TEAM_INVITE', 'TEAM_MANAGE_ROLES'],
    hideForSuperAdmin: true,
  },
  {
    id: 'settings',
    name: 'Paramètres',
    icon: <Settings size={16} />,
    path: appPaths.settings,
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, toggleCollapsed }) => {
  const { user, logout } = useAuth();
  const { can, canAny } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const superAdmin = isSuperAdmin(user);

  const [spaces, setSpaces] = useState<SpaceTreeNode[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);

  const filterPrimary = useCallback(
    (item: PrimaryNavItem) => {
      if (item.hideForSuperAdmin && superAdmin) return false;
      if (item.permission && !can(item.permission)) return false;
      if (item.anyPermissions && !canAny(item.anyPermissions)) return false;
      return true;
    },
    [superAdmin, can, canAny]
  );

  const filterMore = useCallback(
    (item: MoreNavItem) => {
      if (item.hideForSuperAdmin && superAdmin) return false;
      if (item.hideForAdmin && isEnterpriseAdmin(user)) return false;
      if (item.requiresEnterpriseAdmin && !superAdmin && !isEnterpriseAdmin(user))
        return false;
      if (item.permission && !can(item.permission)) return false;
      if (item.anyPermissions && !canAny(item.anyPermissions)) return false;
      return true;
    },
    [superAdmin, user, can, canAny]
  );

  const primaryNav = useMemo(() => PRIMARY_NAV.filter(filterPrimary), [filterPrimary]);
  const moreItems = useMemo(() => MORE_ITEMS.filter(filterMore), [filterMore]);

  const showSpacesSection =
    !superAdmin && canAny(['PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']);

  const workspaceIds = useMemo(
    () => parseWorkspacePath(location.pathname),
    [location.pathname]
  );

  const activeSpaceId = workspaceIds.spaceId;
  const activeProjectId = workspaceIds.folderId;
  const activeListId =
    parseListViewPath(location.pathname) ?? workspaceIds.listId;
  const activeTaskId = useMemo(
    () => parseTaskPath(location.pathname),
    [location.pathname]
  );

  const loadSpaces = useCallback(() => {
    return spaceService
      .getHierarchy()
      .then(({ spaces: loaded }) => {
        setSpaces(Array.isArray(loaded) ? loaded : []);
      })
      .catch(() => setSpaces([]));
  }, []);

  useEffect(() => {
    if (!showSpacesSection) return;
    void loadSpaces();
  }, [showSpacesSection, loadSpaces]);

  useEffect(() => {
    if (
      !showSpacesSection ||
      (!location.pathname.startsWith('/spaces') &&
        !location.pathname.startsWith('/lists/') &&
        !location.pathname.startsWith('/tasks/'))
    ) {
      return;
    }
    void loadSpaces();
  }, [location.pathname, location.search, showSpacesSection, loadSpaces]);

  const roleName = typeof user?.role === 'object' ? user.role?.nom : user?.role;

  const isMoreActive = moreItems.some((item) => location.pathname === item.path);

  const renderPrimaryRow = (item: PrimaryNavItem) => {
    const rowClass = (active: boolean) =>
      cn(cu.navItem, active && cu.navItemActive);

    if (item.path) {
      return (
        <NavLink
          key={item.id}
          to={item.path}
          end={item.end}
          className={({ isActive }) => rowClass(isActive)}
          title={collapsed ? item.label : undefined}
        >
          <span className={cu.navIcon}>{item.icon}</span>
          {!collapsed && <span className={cu.navLabel}>{item.label}</span>}
        </NavLink>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className={cn(cu.navItem, 'cursor-default opacity-60')}
        title={collapsed ? item.label : `${item.label} (bientôt)`}
        disabled
      >
        <span className={cu.navIcon}>{item.icon}</span>
        {!collapsed && <span className={cu.navLabel}>{item.label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        cu.sidebar,
        collapsed ? cu.sidebarCollapsed : cu.sidebarExpanded
      )}
    >
      <div
        className={cn(
          cu.sidebarHeader,
          collapsed && 'justify-center px-2 py-3'
        )}
      >
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-cu-text">
            GestionPro
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            cu.btnGhost,
            'h-7 w-7 shrink-0 text-cu-text-muted hover:text-cu-text',
            !collapsed && 'ml-auto'
          )}
          title={collapsed ? 'Développer' : 'Réduire'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className={cu.sidebarScroll}>
        <nav className="flex flex-col gap-px px-2 pb-2">
          {!collapsed ? (
            <>
              {primaryNav.map(renderPrimaryRow)}

              {moreItems.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    className={cn(cu.navItem, (moreOpen || isMoreActive) && cu.navItemActive)}
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                  >
                    <span className={cu.navIcon}>
                      <MoreHorizontal size={16} />
                    </span>
                    <span className={cu.navLabel}>More</span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        'ml-auto text-cu-text-muted transition-transform',
                        moreOpen && 'rotate-180'
                      )}
                    />
                  </button>
                  {moreOpen && (
                    <div className="mt-px flex flex-col gap-px pl-2">
                      {moreItems.map((item) => (
                        <NavLink
                          key={item.id}
                          to={item.path}
                          className={({ isActive }) =>
                            cn(cu.navItem, 'pl-[18px] text-xs', isActive && cu.navItemActive)
                          }
                          onClick={() => setMoreOpen(false)}
                        >
                          <span className={cu.navIcon}>{item.icon}</span>
                          <span className={cu.navLabel}>{item.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            primaryNav
              .filter((item) => item.path)
              .map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path!}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(cu.navItem, 'justify-center px-2', isActive && cu.navItemActive)
                  }
                  title={item.label}
                >
                  <span className={cu.navIcon}>{item.icon}</span>
                </NavLink>
              ))
          )}
        </nav>

        {!collapsed && showSpacesSection && (
          <>
            <div className={cu.divider} />
            <section className="px-2 pb-2">
              <div className="mb-1 flex items-center justify-between px-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cu-text-muted">
                  SPACES
                </span>
                <button
                  type="button"
                  className={cn(
                    cu.btnGhost,
                    'h-6 w-6 p-0 text-cu-text-muted hover:bg-[#F4F4F6] hover:text-cu-text'
                  )}
                  onClick={() => navigate(`${appPaths.spaces}?create=space`)}
                  title="New Space"
                  aria-label="New Space"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
              <ClickUpSidebarTree
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                activeProjectId={activeProjectId}
                activeListId={activeListId}
                activeTaskId={activeTaskId}
                onRefresh={loadSpaces}
                canCreateProject={can('PROJECT_CREATE') || isEnterpriseAdmin(user)}
                canCreateList={can('LIST_MANAGE')}
                canCreateTask={can('TASK_CREATE') || isEnterpriseAdmin(user)}
              />
              <SidebarCorbeille onRefreshTree={loadSpaces} />
            </section>
          </>
        )}

        {!collapsed && superAdmin && (
          <>
            <div className={cu.divider} />
            <section className="px-2 pb-2">
              <div className="mb-1 px-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cu-text-muted">
                  Administration
                </span>
              </div>
              {moreItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(cu.navItem, isActive && cu.navItemActive)
                  }
                >
                  <span className={cu.navIcon}>{item.icon}</span>
                  <span className={cu.navLabel}>{item.name}</span>
                </NavLink>
              ))}
              <SidebarCorbeille onRefreshTree={loadSpaces} />
            </section>
          </>
        )}
      </div>

      <div className={cu.sidebarFooter}>
        {!collapsed && user && (
          <div className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-cu-hover">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cu-primary text-[11px] font-bold text-white">
              {resolveProfilePhotoUrl(user.photoUrl) ? (
                <UserAvatar
                  user={user}
                  imgClassName="h-full w-full rounded-full object-cover"
                />
              ) : (
                getUserInitials(user)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-xs font-semibold text-cu-text">
                {user.prenom} {user.nom}
              </p>
              <p className="m-0 text-[11px] text-cu-text-muted">{roleName || 'Membre'}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className={cn(cu.btnGhost, 'text-cu-text-muted hover:bg-red-50 hover:text-red-500')}
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={logout}
            className={cn(
              cu.btnGhost,
              'mx-auto w-full justify-center py-2 text-cu-text-muted hover:text-red-500'
            )}
            title="Déconnexion"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
