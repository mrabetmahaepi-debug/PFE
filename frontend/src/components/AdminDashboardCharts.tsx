import React, { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Projet } from '../types/project';
import {
  buildAdminProjectEvolution,
  buildAdminProjectProgress,
  type AdminProjectProgressItem,
} from '../lib/adminDashboardAnalytics';

type AdminDashboardChartsProps = {
  projects: Projet[];
};

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e8eaed',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
};

function CircularProgressRing({
  percent,
  color,
  label,
  count,
}: {
  percent: number;
  color: string;
  label: string;
  count: number;
}) {
  const size = 62;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="tadb-progress-item">
      <div className="tadb-progress-ring" aria-hidden>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#eef0f4"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="tadb-progress-ring-label"
          >
            {clamped}%
          </text>
        </svg>
      </div>
      <div className="tadb-progress-meta">
        <span className="tadb-progress-name">{label}</span>
        <span className="tadb-progress-count">
          {count} projet{count > 1 ? 's' : ''}
        </span>
      </div>
      <div className="tadb-progress-bar-track" aria-hidden>
        <span
          className="tadb-progress-bar-fill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ProjectProgressWidget({ items, total }: { items: AdminProjectProgressItem[]; total: number }) {
  const completedPercent = useMemo(() => {
    const completed = items.find((item) => item.key === 'completed');
    return completed?.percent ?? 0;
  }, [items]);

  if (total === 0) {
    return <p className="tadb-chart-empty">Aucun projet à afficher</p>;
  }

  return (
    <div className="tadb-progress-widget">
      <div className="tadb-progress-summary">
        <div className="tadb-progress-summary-main">
          <strong>{completedPercent}%</strong>
          <span>terminés</span>
        </div>
        <p className="tadb-progress-summary-sub">
          {total} projet{total > 1 ? 's' : ''} au total
        </p>
      </div>
      <div className="tadb-progress-grid">
        {items.map((item) => (
          <CircularProgressRing
            key={item.key}
            percent={item.percent}
            color={item.color}
            label={item.name}
            count={item.value}
          />
        ))}
      </div>
    </div>
  );
}

const AdminDashboardCharts: React.FC<AdminDashboardChartsProps> = ({ projects }) => {
  const evolution = useMemo(() => buildAdminProjectEvolution(projects), [projects]);
  const progressItems = useMemo(() => buildAdminProjectProgress(projects), [projects]);

  const hasEvolution = evolution.some((point) => point.total > 0 || point.newProjects > 0);

  return (
    <section className="tadb-charts-grid" aria-label="Analyses visuelles">
      <article className="tadb-chart-card">
        <header className="tadb-chart-head">
          <h2>Évolution des projets</h2>
          <p>Activité projet sur les 8 dernières semaines</p>
        </header>
        <div className="tadb-chart-body">
          {hasEvolution ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolution} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#87909e' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#87909e' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'total' ? 'Total projets' : 'Nouveaux projets',
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="newProjects"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2.5, fill: '#a78bfa', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="tadb-chart-empty">Aucun projet enregistré pour le moment</p>
          )}
        </div>
      </article>

      <article className="tadb-chart-card">
        <header className="tadb-chart-head">
          <h2>Progression des projets</h2>
          <p>Part du portefeuille par statut</p>
        </header>
        <div className="tadb-chart-body tadb-chart-body--progress">
          <ProjectProgressWidget items={progressItems} total={projects.length} />
        </div>
      </article>
    </section>
  );
};

export default AdminDashboardCharts;
