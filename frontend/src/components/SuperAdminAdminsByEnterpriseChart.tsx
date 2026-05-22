import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon, Users } from 'lucide-react';
import {
  buildAdminByEnterpriseInsights,
  segmentPercent,
  type EnterpriseAdminSegment,
} from '../lib/adminByEnterpriseChart';
import type { User } from '../types/auth.types';

type SuperAdminAdminsByEnterpriseChartProps = {
  members: User[];
  loading?: boolean;
};

type TooltipPayload = {
  name?: string;
  value?: number;
  payload?: EnterpriseAdminSegment;
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
    <div className="cu-sa-admins-tooltip">
      <strong>{item.name}</strong>
      <span>
        {count} admin{count !== 1 ? 's' : ''} · {pct}%
      </span>
    </div>
  );
}

/**
 * Super Admin — Répartition des admins par entreprise (donut).
 */
const SuperAdminAdminsByEnterpriseChart: React.FC<SuperAdminAdminsByEnterpriseChartProps> = ({
  members,
  loading = false,
}) => {
  const insights = useMemo(() => buildAdminByEnterpriseInsights(members), [members]);

  const chartData = useMemo(
    () => insights.segments.filter((s) => s.value > 0),
    [insights.segments]
  );

  return (
    <motion.section
      className="cu-panel cu-panel--sa-admins-enterprise"
      aria-label="Répartition des admins par entreprise"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="cu-panel-head cu-panel-head--sa-admins">
        <div className="cu-activity-head-title">
          <PieChartIcon size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3>Répartition des admins par entreprise</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Vue globale des administrateurs tenant
            </p>
          </div>
        </div>
        <div className="cu-sa-admins-total" aria-label={`${insights.total} administrateurs au total`}>
          <Users size={16} aria-hidden />
          <span className="cu-sa-admins-total-val">{loading ? '—' : insights.total}</span>
          <span className="cu-sa-admins-total-lbl">admins</span>
        </div>
      </div>

      {loading ? (
        <div className="cu-sa-admins-body cu-sa-admins-body--loading" aria-hidden>
          <div className="cu-sa-admins-skeleton-donut" />
          <div className="cu-sa-admins-skeleton-legend">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : insights.total === 0 ? (
        <div className="cu-empty-block cu-empty-block--compact cu-sa-admins-empty">
          <PieChartIcon size={28} />
          <p>Aucun administrateur à afficher</p>
          <span>Les admins actifs apparaîtront ici par entreprise.</span>
        </div>
      ) : (
        <div className="cu-sa-admins-body">
          <div className="cu-sa-admins-donut-wrap">
            <motion.div
              className="cu-donut-stage cu-donut-stage--sa-admins"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
            >
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={100}
                    paddingAngle={chartData.length > 1 ? 3 : 0}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive
                    animationBegin={80}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {chartData.map((segment) => (
                      <Cell key={segment.key} fill={segment.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip total={insights.total} />} cursor={{ fill: 'transparent' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="cu-donut-center" aria-hidden>
                <span className="cu-donut-center-val">{insights.total}</span>
                <span className="cu-donut-center-lbl">Admins</span>
              </div>
            </motion.div>

            <ul className="cu-sa-admins-legend" aria-label="Légende par entreprise">
              {insights.segments.map((segment) => {
                const pct = segmentPercent(segment.value, insights.total);
                return (
                  <motion.li
                    key={segment.key}
                    className="cu-sa-admins-legend-row"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <span
                      className="cu-donut-legend-dot"
                      style={{ background: segment.color }}
                      aria-hidden
                    />
                    <span className="cu-sa-admins-legend-label">{segment.name}</span>
                    <span className="cu-sa-admins-legend-stats">
                      <strong>{segment.value}</strong>
                      <span className="cu-sa-admins-legend-pct">{pct}%</span>
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </motion.section>
  );
};

export default SuperAdminAdminsByEnterpriseChart;
