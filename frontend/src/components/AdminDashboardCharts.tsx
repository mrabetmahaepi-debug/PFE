import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  countLabel,
}: {
  percent: number;
  color: string;
  label: string;
  countLabel: string;
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
        <span className="tadb-progress-count">{countLabel}</span>
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
  const { t } = useTranslation();
  const completedPercent = useMemo(() => {
    const completed = items.find((item) => item.key === 'completed');
    return completed?.percent ?? 0;
  }, [items]);

  if (total === 0) {
    return <p className="tadb-chart-empty">{t('dashboard.noProjectsDisplay')}</p>;
  }

  return (
    <div className="tadb-progress-widget">
      <div className="tadb-progress-summary">
        <div className="tadb-progress-summary-main">
          <strong>{completedPercent}%</strong>
          <span>{t('dashboard.completedPercent')}</span>
        </div>
        <p className="tadb-progress-summary-sub">{t('dashboard.totalProjects', { count: total })}</p>
      </div>
      <div className="tadb-progress-grid">
        {items.map((item) => (
          <CircularProgressRing
            key={item.key}
            percent={item.percent}
            color={item.color}
            label={item.name}
            countLabel={t('dashboard.projectCount', { count: item.value })}
          />
        ))}
      </div>
    </div>
  );
}

const AdminDashboardCharts: React.FC<AdminDashboardChartsProps> = ({ projects }) => {
  const { t } = useTranslation();
  const evolution = useMemo(() => buildAdminProjectEvolution(projects), [projects]);
  const progressItems = useMemo(() => buildAdminProjectProgress(projects), [projects]);

  const hasEvolution = evolution.some((point) => point.total > 0 || point.newProjects > 0);

  return (
    <section className="tadb-charts-grid" aria-label={t('dashboard.visualAnalytics')}>
      <article className="tadb-chart-card">
        <header className="tadb-chart-head">
          <h2>{t('dashboard.evolutionTitle')}</h2>
          <p>{t('dashboard.evolutionSubtitle')}</p>
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
                  formatter={(value, name) => [
                    Number(value ?? 0),
                    String(name) === 'total'
                      ? t('dashboard.chartTotal')
                      : t('dashboard.chartNew'),
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
            <p className="tadb-chart-empty">{t('dashboard.noProjectsChart')}</p>
          )}
        </div>
      </article>

      <article className="tadb-chart-card">
        <header className="tadb-chart-head">
          <h2>{t('dashboard.progressTitle')}</h2>
          <p>{t('dashboard.progressSubtitle')}</p>
        </header>
        <div className="tadb-chart-body tadb-chart-body--progress">
          <ProjectProgressWidget items={progressItems} total={projects.length} />
        </div>
      </article>
    </section>
  );
};

export default AdminDashboardCharts;
