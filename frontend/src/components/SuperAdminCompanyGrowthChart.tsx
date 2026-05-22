import React, { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, TrendingUp } from 'lucide-react';
import {
  buildCompanyGrowthInsights,
  type CompanyGrowthPoint,
} from '../lib/companyGrowthChart';
import type { Entreprise } from '../services/entreprise.service';

type SuperAdminCompanyGrowthChartProps = {
  companies: Entreprise[];
  loading?: boolean;
};

type TooltipPayload = {
  payload?: CompanyGrowthPoint;
  value?: number;
};

function GrowthTooltip({
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
    <div className="cu-sa-growth-tooltip">
      <strong>{row.month}</strong>
      <span>
        {row.total} entreprise{row.total !== 1 ? 's' : ''} créée{row.total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

const GRADIENT_ID = 'sa-company-growth-line';

/**
 * Super Admin — Company Growth Over Time (line chart).
 */
const SuperAdminCompanyGrowthChart: React.FC<SuperAdminCompanyGrowthChartProps> = ({
  companies,
  loading = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradientId = `${GRADIENT_ID}-${uid}`;

  const insights = useMemo(() => buildCompanyGrowthInsights(companies), [companies]);

  const yMax = useMemo(() => {
    const peak = insights.points.reduce((m, p) => Math.max(m, p.total), 0);
    return Math.max(peak + 1, 4);
  }, [insights.points]);

  const tickInterval = insights.points.length > 8 ? Math.ceil(insights.points.length / 6) - 1 : 0;

  return (
    <motion.section
      className="cu-panel cu-panel--sa-company-growth"
      aria-label="Croissance des entreprises dans le temps"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
    >
      <div className="cu-panel-head cu-panel-head--sa-growth">
        <div className="cu-activity-head-title">
          <TrendingUp size={18} className="cu-activity-head-icon" aria-hidden />
          <div>
            <h3>Croissance des entreprises</h3>
            <p className="cu-panel-sub cu-panel-sub--activity">
              Nouvelles entreprises créées par mois
            </p>
          </div>
        </div>
        <div
          className="cu-sa-growth-total"
          aria-label={`${insights.total} entreprises au total`}
        >
          <Building2 size={16} aria-hidden />
          <span className="cu-sa-growth-total-val">{loading ? '—' : insights.total}</span>
          <span className="cu-sa-growth-total-lbl">entreprises</span>
        </div>
      </div>

      {loading ? (
        <div className="cu-sa-growth-body cu-sa-growth-body--loading" aria-hidden>
          <div className="cu-sa-growth-skeleton-chart" />
        </div>
      ) : insights.points.length === 0 ? (
        <div className="cu-empty-block cu-empty-block--compact cu-sa-growth-empty">
          <TrendingUp size={28} />
          <p>Aucune donnée de croissance</p>
          <span>Les créations d&apos;entreprises s&apos;afficheront ici mois par mois.</span>
        </div>
      ) : (
        <div className="cu-sa-growth-body">
          <motion.div
            className="cu-sa-growth-chart-wrap"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.12 }}
          >
            <ResponsiveContainer width="100%" height={228}>
              <LineChart
                data={insights.points}
                margin={{ top: 16, right: 20, left: 8, bottom: 8 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(236, 72, 153, 0.14)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  axisLine={{ stroke: 'rgba(34, 211, 238, 0.2)' }}
                  tickLine={false}
                  interval={tickInterval}
                  angle={insights.points.length > 6 ? -28 : 0}
                  textAnchor={insights.points.length > 6 ? 'end' : 'middle'}
                  height={insights.points.length > 6 ? 64 : 40}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, yMax]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  label={{
                    value: 'Entreprises',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 4,
                    style: { fontSize: 11, fill: '#94a3b8', fontWeight: 600 },
                  }}
                />
                <Tooltip content={<GrowthTooltip />} cursor={{ stroke: 'rgba(14, 165, 233, 0.25)' }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={4}
                  dot={{
                    r: 5,
                    fill: '#ec4899',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 7,
                    fill: '#f59e0b',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  isAnimationActive
                  animationBegin={120}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </motion.section>
  );
};

export default SuperAdminCompanyGrowthChart;
