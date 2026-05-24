import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchMyNotifications,
  markNotificationRead,
} from '../services/notification.service';
import {
  classifyNotification,
  formatNotificationTime,
  getNotificationAccentClass,
  getNotificationIcon,
  notificationInitials,
} from '../lib/notificationUi';
import {
  dispatchNotificationsRefresh,
  NOTIFICATIONS_REFRESH_EVENT,
  type NotificationsRefreshDetail,
} from '../lib/workspaceEvents';
import { dedupeNotificationsById } from '../lib/dedupeNotifications';
import {
  markAllInboxNotificationsAsRead,
  markAllNotificationsReadOptimistic,
} from '../lib/markAllInboxNotificationsRead';
import type { AppNotification } from '../types/notification';
import HierarchyItemConfirmModal from '../components/HierarchyItemConfirmModal';
import '../components/Navbar.css';
import './MemberInbox.css';

const MemberInbox: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<AppNotification | null>(null);
  const [pendingDeleteAll, setPendingDeleteAll] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMyNotifications();
      setNotifications(dedupeNotificationsById(list));
    } catch (e) {
      console.error('Notifications load failed:', e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** À l'entrée dans la boîte : tout marquer lu (DB + UI). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await fetchMyNotifications();
        if (cancelled) return;
        const deduped = dedupeNotificationsById(list);
        if (deduped.some((n) => !n.is_read)) {
          setNotifications(markAllNotificationsReadOptimistic(deduped));
          setShowAll(true);
          try {
            await markAllInboxNotificationsAsRead();
          } catch (e) {
            console.error('Mark all notifications read failed:', e);
            if (!cancelled) await loadNotifications();
          }
        } else {
          setNotifications(deduped);
          setShowAll(true);
        }
      } catch (e) {
        console.error('Notifications load failed:', e);
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNotifications]);

  useEffect(() => {
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<NotificationsRefreshDetail>).detail;
      if (detail?.unreadCount === 0) {
        setNotifications((prev) => markAllNotificationsReadOptimistic(prev));
        setShowAll(true);
        return;
      }
      void loadNotifications();
    };
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const visibleNotifications = useMemo(() => {
    if (showAll) return notifications;
    return notifications.filter((n) => !n.is_read);
  }, [notifications, showAll]);

  const handleShowAll = () => {
    setShowAll(true);
  };

  const handleMarkRead = async (
    e: React.MouseEvent,
    n: AppNotification
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (n.is_read) return;

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
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.num_notification;
    setDeleteLoading(true);
    try {
      await deleteNotification(id);
      setNotifications((prev) =>
        prev.filter((x) => x.num_notification !== id)
      );
      dispatchNotificationsRefresh();
      setPendingDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setDeleteAllLoading(true);
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setShowAll(false);
      dispatchNotificationsRefresh();
      setPendingDeleteAll(false);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteAllLoading(false);
    }
  };

  const hasUnreadOnlyView =
    !showAll && notifications.some((n) => n.is_read);

  return (
    <div className="member-inbox-page">
      <div className="member-inbox-card">
        <header className="member-inbox-card-header">
          <div className="member-inbox-card-header-actions">
            {hasUnreadOnlyView && (
              <button
                type="button"
                className="member-inbox-btn member-inbox-btn--secondary"
                onClick={handleShowAll}
              >
                Voir toutes les notifications
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                className="member-inbox-btn member-inbox-btn--danger"
                onClick={() => setPendingDeleteAll(true)}
              >
                <Trash2 size={15} strokeWidth={2} aria-hidden />
                Supprimer toutes les notifications
              </button>
            )}
          </div>
        </header>

        <section
          className="member-inbox-panel"
          aria-label="Liste des notifications"
        >
          {loading && notifications.length === 0 ? (
            <div className="member-inbox-state">
              <p>Chargement…</p>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="member-inbox-state member-inbox-state--empty">
              <div className="member-inbox-empty-icon" aria-hidden>
                <Bell size={36} strokeWidth={1.5} />
              </div>
              <p className="member-inbox-empty-title">
                {!showAll && unreadCount === 0 && notifications.length > 0
                  ? 'Aucune notification non lue'
                  : 'Aucune notification pour le moment'}
              </p>
              <span className="member-inbox-empty-hint">
                {!showAll && notifications.length > 0 ? (
                  <>
                    Des notifications lues sont masquées.{' '}
                    <button
                      type="button"
                      className="member-inbox-empty-link"
                      onClick={handleShowAll}
                    >
                      Voir toutes les notifications
                    </button>
                  </>
                ) : (
                  'Vous serez informé des invitations, tâches et alertes ici.'
                )}
              </span>
            </div>
          ) : (
            <ul className="member-inbox-list" role="list">
              {visibleNotifications.map((n) => {
                const kind = classifyNotification(n);
                const Icon = getNotificationIcon(kind);
                const accent = getNotificationAccentClass(kind);
                const initials = notificationInitials(n);
                const at = n.date_envoi ? new Date(n.date_envoi) : new Date();
                return (
                  <li key={n.num_notification} className="member-inbox-row">
                    <button
                      type="button"
                      className="member-inbox-delete-btn"
                      title="Supprimer la notification"
                      aria-label="Supprimer la notification"
                      onClick={() => setPendingDelete(n)}
                    >
                      <Trash2 size={17} strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`member-inbox-item ${n.is_read ? 'is-read' : 'is-unread'}`}
                      onClick={(e) => void handleMarkRead(e, n)}
                    >
                      {!n.is_read && (
                        <span className="member-inbox-unread-dot" aria-hidden />
                      )}
                      <span className="member-inbox-leading">
                        <span className={`member-inbox-icon-wrap ${accent}`}>
                          <Icon size={16} strokeWidth={2} aria-hidden />
                        </span>
                        <span className="member-inbox-avatar" aria-hidden>
                          {initials}
                        </span>
                      </span>
                      <span className="member-inbox-body">
                        <span className="member-inbox-item-title">
                          {n.sujet || 'Notification'}
                        </span>
                        <span className="member-inbox-item-desc">
                          {n.message || '—'}
                        </span>
                        <time
                          className="member-inbox-item-time"
                          dateTime={n.date_envoi || undefined}
                        >
                          {formatNotificationTime(at)}
                          {n.is_read ? (
                            <span className="member-inbox-read-label">
                              {' '}
                              · Lue
                            </span>
                          ) : (
                            <span className="member-inbox-unread-label">
                              {' '}
                              · Non lue
                            </span>
                          )}
                        </time>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <HierarchyItemConfirmModal
        open={!!pendingDelete}
        itemName={pendingDelete?.sujet?.trim() || 'Notification'}
        descriptionLine="Cette notification sera supprimée définitivement."
        loading={deleteLoading}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => !deleteLoading && setPendingDelete(null)}
      />

      <HierarchyItemConfirmModal
        open={pendingDeleteAll}
        itemName="toutes les notifications"
        descriptionLine="Toutes les notifications seront supprimées définitivement."
        loading={deleteAllLoading}
        onConfirm={() => void handleConfirmDeleteAll()}
        onCancel={() => !deleteAllLoading && setPendingDeleteAll(false)}
      />
    </div>
  );
};

export default MemberInbox;
