import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import UserAvatar from './UserAvatar';
import { resolveProfilePhotoUrl } from '../lib/profilePhoto';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notification.service';
import type { AppNotification } from '../types/notification';
import {
  classifyNotification,
  formatNotificationTime,
  getNotificationAccentClass,
  getNotificationIcon,
  notificationInitials,
  resolveNotificationHref,
} from '../lib/notificationUi';
import {
  NOTIFICATIONS_REFRESH_EVENT,
  dispatchNotificationsRefresh,
} from '../lib/workspaceEvents';
import { dedupeNotificationsById } from '../lib/dedupeNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';
import { isGlobalMember, isEnterpriseAdmin } from '../lib/permissions';
import { parseMemberTasksView } from '../lib/memberTasksViews';
import {
  adminDashboardDisplayName,
  formatAdminNavbarDate,
  formatMemberNavbarDate,
  memberDisplayName,
} from '../lib/memberNavbarGreeting';
import { MON_ESPACE_NAME, isMemberMonEspaceNavbarPath } from '../lib/monEspaceRoute';
import { useMemberTopbarTitle } from '../context/MemberTopbarTitleContext';
import { useTranslation } from 'react-i18next';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const memberTasksView = parseMemberTasksView(
    new URLSearchParams(location.search).get('view')
  );
  const globalMember = isGlobalMember(user);
  const enterpriseAdmin = isEnterpriseAdmin(user);
  const showMemberAssignedTitle =
    globalMember &&
    location.pathname === '/tasks' &&
    memberTasksView === 'assigned';
  const showMemberTodayTitle =
    globalMember &&
    location.pathname === '/tasks' &&
    memberTasksView === 'today';
  const showMemberInboxTitle =
    globalMember && location.pathname === '/inbox';
  const showAdminInboxTitle =
    enterpriseAdmin && location.pathname === '/inbox';
  const isAdminDashboardHome =
    enterpriseAdmin &&
    (location.pathname === '/' ||
      location.pathname === '/dashboard' ||
      location.pathname === '/home');
  const showAdminDashboardGreeting = isAdminDashboardHome && !showAdminInboxTitle;
  const showAdminRecommendationsTitle =
    enterpriseAdmin && location.pathname === '/recommendations';
  const showMemberSettingsTitle =
    globalMember && location.pathname === '/settings';
  const showMemberTaskDetailBack =
    globalMember && /^\/tasks\/\d+\/?$/.test(location.pathname);
  const isMemberDashboardHome =
    globalMember &&
    (location.pathname === '/' ||
      location.pathname === '/dashboard' ||
      location.pathname === '/home');
  const showMemberDashboardGreeting =
    isMemberDashboardHome &&
    !showMemberAssignedTitle &&
    !showMemberTodayTitle &&
    !showMemberInboxTitle &&
    !showMemberSettingsTitle &&
    !showMemberTaskDetailBack;
  const { title: memberWorkspaceTitle } = useMemberTopbarTitle();
  const showMemberMonEspaceNavbar =
    globalMember &&
    (memberWorkspaceTitle === MON_ESPACE_NAME ||
      isMemberMonEspaceNavbarPath(location.pathname)) &&
    !showMemberAssignedTitle &&
    !showMemberTodayTitle &&
    !showMemberInboxTitle &&
    !showMemberSettingsTitle &&
    !showMemberTaskDetailBack &&
    !isMemberDashboardHome;
  const showMemberGreeting = showMemberDashboardGreeting;
  const showMemberWorkspaceTitle =
    globalMember &&
    !!memberWorkspaceTitle &&
    memberWorkspaceTitle !== MON_ESPACE_NAME &&
    !showMemberAssignedTitle &&
    !showMemberTodayTitle &&
    !showMemberInboxTitle &&
    !showMemberSettingsTitle &&
    !showMemberTaskDetailBack &&
    !isMemberDashboardHome;
  const showMemberTopbarTitle =
    showMemberInboxTitle ||
    showMemberSettingsTitle ||
    showMemberWorkspaceTitle ||
    showMemberMonEspaceNavbar;

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const displayName = memberDisplayName(user);
  const adminGreetingName = adminDashboardDisplayName(user);
  const adminGreetingDate = formatAdminNavbarDate();

  const memberGreetingDate = formatMemberNavbarDate();

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const list = await fetchMyNotifications();
      setNotifications(dedupeNotificationsById(list));
    } catch (e) {
      console.error('Notifications load failed:', e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const onRefresh = () => void loadNotifications();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
  }, [loadNotifications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    void loadNotifications();
  }, [notifOpen, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      dispatchNotificationsRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationActivate = async (
    e: React.MouseEvent,
    n: AppNotification
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!n.is_read) {
      try {
        await markNotificationRead(n.num_notification);
        setNotifications((prev) =>
          prev.map((x) =>
            x.num_notification === n.num_notification ? { ...x, is_read: true } : x
          )
        );
        dispatchNotificationsRefresh();
      } catch (err) {
        console.error(err);
      }
    }

    if (globalMember) {
      return;
    }

    setNotifOpen(false);
    navigate(resolveNotificationHref(n));
  };

  return (
    <header
      className={cn(
        cu.navbar,
        'navbar',
        showMemberGreeting && 'navbar--member-greeting',
        showMemberTopbarTitle && 'navbar--member-topbar',
        (showMemberWorkspaceTitle || showMemberMonEspaceNavbar) &&
          'navbar--member-workspace',
        showMemberMonEspaceNavbar && 'navbar--member-mon-espace',
        showMemberInboxTitle && 'navbar--member-inbox',
        showAdminInboxTitle && 'navbar--admin-inbox',
        showAdminDashboardGreeting && 'navbar--admin-greeting',
        showAdminRecommendationsTitle && 'navbar--admin-recommendations',
        showMemberSettingsTitle && 'navbar--member-settings',
        showMemberTaskDetailBack && 'navbar--member-task-detail'
      )}
    >
      {showMemberTaskDetailBack && (
        <div className="navbar-left navbar-member-back-wrap">
          <button
            type="button"
            className="navbar-member-back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            {t('navbar.back')}
          </button>
        </div>
      )}
      {showMemberGreeting && (
        <div className="navbar-member-greeting">
          <h1 className="navbar-member-greeting-title">
            {t('navbar.hello', { name: displayName })}{' '}
            <span className="navbar-member-greeting-wave" aria-hidden>
              👋
            </span>
          </h1>
          <p className="navbar-member-greeting-date">{memberGreetingDate}</p>
        </div>
      )}
      {showAdminDashboardGreeting && (
        <div className="navbar-admin-greeting">
          <h1 className="navbar-admin-greeting-title">
            {t('navbar.hello', { name: adminGreetingName })}{' '}
            <span className="navbar-admin-greeting-wave" aria-hidden>
              👋
            </span>
          </h1>
          <p className="navbar-admin-greeting-sub">{t('navbar.adminSubtitle')}</p>
          <p className="navbar-admin-greeting-date">{adminGreetingDate}</p>
        </div>
      )}
      {showAdminRecommendationsTitle && (
        <div className="navbar-page-title navbar-page-title--stacked">
          <h1 className="navbar-page-heading">{t('navbar.recommendationsTitle')}</h1>
          <p className="navbar-page-sub">{t('navbar.recommendationsSubtitle')}</p>
        </div>
      )}
      {showMemberAssignedTitle && (
        <div className="navbar-page-title">
          <h1 className="navbar-page-heading">{t('tasks.viewAssigned')}</h1>
        </div>
      )}
      {showMemberTodayTitle && (
        <div className="navbar-page-title">
          <h1 className="navbar-page-heading">{t('tasks.viewTodayOverdue')}</h1>
        </div>
      )}
      {showMemberInboxTitle && (
        <div className="navbar-page-title navbar-page-title--stacked">
          <h1 className="navbar-page-heading">{t('notifications.inbox')}</h1>
          <p className="navbar-page-sub">{t('navbar.inboxSubtitle')}</p>
        </div>
      )}
      {showAdminInboxTitle && (
        <div className="navbar-page-title navbar-page-title--stacked">
          <h1 className="navbar-page-heading">{t('notifications.inbox')}</h1>
          <p className="navbar-page-sub">{t('navbar.inboxSubtitle')}</p>
        </div>
      )}
      {showMemberSettingsTitle && (
        <div className="navbar-page-title">
          <h1 className="navbar-page-heading">{t('settings.title')}</h1>
        </div>
      )}
      {showMemberMonEspaceNavbar && (
        <div className="navbar-page-title navbar-page-title--workspace">
          <h1 className="navbar-member-workspace-title">{MON_ESPACE_NAME}</h1>
        </div>
      )}
      {showMemberWorkspaceTitle && (
        <div className="navbar-page-title navbar-page-title--workspace">
          <h1 className="navbar-member-workspace-title">{memberWorkspaceTitle}</h1>
        </div>
      )}
      <div className="header-right">
        <div className="navbar-notif-wrap" ref={notifRef}>
          <button
            type="button"
            className={`navbar-icon-btn navbar-notif-trigger ${notifOpen ? 'is-active' : ''}`}
            title={t('notifications.title')}
            aria-label={
              unreadCount > 0
                ? t('nav.notificationsUnread', { count: unreadCount })
                : t('notifications.title')
            }
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            onClick={() =>
              setNotifOpen((v) => {
                const next = !v;
                if (next) void loadNotifications();
                return next;
              })
            }
          >
            <Bell size={19} strokeWidth={2} className="navbar-notif-bell" />
            {unreadCount > 0 && (
              <span className="navbar-notif-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                role="dialog"
                aria-label={t('notifications.title')}
                className="navbar-notif-panel"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="navbar-notif-panel-header">
                  <div>
                    <h2 className="navbar-notif-title">{t('notifications.title')}</h2>
                    <p className="navbar-notif-sub">{t('navbar.notifActivity')}</p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="navbar-notif-mark-all"
                      onClick={handleMarkAllRead}
                    >
                      <CheckCheck size={15} strokeWidth={2} />
                      {t('navbar.markAllReadShort')}
                    </button>
                  )}
                </div>

                <div className="navbar-notif-list-wrap">
                  {notifLoading && notifications.length === 0 ? (
                    <div className="navbar-notif-loading">{t('common.loading')}</div>
                  ) : notifications.length === 0 ? (
                    <div className="navbar-notif-empty">
                      <div className="navbar-notif-empty-icon">
                        <Bell size={28} strokeWidth={1.5} />
                      </div>
                      <p>{t('navbar.notifEmpty')}</p>
                      <span>{t('navbar.notifEmptyHint')}</span>
                    </div>
                  ) : (
                    <ul className="navbar-notif-list" role="list">
                      {notifications.map((n) => {
                        const kind = classifyNotification(n);
                        const Icon = getNotificationIcon(kind);
                        const accent = getNotificationAccentClass(kind);
                        const initials = notificationInitials(n);
                        const at = n.date_envoi ? new Date(n.date_envoi) : new Date();
                        return (
                          <li key={n.num_notification}>
                            <button
                              type="button"
                              className={`navbar-notif-item ${n.is_read ? 'is-read' : 'is-unread'} is-clickable`}
                              onClick={(e) => void handleNotificationActivate(e, n)}
                            >
                              {!n.is_read && (
                                <span className="navbar-notif-unread-dot" aria-hidden />
                              )}
                              <span className="navbar-notif-leading">
                                <span className={`navbar-notif-icon-wrap ${accent}`}>
                                  <Icon size={16} strokeWidth={2} aria-hidden />
                                </span>
                                <span className="navbar-notif-avatar" aria-hidden>
                                  {initials}
                                </span>
                              </span>
                              <span className="navbar-notif-body">
                                <span className="navbar-notif-item-title">
                                  {n.sujet || t('navbar.defaultNotification')}
                                </span>
                                <span className="navbar-notif-item-desc">
                                  {n.message || '—'}
                                </span>
                                <time
                                  className="navbar-notif-item-time"
                                  dateTime={n.date_envoi || undefined}
                                >
                                  {formatNotificationTime(at)}
                                </time>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="navbar-icon-btn"
          title={t('settings.title')}
          aria-label={t('settings.title')}
          onClick={() => navigate('/settings')}
        >
          <Settings size={19} strokeWidth={2} />
        </button>

        <div className="nav-dropdown-wrapper" ref={profileRef}>
          <button
            type="button"
            className="profile-mini-v2 profile-mini-v2--with-name"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-haspopup="menu"
            aria-expanded={showProfileMenu}
            aria-label={t('navbar.openProfileMenu')}
          >
            <span className="profile-avatar-wrap">
              {resolveProfilePhotoUrl(user?.photoUrl) ? (
                <UserAvatar
                  user={user}
                  imgClassName="profile-avatar-img"
                  title={t('navbar.userAvatar')}
                />
              ) : (
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(`${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.email || 'U')}&background=0d9488&color=fff`}
                  alt={t('navbar.userAvatar')}
                  className="profile-avatar-img"
                />
              )}
              <span className="profile-status-dot" aria-hidden />
            </span>
            <span className="header-user-name">{displayName}</span>
            <ChevronDown
              size={14}
              className={`chevron-v2 ${showProfileMenu ? 'rotated' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="profile-dropdown premium-card"
              >
                <div className="profile-dropdown-header">
                  <span className="profile-dropdown-avatar">
                    {resolveProfilePhotoUrl(user?.photoUrl) ? (
                      <UserAvatar
                        user={user}
                        imgClassName="profile-dropdown-avatar-img"
                      />
                    ) : (
                      <>
                        {(user?.prenom?.[0] || user?.email?.[0] || '?').toUpperCase()}
                        {(user?.nom?.[0] || '').toUpperCase()}
                      </>
                    )}
                  </span>
                  <div className="profile-dropdown-meta">
                    <strong>{displayName}</strong>
                    <span>{user?.email || '—'}</span>
                    <span className="profile-dropdown-role">
                      {typeof user?.role === 'string' ? user.role : user?.role?.nom || t('navbar.member')} ·{' '}
                      {user?.entreprise?.nom || t('navbar.workspace')}
                    </span>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <div
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                >
                  <User size={18} />
                  <span>{t('navbar.myProfile')}</span>
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                >
                  <Settings size={18} />
                  <span>{t('settings.title')}</span>
                </div>
                <div className="dropdown-divider" />
                <div className="dropdown-item logout" onClick={logout}>
                  <LogOut size={18} />
                  <span>{t('common.logout')}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
