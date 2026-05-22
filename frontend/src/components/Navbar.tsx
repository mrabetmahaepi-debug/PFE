import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
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
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const displayName =
    `${user?.prenom || ''} ${user?.nom || ''}`.trim() ||
    user?.email?.split('@')[0] ||
    'Utilisateur';

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const list = await fetchMyNotifications();
      setNotifications(list);
    } catch (e) {
      console.error('Notifications load failed:', e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

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
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationActivate = async (n: AppNotification) => {
    const href = resolveNotificationHref(n);
    if (!n.is_read) {
      try {
        await markNotificationRead(n.num_notification);
        setNotifications((prev) =>
          prev.map((x) =>
            x.num_notification === n.num_notification ? { ...x, is_read: true } : x
          )
        );
      } catch (e) {
        console.error(e);
      }
    }
    setNotifOpen(false);
    navigate(href);
  };

  return (
    <header className={cn(cu.navbar, 'navbar')}>
      <div className="header-right">
        <div className="navbar-notif-wrap" ref={notifRef}>
          <button
            type="button"
            className={`navbar-icon-btn navbar-notif-trigger ${notifOpen ? 'is-active' : ''}`}
            title="Notifications"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} non lues` : ''}`}
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
                aria-label="Notifications"
                className="navbar-notif-panel"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="navbar-notif-panel-header">
                  <div>
                    <h2 className="navbar-notif-title">Notifications</h2>
                    <p className="navbar-notif-sub">Activité de la plateforme</p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="navbar-notif-mark-all"
                      onClick={handleMarkAllRead}
                    >
                      <CheckCheck size={15} strokeWidth={2} />
                      Tout marquer lu
                    </button>
                  )}
                </div>

                <div className="navbar-notif-list-wrap">
                  {notifLoading && notifications.length === 0 ? (
                    <div className="navbar-notif-loading">Chargement…</div>
                  ) : notifications.length === 0 ? (
                    <div className="navbar-notif-empty">
                      <div className="navbar-notif-empty-icon">
                        <Bell size={28} strokeWidth={1.5} />
                      </div>
                      <p>Aucune notification pour le moment</p>
                      <span>Vous serez informé des invitations, tâches et alertes ici.</span>
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
                              onClick={() => handleNotificationActivate(n)}
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
                                  {n.sujet || 'Notification'}
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
          title="Paramètres"
          aria-label="Paramètres"
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
            aria-label="Ouvrir le menu profil"
          >
            <span className="profile-avatar-wrap">
              {resolveProfilePhotoUrl(user?.photoUrl) ? (
                <UserAvatar
                  user={user}
                  imgClassName="profile-avatar-img"
                  title="Avatar utilisateur"
                />
              ) : (
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(`${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.email || 'U')}&background=0d9488&color=fff`}
                  alt="Avatar utilisateur"
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
                      {typeof user?.role === 'string' ? user.role : user?.role?.nom || 'Membre'} ·{' '}
                      {user?.entreprise?.nom || 'Espace'}
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
                  <span>Mon Profil</span>
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                >
                  <Settings size={18} />
                  <span>Paramètres</span>
                </div>
                <div className="dropdown-divider" />
                <div className="dropdown-item logout" onClick={logout}>
                  <LogOut size={18} />
                  <span>Déconnexion</span>
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
