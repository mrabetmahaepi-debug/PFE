import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckSquare, PieChart as PieChartIcon } from 'lucide-react';
import {
  buildMemberTasksByProjectInsights,
  segmentPercent,
  type MemberProjectTaskSegment,
} from '../lib/memberTasksByProjectChart';
import type { Tache } from '../types/task';
import type { Projet } from '../types/project';

type MemberTasksByProjectChartProps = {
  tasks: Tache[];
  projects: Projet[];
  userId?: number;
  loading?: boolean;
};

type TooltipPayload = {
  name?: string;
  value?: number;
  payload?: MemberProjectTaskSegment & { name: string; value: number };
};

function ProjectDonutTooltip({
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
    <div className="cu-member-project-tooltip">
      <strong>{item.name}</strong>
      <span>
        {count} task{count !== 1 ? 's' : ''} · {pct}%
      </span>
    </div>
  );
}

/**
 * Member — Tasks per project (donut).
 */
const MemberTasksByProjectChart: React.FC<MemberTasksByProjectChartProps> = ({
  tasks,
  projects,
  userId,
  loading = false,
}) => {
  const insights = useMemo(
    () => buildMemberTasksByProjectInsights(tasks, projects, userId),
    [tasks, projects, userId]
  );

  const chartData = useMemo(
    () =>
      insights.segments.map((s) => ({
        ...s,
        name: s.project,
        value: s.total,
      })),
    [insights.segments]
  );

  const displayChartData =
    chartData.length > 0 ? chartData : [{ name: 'Aucune', value: 1, color: '#cbd5e1', key: 'empty' }];

  return (
    <motion.section
      className="cu-panel cu-panel--member-tasks-by-project"
      aria-label="Tasks per project"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
    >
      <div className="cu-panel-head cu-panel-head--member-project">
        <div className="cu-activity-head-title">
          <PieChartIcon size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3>Tâches par projet</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Répartition des tâches selon vos projets
            </p>
          </div>
        </div>
        <div
          className="cu-member-project-total"
          aria-label={`${insights.total} assigned tasks`}
        >
          <CheckSquare size={16} aria-hidden />
          <span className="cu-member-project-total-val">{loading ? '—' : insights.total}</span>
          <span className="cu-member-project-total-lbl">tâches</span>
        </div>
      </div>

      {loading ? (
        <div className="cu-member-project-body cu-member-project-body--loading" aria-hidden>
          <div className="cu-member-project-skeleton-donut" />
          <div className="cu-member-project-skeleton-legend">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : insights.total === 0 ? (
        <div className="cu-empty-block cu-empty-block--compact cu-member-project-empty">
          <PieChartIcon size={28} />
          <p>No assigned tasks</p>
          <span>Your tasks grouped by project will appear here.</span>
        </div>
      ) : (
        <div className="cu-member-project-body">
          <motion.div
            className="cu-donut-stage cu-donut-stage--member-project"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
          >
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={displayChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={chartData.length > 1 ? 3 : 0}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {displayChartData.map((segment) => (
                    <Cell key={segment.key} fill={segment.color} />
                  ))}
                </Pie>
                <Tooltip content={<ProjectDonutTooltip total={insights.total} />} cursor={{ fill: 'transparent' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="cu-donut-center cu-donut-center--member-project" aria-hidden>
              <span className="cu-donut-center-val">{insights.total}</span>
              <span className="cu-donut-center-lbl">Total Tasks</span>
            </div>
          </motion.div>

          <ul className="cu-member-project-legend" aria-label="Legend by project">
            {insights.segments.map((segment) => {
              const pct = segmentPercent(segment.total, insights.total);
              return (
                <motion.li
                  key={segment.key}
                  className="cu-member-project-legend-row"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <span
                    className="cu-donut-legend-dot"
                    style={{ background: segment.color }}
                    aria-hidden
                  />
                  <span className="cu-member-project-legend-label">{segment.project}</span>
                  <span className="cu-member-project-legend-stats">
                    <strong>{segment.total}</strong>
                    <span className="cu-member-project-legend-pct">{pct}%</span>
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.section>
  );
};

export default MemberTasksByProjectChart;
