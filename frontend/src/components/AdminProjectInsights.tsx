import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isEnterpriseAdmin } from '../lib/permissions';
import {
  buildAdminProjectInsights,
  segmentPercent,
  type StatusSegment,
} from '../lib/adminProjectStatusDistribution';
import type { Projet } from '../types/project';

type AdminProjectInsightsProps = {
  projects: Projet[];
  loading?: boolean;
};

type TooltipPayload = {
  name?: string;
  value?: number;
  payload?: StatusSegment;
};

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const count = item.value ?? 0;
  const pct = segmentPercent(count, total);
  return (
    <div className="cu-insights-tooltip">
      <strong>{item.name}</strong>
      <span>
        {count} · {pct}%
      </span>
    </div>
  );
}

/**
 * Admin dashboard — Répartition des projets (donut stratégique).
 */
const AdminProjectInsights: React.FC<AdminProjectInsightsProps> = ({
  projects,
  loading = false,
}) => {
  const { user } = useAuth();
  const isAdmin = isEnterpriseAdmin(user);

  const insights = useMemo(() => buildAdminProjectInsights(projects), [projects]);

  const chartData = useMemo(
    () => insights.segments.filter((s) => s.value > 0),
    [insights.segments]
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <section
      className="cu-panel cu-panel--insights cu-panel--activity-admin"
      aria-label="Répartition des projets"
    >
      <div className="cu-panel-head cu-panel-head--insights">
        <div className="cu-activity-head-title">
          <PieChartIcon size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3>Répartition des projets</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Santé du portefeuille — vue instantanée
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="cu-insights-body cu-insights-body--loading" aria-hidden>
          <div className="cu-insights-skeleton-donut" />
          <div className="cu-insights-skeleton-metrics">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : insights.total === 0 ? (
        <div className="cu-empty-block cu-empty-block--compact cu-insights-empty">
          <PieChartIcon size={28} />
          <p>Aucun projet à analyser</p>
          <span>Créez un projet pour visualiser la répartition par statut.</span>
        </div>
      ) : (
        <div className="cu-insights-body">
          <div className="cu-insights-donut-wrap">
            <div className="cu-donut-stage cu-donut-stage--insights">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={chartData.length > 1 ? 3 : 0}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((segment) => (
                      <Cell key={segment.key} fill={segment.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<DonutTooltip total={insights.total} />}
                    cursor={{ fill: 'transparent' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="cu-donut-center" aria-hidden>
                <span className="cu-donut-center-val">{insights.total}</span>
                <span className="cu-donut-center-lbl">
                  Projet{insights.total !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <ul className="cu-insights-legend" aria-label="Légende des statuts">
              {insights.segments.map((segment) => {
                const pct = segmentPercent(segment.value, insights.total);
                return (
                  <li
                    key={segment.key}
                    className={`cu-insights-legend-row${segment.value === 0 ? ' is-zero' : ''}`}
                  >
                    <span
                      className="cu-donut-legend-dot"
                      style={{ background: segment.color }}
                      aria-hidden
                    />
                    <span className="cu-insights-legend-label">{segment.name}</span>
                    <span className="cu-insights-legend-stats">
                      <strong>{segment.value}</strong>
                      <span className="cu-insights-legend-pct">{pct}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="cu-insights-metrics" aria-label="Indicateurs clés">
            <div className="cu-insights-metric">
              <span className="cu-insights-metric-label">Complétion</span>
              <span className="cu-insights-metric-value">{insights.completionRate}%</span>
            </div>
            <div className="cu-insights-metric cu-insights-metric--risk">
              <span className="cu-insights-metric-label">En retard</span>
              <span className="cu-insights-metric-value">{insights.delayRisk}%</span>
            </div>
            <div
              className={`cu-insights-metric${
                insights.weeklyGrowth >= 0 ? ' cu-insights-metric--up' : ' cu-insights-metric--down'
              }`}
            >
              <span className="cu-insights-metric-label">Croissance 7 j</span>
              <span className="cu-insights-metric-value cu-insights-metric-value--trend">
                {insights.weeklyGrowth >= 0 ? (
                  <TrendingUp size={14} aria-hidden />
                ) : (
                  <TrendingDown size={14} aria-hidden />
                )}
                {insights.weeklyGrowth > 0 ? '+' : ''}
                {insights.weeklyGrowth}%
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminProjectInsights;

