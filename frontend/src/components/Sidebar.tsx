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
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import UserAvatar from './UserAvatar';
import { usePermission } from '../hooks/usePermission';
import { isSuperAdmin, isEnterpriseAdmin, isGlobalMember } from '../lib/permissions';
import { spaceService } from '../services/space.service';
import type { SpaceTreeNode } from '../types/hierarchy';
import ClickUpSidebarTree from './ClickUpSidebarTree';
import MemberSpaceSidebarTree from './MemberSpaceSidebarTree';
import './SidebarMemberDark.css';
import './SidebarAdminBrown.css';
import './SidebarInboxBadge.css';
import SidebarCorbeille from './SidebarCorbeille';
import MemberSidebarCorbeille from './MemberSidebarCorbeille';
import MemberTasksSidebarNav from './MemberTasksSidebarNav';
import MemberEquipeSidebarNav from './MemberEquipeSidebarNav';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';
import {
  appPaths,
  parseListViewPath,
  parseTaskPath,
  parseWorkspacePath,
} from '../lib/workspaceRoutes';
import {
  TASK_DELETED_EVENT,
  TASK_RENAMED_EVENT,
  WORKSPACE_REFRESH_EVENT,
  PROJECTS_UPDATED_EVENT,
  PROJECT_TEAM_CHANGED_EVENT,
  type TaskDeletedDetail,
  type TaskRenamedDetail,
} from '../lib/workspaceEvents';
import { resolveUserSidebarPoste } from '../lib/resolveUserSidebarPoste';
import { useInboxUnreadCount } from '../hooks/useInboxUnreadCount';
import { markAllInboxNotificationsAsRead } from '../lib/markAllInboxNotificationsRead';
import {
  patchTaskNameInSpaces,
  removeSubtaskFromSpaces,
} from '../lib/patchTaskNameInSpaces';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

interface PrimaryNavItem {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  path?: string;
  end?: boolean;
  permission?: string;
  anyPermissions?: string[];
  hideForSuperAdmin?: boolean;
  /** Masqué pour l'admin entreprise (tenant ADMIN) */
  hideForEnterpriseAdmin?: boolean;
  /** Masqué pour le rôle global Membre uniquement */
  hideForMember?: boolean;
  /** Libellé affiché pour le rôle Membre (sinon `labelKey`) */
  memberLabelKey?: string;
  /** Libellé affiché pour l'admin entreprise (sinon `labelKey`) */
  adminLabelKey?: string;
  /** Inbox notifications : visible pour Membre sans MESSAGING_USE */
  memberNotificationsInbox?: boolean;
  /** Inbox notifications : badge + page notifications pour admin entreprise */
  adminNotificationsInbox?: boolean;
}

interface MoreNavItem {
  id: string;
  nameKey: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
  anyPermissions?: string[];
  hideForSuperAdmin?: boolean;
  hideForAdmin?: boolean;
  hideForMember?: boolean;
  requiresEnterpriseAdmin?: boolean;
  /** Libellé affiché pour l'admin entreprise (sinon `nameKey`) */
  adminLabelKey?: string;
}

const PRIMARY_NAV: PrimaryNavItem[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    memberLabelKey: 'nav.dashboard',
    icon: <Home size={16} />,
    path: appPaths.home,
    end: true,
    hideForEnterpriseAdmin: true,
  },
  {
    id: 'inbox',
    labelKey: 'nav.inbox',
    memberLabelKey: 'nav.inbox',
    adminLabelKey: 'nav.inbox',
    icon: <Inbox size={16} />,
    path: appPaths.inbox,
    permission: 'MESSAGING_USE',
    memberNotificationsInbox: true,
    adminNotificationsInbox: true,
  },
  {
    id: 'docs',
    labelKey: 'nav.docs',
    icon: <FileText size={16} />,
    path: appPaths.docs,
    anyPermissions: ['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW'],
    hideForSuperAdmin: true,
    hideForMember: true,
    hideForEnterpriseAdmin: true,
  },
  {
    id: 'dashboards',
    labelKey: 'nav.dashboard',
    icon: <LayoutDashboard size={16} />,
    path: appPaths.dashboard,
    hideForMember: true,
  },
  {
    id: 'clips',
    labelKey: 'nav.clips',
    icon: <Film size={16} />,
    hideForMember: true,
    hideForEnterpriseAdmin: true,
  },
  {
    id: 'timesheets',
    labelKey: 'nav.timesheets',
    icon: <Clock size={16} />,
    hideForMember: true,
    hideForEnterpriseAdmin: true,
  },
];

const MORE_ITEMS: MoreNavItem[] = [
  {
    id: 'tasks',
    nameKey: 'nav.myTasks',
    icon: <ListTodo size={16} />,
    path: '/tasks',
    hideForSuperAdmin: true,
    hideForAdmin: true,
  },
  {
    id: 'projects',
    nameKey: 'nav.projects',
    icon: <Briefcase size={16} />,
    path: appPaths.projects,
    requiresEnterpriseAdmin: true,
  },
  {
    id: 'messages',
    nameKey: 'nav.messaging',
    icon: <MessageSquare size={16} />,
    path: appPaths.inbox,
    permission: 'MESSAGING_USE',
    hideForMember: true,
    hideForAdmin: true,
  },
  {
    id: 'team',
    nameKey: 'nav.team',
    icon: <Users size={16} />,
    path: appPaths.team,
    permission: 'TEAM_VIEW',
    requiresEnterpriseAdmin: true,
  },
  {
    id: 'recommendations',
    nameKey: 'nav.recommendations',
    icon: <Sparkles size={16} />,
    path: '/recommendations',
    requiresEnterpriseAdmin: true,
  },
  {
    id: 'enterprises',
    nameKey: 'nav.enterprises',
    icon: <Building2 size={16} />,
    path: '/enterprises',
    permission: 'SYSTEM_MANAGE_ENTERPRISES',
  },
  {
    id: 'approvals',
    nameKey: 'nav.approvals',
    icon: <Mail size={16} />,
    path: '/approvals',
    permission: 'SYSTEM_APPROVE_ADMINS',
  },
  {
    id: 'permissions',
    nameKey: 'nav.permissions',
    adminLabelKey: 'nav.rolesPermissions',
    icon: <Lock size={16} />,
    path: '/permissions',
    permission: 'TEAM_MANAGE_ROLES',
    hideForSuperAdmin: true,
  },
  {
    id: 'invite',
    nameKey: 'nav.invite',
    icon: <UserPlus size={16} />,
    path: '/invite',
    anyPermissions: ['TEAM_INVITE', 'TEAM_MANAGE_ROLES'],
    hideForSuperAdmin: true,
  },
  {
    id: 'settings',
    nameKey: 'nav.settings',
    icon: <Settings size={16} />,
    path: appPaths.settings,
    hideForMember: true,
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, toggleCollapsed }) => {
  const { t } = useTranslation();
  const { user, logout, refreshUser } = useAuth();
  const { can, canAny } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const superAdmin = isSuperAdmin(user);
  const enterpriseAdmin = isEnterpriseAdmin(user);
  const globalMember = isGlobalMember(user);

  const [spaces, setSpaces] = useState<SpaceTreeNode[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const inboxNotificationsEnabled = globalMember || enterpriseAdmin;
  const inboxUnreadCount = useInboxUnreadCount(inboxNotificationsEnabled);

  const isNotificationsInboxItem = useCallback(
    (item: PrimaryNavItem) =>
      item.id === 'inbox' &&
      ((globalMember && !!item.memberNotificationsInbox) ||
        (enterpriseAdmin && !!item.adminNotificationsInbox)),
    [globalMember, enterpriseAdmin]
  );

  const handleInboxNavigate = useCallback(() => {
    if (!inboxNotificationsEnabled || inboxUnreadCount <= 0) return;
    void markAllInboxNotificationsAsRead().catch((e) =>
      console.error('Mark all notifications read on inbox navigate failed:', e)
    );
  }, [inboxNotificationsEnabled, inboxUnreadCount]);

  const filterPrimary = useCallback(
    (item: PrimaryNavItem) => {
      if (item.hideForSuperAdmin && superAdmin) return false;
      if (item.hideForEnterpriseAdmin && enterpriseAdmin) return false;
      if (item.hideForMember && globalMember) return false;
      if (item.permission) {
        const skipInboxPermission = isNotificationsInboxItem(item);
        if (!skipInboxPermission && !can(item.permission)) return false;
      }
      if (item.anyPermissions && !canAny(item.anyPermissions)) return false;
      return true;
    },
    [superAdmin, enterpriseAdmin, globalMember, can, canAny, isNotificationsInboxItem]
  );

  const filterMore = useCallback(
    (item: MoreNavItem) => {
      if (item.hideForSuperAdmin && superAdmin) return false;
      if (item.hideForMember && globalMember) return false;
      if (globalMember) {
        if (item.id === 'tasks') return false;
        if (item.hideForAdmin) return false;
        if (item.permission && !can(item.permission)) return false;
        if (item.anyPermissions && !canAny(item.anyPermissions)) return false;
        if (item.requiresEnterpriseAdmin) return false;
        return false;
      }
      if (item.hideForAdmin && isEnterpriseAdmin(user)) return false;
      if (item.requiresEnterpriseAdmin && !superAdmin && !isEnterpriseAdmin(user))
        return false;
      if (item.permission && !can(item.permission)) return false;
      if (item.anyPermissions && !canAny(item.anyPermissions)) return false;
      return true;
    },
    [superAdmin, globalMember, user, can, canAny]
  );

  const primaryNav = useMemo(() => PRIMARY_NAV.filter(filterPrimary), [filterPrimary]);
  const moreItems = useMemo(() => MORE_ITEMS.filter(filterMore), [filterMore]);
  /** Membre : liens du menu « More » affichés directement (pas de dropdown). */
  const memberFlatNav = useMemo(
    () => (globalMember ? moreItems : []),
    [globalMember, moreItems]
  );
  /** Admin entreprise : liens utiles affichés directement (sans dropdown More). */
  const adminFlatNav = useMemo(
    () => (enterpriseAdmin ? moreItems : []),
    [enterpriseAdmin, moreItems]
  );
  const showMoreDropdown =
    !globalMember && !superAdmin && !enterpriseAdmin && moreItems.length > 0;

  const showSpacesSection =
    !superAdmin &&
    !enterpriseAdmin &&
    (globalMember || canAny(['PROJECT_VIEW', 'PROJECT_VIEW_ALL', 'WORKSPACE_VIEW']));

  const workspaceIds = useMemo(
    () => parseWorkspacePath(location.pathname),
    [location.pathname]
  );

  const activeSpaceId = workspaceIds.spaceId;
  const activeProjectId = workspaceIds.folderId;
  const activeSprintId = workspaceIds.sprintId;
  const activeListId =
    parseListViewPath(location.pathname) ?? workspaceIds.listId;
  const activeTaskId = useMemo(
    () => parseTaskPath(location.pathname),
    [location.pathname]
  );

  const loadSpaces = useCallback(() => {
    setSpacesLoading(true);
    return spaceService
      .getHierarchy()
      .then(({ spaces: loaded }) => {
        setSpaces(Array.isArray(loaded) ? loaded : []);
      })
      .catch(() => setSpaces([]))
      .finally(() => setSpacesLoading(false));
  }, []);

  useEffect(() => {
    if (!showSpacesSection) return;
    void loadSpaces();
  }, [showSpacesSection, loadSpaces]);

  useEffect(() => {
    if (!showSpacesSection) return;
    const onHierarchyRefresh = () => void loadSpaces();
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onHierarchyRefresh);
    window.addEventListener(PROJECTS_UPDATED_EVENT, onHierarchyRefresh);
    return () => {
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onHierarchyRefresh);
      window.removeEventListener(PROJECTS_UPDATED_EVENT, onHierarchyRefresh);
    };
  }, [showSpacesSection, loadSpaces]);

  useEffect(() => {
    const onTeamChanged = () => {
      void loadSpaces();
      void refreshUser();
    };
    window.addEventListener(PROJECT_TEAM_CHANGED_EVENT, onTeamChanged);
    return () =>
      window.removeEventListener(PROJECT_TEAM_CHANGED_EVENT, onTeamChanged);
  }, [loadSpaces, refreshUser]);

  useEffect(() => {
    if (!showSpacesSection) return;
    const onTaskRenamed = (e: Event) => {
      const detail = (e as CustomEvent<TaskRenamedDetail>).detail;
      if (!detail?.taskId || !detail.nom_t) return;
      setSpaces((prev) =>
        patchTaskNameInSpaces(prev, detail.taskId, detail.nom_t)
      );
    };
    window.addEventListener(TASK_RENAMED_EVENT, onTaskRenamed);
    return () => window.removeEventListener(TASK_RENAMED_EVENT, onTaskRenamed);
  }, [showSpacesSection]);

  useEffect(() => {
    if (!showSpacesSection) return;
    const onTaskDeleted = (e: Event) => {
      const detail = (e as CustomEvent<TaskDeletedDetail>).detail;
      if (!detail?.taskId) return;
      setSpaces((prev) => removeSubtaskFromSpaces(prev, detail.taskId));
    };
    window.addEventListener(TASK_DELETED_EVENT, onTaskDeleted);
    return () => window.removeEventListener(TASK_DELETED_EVENT, onTaskDeleted);
  }, [showSpacesSection]);

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

  const sidebarPoste = useMemo(
    () => resolveUserSidebarPoste({ user }),
    [user]
  );

  const isMoreActive = moreItems.some((item) => location.pathname === item.path);

  const primaryLabel = (item: PrimaryNavItem) => {
    if (globalMember && item.memberLabelKey) return t(item.memberLabelKey);
    if (enterpriseAdmin && item.adminLabelKey) return t(item.adminLabelKey);
    return t(item.labelKey);
  };

  const moreLabel = (item: MoreNavItem) => {
    if (enterpriseAdmin && item.adminLabelKey) return t(item.adminLabelKey);
    return t(item.nameKey);
  };

  const inboxBadgeVariant = enterpriseAdmin && !globalMember ? 'admin' : 'member';

  const renderMoreRow = (item: MoreNavItem) => (
    <NavLink
      key={item.id}
      to={item.path}
      className={({ isActive }) =>
        cn(cu.navItem, isActive && cu.navItemActive)
      }
      title={collapsed ? moreLabel(item) : undefined}
    >
      <span className={cu.navIcon}>{item.icon}</span>
      {!collapsed && <span className={cu.navLabel}>{moreLabel(item)}</span>}
    </NavLink>
  );

  const renderInboxBadge = (compact?: boolean, variant: 'member' | 'admin' = 'member') => {
    if (inboxUnreadCount <= 0) return null;
    const label = inboxUnreadCount > 99 ? '99+' : String(inboxUnreadCount);
    return (
      <span
        className={cn(
          'sidebar-inbox-badge',
          compact && 'sidebar-inbox-badge--compact',
          variant === 'admin' && 'sidebar-inbox-badge--admin'
        )}
        aria-label={t('nav.notificationsUnread', { count: inboxUnreadCount })}
      >
        {label}
      </span>
    );
  };

  const renderPrimaryRow = (item: PrimaryNavItem) => {
    const label = primaryLabel(item);
    const rowClass = (active: boolean) =>
      cn(cu.navItem, active && cu.navItemActive);
    const isInboxItem = isNotificationsInboxItem(item);

    if (item.path) {
      return (
        <NavLink
          key={item.id}
          to={item.path}
          end={item.end}
          className={({ isActive }) =>
            cn(rowClass(isActive), isInboxItem && 'sidebar-inbox-nav-item')
          }
          onClick={isInboxItem ? handleInboxNavigate : undefined}
          title={
            collapsed
              ? isInboxItem && inboxUnreadCount > 0
                ? `${label} (${t('nav.notificationsUnread', { count: inboxUnreadCount })})`
                : label
              : undefined
          }
        >
          <span className={cn(cu.navIcon, isInboxItem && 'relative shrink-0')}>
            {item.icon}
            {isInboxItem && collapsed && renderInboxBadge(true, inboxBadgeVariant)}
          </span>
          {!collapsed && <span className={cu.navLabel}>{label}</span>}
          {isInboxItem && !collapsed && renderInboxBadge(false, inboxBadgeVariant)}
        </NavLink>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className={cn(cu.navItem, 'cursor-default opacity-60')}
        title={collapsed ? label : `${label} (${t('common.soon')})`}
        disabled
      >
        <span className={cu.navIcon}>{item.icon}</span>
        {!collapsed && <span className={cu.navLabel}>{label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        cu.sidebar,
        collapsed ? cu.sidebarCollapsed : cu.sidebarExpanded,
        globalMember && 'cu-sidebar--member-dark',
        !globalMember && 'cu-sidebar--admin'
      )}
    >
      <div
        className={cn(
          cu.sidebarHeader,
          globalMember && 'cu-sidebar-member-header',
          collapsed && 'justify-center px-2 py-3'
        )}
      >
        {!collapsed && (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[15px] font-bold',
              globalMember ? 'text-[#fff]' : 'text-cu-text'
            )}
          >
            GestionPro
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            cu.btnGhost,
            'h-7 w-7 shrink-0',
            globalMember
              ? 'text-[#8b909a] hover:bg-white/10 hover:text-white'
              : 'text-cu-text-muted hover:text-cu-text',
            !collapsed && 'ml-auto'
          )}
          title={collapsed ? t('common.expand') : t('common.collapse')}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className={cu.sidebarScroll}>
        <nav className="flex flex-col gap-px px-2 pb-2">
          {!collapsed ? (
            <>
              {primaryNav.map(renderPrimaryRow)}
              {globalMember && (
                <MemberTasksSidebarNav collapsed={false} />
              )}
              {globalMember && (
                <MemberEquipeSidebarNav collapsed={false} />
              )}
              {memberFlatNav.map(renderMoreRow)}
              {adminFlatNav.map(renderMoreRow)}

              {showMoreDropdown && (
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
                    <span className={cu.navLabel}>{t('common.more')}</span>
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
                          <span className={cu.navLabel}>{moreLabel(item)}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {enterpriseAdmin && (
                <SidebarCorbeille onRefreshTree={() => Promise.resolve()} />
              )}
            </>
          ) : (
            <>
              {primaryNav
                .filter((item) => item.path)
                .map((item) => {
                  const label = primaryLabel(item);
                  const isInboxItem = isNotificationsInboxItem(item);
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path!}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          cu.navItem,
                          'justify-center px-2',
                          isActive && cu.navItemActive,
                          isInboxItem && 'sidebar-inbox-nav-item'
                        )
                      }
                      title={
                        isInboxItem && inboxUnreadCount > 0
                          ? `${label} (${t('nav.notificationsUnread', { count: inboxUnreadCount })})`
                          : label
                      }
                      onClick={isInboxItem ? handleInboxNavigate : undefined}
                    >
                      <span
                        className={cn(
                          cu.navIcon,
                          isInboxItem && 'relative shrink-0'
                        )}
                      >
                        {item.icon}
                        {isInboxItem && renderInboxBadge(true, inboxBadgeVariant)}
                      </span>
                    </NavLink>
                  );
                })}
              {globalMember && (
                <>
                  <MemberTasksSidebarNav collapsed />
                  <MemberEquipeSidebarNav collapsed />
                </>
              )}
              {memberFlatNav.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(cu.navItem, 'justify-center px-2', isActive && cu.navItemActive)
                  }
                  title={moreLabel(item)}
                >
                  <span className={cu.navIcon}>{item.icon}</span>
                </NavLink>
              ))}
              {adminFlatNav.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(cu.navItem, 'justify-center px-2', isActive && cu.navItemActive)
                  }
                  title={moreLabel(item)}
                >
                  <span className={cu.navIcon}>{item.icon}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {!collapsed && showSpacesSection && (
          <>
            <div className={cn(cu.divider, globalMember && 'cu-sidebar-member-divider')} />
            <section className="px-2 pb-2">
              {globalMember ? (
                <>
                  <div className="mb-1 px-1.5">
                    <span className="cu-sidebar-spaces-label text-[11px] font-bold uppercase tracking-wider text-cu-text-muted">
                      {t('common.spaces').toUpperCase()}
                    </span>
                  </div>
                  <MemberSpaceSidebarTree
                    spaces={spaces}
                    spacesLoading={spacesLoading}
                    activeSpaceId={activeSpaceId}
                    activeProjectId={activeProjectId}
                    activeSprintId={activeSprintId}
                    activeListId={activeListId}
                    activeTaskId={activeTaskId}
                    onRefresh={loadSpaces}
                  />
                  <MemberSidebarCorbeille onRefreshTree={loadSpaces} />
                </>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between px-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cu-text-muted">
                      {t('common.spaces').toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className={cn(
                        cu.btnGhost,
                        'h-6 w-6 p-0 text-cu-text-muted hover:bg-[#F4F4F6] hover:text-cu-text'
                      )}
                      onClick={() => navigate(`${appPaths.spaces}?create=space`)}
                      title={t('common.newSpace')}
                      aria-label={t('common.newSpace')}
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
                    canCreateList={can('LIST_MANAGE') || isEnterpriseAdmin(user)}
                    canCreateTask={can('TASK_CREATE') || isEnterpriseAdmin(user)}
                    useProjectScopedCreate
                  />
                  <SidebarCorbeille onRefreshTree={loadSpaces} />
                </>
              )}
            </section>
          </>
        )}

        {!collapsed && superAdmin && (
          <>
            <div className={cu.divider} />
            <section className="px-2 pb-2">
              <div className="mb-1 px-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cu-text-muted">
                  {t('common.administration')}
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
                  <span className={cu.navLabel}>{moreLabel(item)}</span>
                </NavLink>
              ))}
              <SidebarCorbeille onRefreshTree={loadSpaces} />
            </section>
          </>
        )}
      </div>

      <div className={cn(cu.sidebarFooter, globalMember && 'cu-sidebar-member-footer')}>
        {!collapsed && user && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors',
              globalMember ? 'hover:bg-white/10' : 'hover:bg-cu-hover'
            )}
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cu-primary text-[11px] font-bold text-white">
              <UserAvatar
                user={user}
                className="flex h-full w-full items-center justify-center"
                imgClassName="h-full w-full rounded-full object-cover"
              />
              {globalMember && (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#1e1f25] bg-emerald-500"
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'm-0 truncate text-xs font-semibold',
                  globalMember ? 'text-[#e8eaed]' : 'text-cu-text'
                )}
              >
                {user.prenom} {user.nom}
              </p>
              <p
                className={cn(
                  'cu-sidebar-user-poste m-0 truncate text-[10px] font-normal leading-tight',
                  globalMember ? 'text-[#8b909a]' : 'text-cu-text-muted'
                )}
              >
                {sidebarPoste}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className={cn(
                cu.btnGhost,
                globalMember
                  ? 'text-[#8b909a] hover:bg-red-500/15 hover:text-red-400'
                  : 'text-cu-text-muted hover:bg-red-50 hover:text-red-500'
              )}
              title={t('common.logout')}
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
            title={t('common.logout')}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
