import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw } from 'lucide-react';
import { activityService } from '../services/activity.service';
import { buildMemberRecentFeed } from '../lib/memberRecentItems';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import './MemberSpaceRecentCard.css';

const REFRESH_MS = 60_000;

const MemberSpaceRecentCard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState(() => buildMemberRecentFeed([]));

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const feed = await activityService.getMemberFeed(20);
      setItems(buildMemberRecentFeed(feed));
    } catch (err) {
      console.error(err);
      setItems(buildMemberRecentFeed([]));
      setError(err instanceof Error ? err.message : 'Impossible de charger les éléments récents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const visible = useMemo(() => items, [items]);

  return (
    <section className="ms-card ms-card--recent" aria-label="Recent">
      <header className="ms-card-head">
        <div className="ms-card-title-wrap">
          <Clock size={18} className="ms-card-icon" aria-hidden />
          <h2 className="ms-card-title">Recent</h2>
        </div>
        <button
          type="button"
          className={`ms-card-refresh${refreshing ? ' is-spinning' : ''}`}
          onClick={() => void load(true)}
          aria-label="Actualiser"
          disabled={loading}
        >
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="ms-recent-list">
        {loading ? (
          <div className="ms-recent-skeleton" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="ms-recent-skeleton-row" />
            ))}
          </div>
        ) : error ? (
          <div className="ms-empty">
            <p>{error}</p>
            <button type="button" className="ms-link-btn" onClick={() => void load()}>
              Réessayer
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="ms-empty">
            <p>Aucun élément récent</p>
            <span>Ouvrez un projet, sprint ou liste pour les voir ici.</span>
          </div>
        ) : (
          <ul className="ms-recent-items">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="ms-recent-row"
                  onClick={() => item.href && navigate(item.href)}
                  disabled={!item.href}
                >
                  <span className="ms-recent-row-title">{item.title}</span>
                  <span className="ms-recent-row-meta">
                    <span className="ms-recent-row-dot" aria-hidden>
                      •
                    </span>
                    {item.context}
                  </span>
                  <span className="ms-recent-row-time">{formatRelativeTime(item.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default MemberSpaceRecentCard;
