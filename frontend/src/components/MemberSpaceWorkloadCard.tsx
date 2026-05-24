import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart3 } from 'lucide-react';
import {
  computeMemberWorkload,
  dashboardStatusCounts,
  workloadToChartSegments,
  type MemberWorkloadCounts,
} from '../lib/memberTaskWorkload';
import { MEMBER_DASHBOARD_ROUTES } from '../lib/memberDashboardNavigation';
import MonEspaceWorkloadChart from './MonEspaceWorkloadChart';
import type { Tache } from '../types/task';
import './MemberSpaceWorkloadCard.css';

type MemberSpaceWorkloadCardProps = {
  tasks: Tache[];
  loading?: boolean;
  /** Mon espace workspace uses dedicated status colors. */
  variant?: 'default' | 'mon-espace';
};

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`ms-workload-stat ms-workload-stat--${tone}`}>
      <span className="ms-workload-stat-label">{label}</span>
      <strong className="ms-workload-stat-value">{value}</strong>
    </div>
  );
}

const MON_ESPACE_STATUS_ROUTES = {
  afaire: '/tasks?view=assigned&status=todo',
  encours: '/tasks?view=assigned&status=en_cours',
  retard: '/tasks?view=assigned&status=en_retard',
  termine: MEMBER_DASHBOARD_ROUTES.assignedTermine,
} as const;

const MemberSpaceWorkloadCard: React.FC<MemberSpaceWorkloadCardProps> = ({
  tasks,
  loading = false,
  variant = 'default',
}) => {
  const navigate = useNavigate();
  const isMonEspace = variant === 'mon-espace';
  const counts: MemberWorkloadCounts = useMemo(
    () => computeMemberWorkload(tasks),
    [tasks]
  );
  const statusCounts = useMemo(() => dashboardStatusCounts(counts), [counts]);

  const segments = useMemo(() => workloadToChartSegments(counts), [counts]);
  const chartData =
    segments.length > 0 ? segments : [{ key: 'empty', label: 'Aucune', value: 1, color: '#e2e8f0' }];

  const goToStatus = (id: keyof typeof MON_ESPACE_STATUS_ROUTES) => {
    navigate(MON_ESPACE_STATUS_ROUTES[id]);
  };

  return (
    <section
      className={`ms-card ms-card--workload${isMonEspace ? ' ms-card--workload-mon-espace' : ''}`}
      aria-label="Workload by Status"
    >
      <header className="ms-card-head">
        <div className="ms-card-title-wrap">
          <BarChart3 size={18} className="ms-card-icon" aria-hidden />
          <h2 className="ms-card-title">Workload by Status</h2>
        </div>
      </header>

      <div className={`ms-workload-body${loading ? ' is-loading' : ''}`}>
        {isMonEspace ? (
          <MonEspaceWorkloadChart
            counts={statusCounts}
            onRowClick={goToStatus}
          />
        ) : (
          <>
            <div className="ms-workload-chart">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                    stroke="none"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e8eaed',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="ms-workload-chart-center" aria-hidden>
                <span className="ms-workload-chart-total">{counts.total}</span>
                <span className="ms-workload-chart-sub">tâches</span>
              </div>
            </div>

            <div className="ms-workload-legend">
              {segments.map((s) => (
                <span key={s.key} className="ms-workload-legend-item">
                  <span className="ms-workload-legend-dot" style={{ background: s.color }} />
                  {s.label}
                  <strong>{s.value}</strong>
                </span>
              ))}
            </div>

            <div className="ms-workload-stats">
              <StatPill label="TO DO" value={counts.todo} tone="todo" />
              <StatPill label="À FAIRE" value={counts.aFaire} tone="afaire" />
              <StatPill label="EN COURS" value={counts.enCours} tone="encours" />
              <StatPill label="EN RETARD" value={counts.enRetard} tone="retard" />
              <StatPill label="TERMINÉ" value={counts.termine} tone="termine" />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default MemberSpaceWorkloadCard;
