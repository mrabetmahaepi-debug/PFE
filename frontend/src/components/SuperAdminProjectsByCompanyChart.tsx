import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Briefcase } from 'lucide-react';
import {
  buildProjectsByCompanyInsights,
  type CompanyProjectBar,
} from '../lib/projectsByCompanyChart';
import type { Projet } from '../types/project';

type SuperAdminProjectsByCompanyChartProps = {
  projects: Projet[];
  loading?: boolean;
};

type TooltipPayload = {
  payload?: CompanyProjectBar;
  value?: number;
};

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="cu-sa-projects-tooltip">
      <strong>{row.company}</strong>
      <span>
        {row.total} projet{row.total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/**
 * Super Admin — Projects per Company (bar chart).
 */
const SuperAdminProjectsByCompanyChart: React.FC<SuperAdminProjectsByCompanyChartProps> = ({
  projects,
  loading = false,
}) => {
  const insights = useMemo(() => buildProjectsByCompanyInsights(projects), [projects]);

  const chartData = useMemo(() => insights.bars.filter((b) => b.total > 0), [insights.bars]);

  const yMax = useMemo(() => {
    const peak = chartData.reduce((m, b) => Math.max(m, b.total), 0);
    return Math.max(peak + 1, 4);
  }, [chartData]);

  return (
    <motion.section
      className="cu-panel cu-panel--sa-projects-company"
      aria-label="Projets par entreprise"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.06 }}
    >
      <div className="cu-panel-head cu-panel-head--sa-projects">
        <div className="cu-activity-head-title">
          <BarChart3 size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3>Projets par entreprise</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Volume de projets par entreprise
            </p>
          </div>
        </div>
        <div
          className="cu-sa-projects-total"
          aria-label={`${insights.total} projets au total`}
        >
          <Briefcase size={16} aria-hidden />
          <span className="cu-sa-projects-total-val">{loading ? '—' : insights.total}</span>
          <span className="cu-sa-projects-total-lbl">projets</span>
        </div>
      </div>

      {loading ? (
        <div className="cu-sa-projects-body cu-sa-projects-body--loading" aria-hidden>
          <div className="cu-sa-projects-skeleton-chart" />
        </div>
      ) : insights.total === 0 ? (
        <div className="cu-empty-block cu-empty-block--compact cu-sa-projects-empty">
          <BarChart3 size={28} />
          <p>Aucun projet à afficher</p>
          <span>Les projets apparaîtront ici regroupés par entreprise.</span>
        </div>
      ) : (
        <div className="cu-sa-projects-body">
          <motion.div
            className="cu-sa-projects-chart-wrap"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          >
            <ResponsiveContainer width="100%" height={228}>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 12, left: 8, bottom: 36 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(34, 211, 238, 0.14)"
                  vertical={false}
                />
                <XAxis
                  dataKey="company"
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  axisLine={{ stroke: 'rgba(34, 211, 238, 0.2)' }}
                  tickLine={false}
                  interval={0}
                  angle={chartData.length > 4 ? -32 : 0}
                  textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                  height={chartData.length > 4 ? 64 : 36}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, yMax]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  label={{
                    value: 'Projets',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 8,
                    style: { fontSize: 11, fill: '#94a3b8', fontWeight: 600 },
                  }}
                />
                <Tooltip
                  content={<BarTooltip />}
                  cursor={{ fill: 'rgba(20, 184, 166, 0.08)', radius: 8 }}
                />
                <Bar
                  dataKey="total"
                  radius={[10, 10, 4, 4]}
                  maxBarSize={64}
                  isAnimationActive
                  animationBegin={100}
                  animationDuration={750}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </motion.section>
  );
};

export default SuperAdminProjectsByCompanyChart;
