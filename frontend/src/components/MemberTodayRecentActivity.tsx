import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { activityService, type EnterpriseActivityItem } from '../services/activity.service';
import { formatRecentActivityTime } from '../lib/formatRecentActivityTime';
import {
  formatMemberTaskActivityLine,
  isMemberTaskActivityItem,
} from '../lib/memberActivityLine';
import { WORKSPACE_REFRESH_EVENT } from '../lib/workspaceEvents';
import '../pages/MemberTodayOverdue.css';

const FEED_LIMIT = 14;
const REFRESH_MS = 60_000;
const RELATIVE_TICK_MS = 30_000;

const MemberTodayRecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<EnterpriseActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const feed = await activityService.getMemberTaskFeed(FEED_LIMIT);
      setActivities(feed.filter(isMemberTaskActivityItem));
    } catch (err) {
      console.error(err);
      setActivities([]);
      setError(
        err instanceof Error ? err.message : "Impossible de charger l'activité."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const onRefresh = () => void loadFeed(true);
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
  }, [loadFeed]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadFeed(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadFeed]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((n) => n + 1), RELATIVE_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(
    () =>
      activities.map((item) => ({
        id: item.id,
        date: item.date,
        line: formatMemberTaskActivityLine(item),
        time: formatRecentActivityTime(item.date),
      })),
    [activities, nowTick]
  );

  return (
    <div className="member-today-activity-body">
      {loading ? (
        <p className="member-today-activity-loading">Chargement…</p>
      ) : error ? (
        <p className="member-today-activity-error" role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="member-today-activity-empty">Aucune activité récente</p>
      ) : (
        <ul className="member-today-activity-list" role="list">
          {rows.map((row) => (
            <li key={row.id} className="member-today-activity-item">
              <span className="member-today-activity-line">{row.line}</span>
              <time className="member-today-activity-time" dateTime={row.date}>
                {row.time}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MemberTodayRecentActivity;
