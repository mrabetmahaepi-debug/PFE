import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { formatRecentActivityTime } from '../lib/formatRecentActivityTime';
import { getAdminActivityKindLabel } from '../lib/adminActivityKind';
import { filterBlockedDashboardLabels } from '../lib/dashboardContentPolicy';
import { WORKSPACE_REFRESH_EVENT } from '../lib/workspaceEvents';
import { activityService, type EnterpriseActivityItem } from '../services/activity.service';

const REFRESH_MS = 60_000;
const RELATIVE_TICK_MS = 30_000;
const FEED_LIMIT = 12;

function displayTitle(item: EnterpriseActivityItem): string {
  if (item.title?.trim()) return item.title;
  if (item.action?.trim()) return item.action;
  return item.entityLabel?.trim() || 'Activité';
}

function projectInitials(name: string): string {
  return (name.trim()[0] || 'A').toUpperCase();
}

/** Member dashboard — Activité récente (tâches assignées & projets). */
const MemberActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<EnterpriseActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const feed = await activityService.getMemberFeed(FEED_LIMIT);
      const sorted = filterBlockedDashboardLabels(feed).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setActivities(sorted);
    } catch (err) {
      console.error('Failed to load member activity feed:', err);
      setActivities([]);
      setError(
        err instanceof Error ? err.message : "Impossible de charger l'activité. Réessayez."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadFeed(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadFeed]);

  useEffect(() => {
    const onRefresh = () => void loadFeed(true);
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
  }, [loadFeed]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((n) => n + 1), RELATIVE_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const visibleActivities = useMemo(() => activities, [activities, nowTick]);

  return (
    <section
      className="cu-panel cu-panel--activity cu-panel--activity-member cu-panel--activity-admin"
      aria-label="Activité récente"
    >
      <div className="cu-panel-head cu-panel-head--activity">
        <div className="cu-activity-head-title">
          <Activity size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3 className="cu-title-gradient">Activité récente</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Vos tâches et projets
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
            !loading &&
              (error || visibleActivities.length === 0) &&
              'cu-activity-list-body--centered',
            !loading &&
              !error &&
              visibleActivities.length > 0 &&
              'cu-activity-list-body--fill',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {loading ? (
            <div className="cu-activity-skeleton-list" aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
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
              <div
                key={act.id}
                className={`cu-activity-item cu-activity-item--static cu-activity-item--admin-row${
                  act.status === 'WARNING' ? ' cu-activity-item--warning' : ''
                }${act.status === 'PENDING' ? ' cu-activity-item--pending' : ''}${
                  i === 0 ? ' is-first' : ''
                }`}
              >
                <span className="cu-activity-avatar" aria-hidden>
                  {projectInitials(act.entityLabel || act.subtitle || act.action)}
                </span>
                <div className="cu-activity-body">
                  <p className="cu-activity-title" title={displayTitle(act)}>
                    {displayTitle(act)}
                  </p>
                  <p className="cu-activity-entity">
                    {act.subtitle || getAdminActivityKindLabel(act)}
                  </p>
                </div>
                <span className="cu-activity-time cu-activity-time--end">
                  {formatRecentActivityTime(act.date)}
                </span>
              </div>
            ))
          ) : (
            <div className="cu-empty-block cu-empty-block--compact">
              <Activity size={28} />
              <p>Aucune activité récente</p>
              <span>Vos tâches assignées et projets apparaîtront ici.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MemberActivityFeed;
