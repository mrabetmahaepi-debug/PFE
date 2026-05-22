import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatActivityTimestamp } from '../lib/formatActivityTimestamp';
import { getAdminActivityKindLabel } from '../lib/adminActivityKind';
import { filterBlockedDashboardLabels } from '../lib/dashboardContentPolicy';
import { isEnterpriseAdmin } from '../lib/permissions';
import { activityService, type EnterpriseActivityItem } from '../services/activity.service';

const REFRESH_MS = 60_000;
const FEED_LIMIT = 20;

function projectInitials(name: string): string {
  return (name.trim()[0] || 'P').toUpperCase();
}

function displayTitle(item: EnterpriseActivityItem): string {
  if (item.title?.trim()) return item.title;
  if (item.action?.trim()) return item.action;
  const name = item.entityLabel?.trim() || 'Activité';
  return name;
}

function activityNavigatePath(item: EnterpriseActivityItem): string {
  if (item.entityType === 'task' && item.entityId) return `/tasks`;
  if (item.entityType === 'project' && item.entityId) return `/projects/${item.entityId}`;
  if (item.category === 'team') return '/team';
  return '/projects';
}

/** Admin dashboard — Activité récente (créations de projets uniquement). */
const AdminActivityFeed: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<EnterpriseActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = isEnterpriseAdmin(user);

  const loadFeed = useCallback(
    async (silent = false) => {
      if (!isAdmin) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const feed = await activityService.getEnterpriseFeed(FEED_LIMIT);
        const sorted = filterBlockedDashboardLabels(feed).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setActivities(sorted);
      } catch (err) {
        console.error('Failed to load activity feed:', err);
        setActivities([]);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger l'activité. Réessayez."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    if (!isAdmin) return;
    void loadFeed();
  }, [loadFeed, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setInterval(() => void loadFeed(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadFeed, isAdmin]);

  const visibleActivities = useMemo(() => activities, [activities]);

  if (!isAdmin) {
    return null;
  }

  return (
    <section
      className="cu-panel cu-panel--activity cu-panel--activity-admin"
      aria-label="Activité récente"
    >
      <div className="cu-panel-head cu-panel-head--activity">
        <div className="cu-activity-head-title">
          <Activity size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3>Activité récente</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Dernières actions dans votre workspace
            </p>
          </div>
        </div>
        <div className="cu-activity-head-actions">
          <button
            type="button"
            className={`cu-activity-refresh${refreshing ? ' is-spinning' : ''}`}
            onClick={() => void loadFeed(true)}
            aria-label="Actualiser l'activité"
            disabled={loading}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="cu-activity-list cu-activity-list--scroll">
        <div
          className={[
            'cu-activity-list-body',
            loading && 'cu-activity-list-body--loading',
            !loading && (error || visibleActivities.length === 0) && 'cu-activity-list-body--centered',
            !loading && !error && visibleActivities.length > 0 && 'cu-activity-list-body--fill',
          ]
            .filter(Boolean)
            .join(' ')}
        >
        {loading ? (
          <div className="cu-activity-skeleton-list" aria-hidden>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="cu-activity-skeleton-row">
                <span className="cu-activity-skeleton-avatar" />
                <span className="cu-activity-skeleton-lines">
                  <span />
                  <span />
                </span>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="cu-empty-block cu-empty-block--compact cu-empty-block--error">
            <Activity size={28} />
            <p>{error}</p>
            <button type="button" className="cu-link-btn" onClick={() => void loadFeed()}>
              Réessayer
            </button>
          </div>
        ) : visibleActivities.length > 0 ? (
          visibleActivities.map((act, i) => (
            <button
              key={act.id}
              type="button"
              className={`cu-activity-item cu-activity-item--clickable cu-activity-item--admin-row${
                i === 0 ? ' is-first' : ''
              }`}
              onClick={() => navigate(activityNavigatePath(act))}
            >
              <span className="cu-activity-avatar" aria-hidden>
                {projectInitials(act.entityLabel || act.action)}
              </span>
              <div className="cu-activity-body">
                <p className="cu-activity-title" title={displayTitle(act)}>
                  {displayTitle(act)}
                </p>
                <p className="cu-activity-entity">{getAdminActivityKindLabel(act)}</p>
              </div>
              <span className="cu-activity-time cu-activity-time--end">
                {formatActivityTimestamp(act.date)}
              </span>
            </button>
          ))
        ) : (
          <div className="cu-empty-block cu-empty-block--compact">
            <Activity size={28} />
            <p>Aucune activité récente</p>
            <span>Les nouveaux projets apparaîtront ici.</span>
          </div>
        )}
        </div>
      </div>
    </section>
  );
};

export default AdminActivityFeed;
