import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';

export type AdminKpiTrend = {
  delta: number;
  /** e.g. "cette semaine" */
  periodLabel?: string;
  /** When true, a positive delta is bad (risks). */
  invertTrendColors?: boolean;
};

export type AdminKpiCardProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
  subtitle?: string;
  trend?: AdminKpiTrend | null;
  trendPercent?: number | null;
  loading?: boolean;
  error?: string | null;
  variant?: 'default' | 'risk' | 'primary';
  className?: string;
};

function formatWeeklyTrend(trend: AdminKpiTrend): string {
  const period = trend.periodLabel ?? 'cette semaine';
  const abs = Math.abs(trend.delta);
  if (abs === 0) return `Stable ${period}`;
  const sign = trend.delta > 0 ? '+' : '−';
  return `${sign}${abs} ${period}`;
}

const AdminKpiCard: React.FC<AdminKpiCardProps> = ({
  label,
  value,
  icon,
  onClick,
  subtitle,
  trend,
  trendPercent,
  loading = false,
  error = null,
  variant = 'default',
  className = '',
}) => {
  const isRisk = variant === 'risk';
  const isPrimary = variant === 'primary';
  const cardClass = [
    'cu-kpi-card',
    isPrimary ? 'cu-kpi-card--primary' : '',
    isRisk ? 'cu-kpi-card--risk' : '',
    onClick ? 'cu-kpi-card--clickable' : '',
    loading ? 'cu-kpi-card--loading' : '',
    error ? 'cu-kpi-card--error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  let trendNode: React.ReactNode = null;
  if (trend && !loading && !error) {
    const isUp = trend.delta > 0;
    const isNeutral = trend.delta === 0;
    const trendClass = isNeutral
      ? 'cu-kpi-trend neutral'
      : isRisk
        ? isUp
          ? 'cu-kpi-trend up cu-kpi-trend--bad-up'
          : 'cu-kpi-trend down cu-kpi-trend--good-down'
        : isUp
          ? 'cu-kpi-trend up'
          : 'cu-kpi-trend down';

    trendNode = (
      <span className={trendClass}>
        {isNeutral ? null : isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {formatWeeklyTrend(trend)}
      </span>
    );
  } else if (trendPercent != null && !loading && !error) {
    trendNode = (
      <span className="cu-kpi-trend up">
        <TrendingUp size={14} />+{trendPercent}%
      </span>
    );
  }

  const displayValue = loading ? '—' : error ? '—' : value;

  return (
    <button
      type="button"
      className={cardClass}
      onClick={onClick}
      disabled={!onClick}
      aria-busy={loading}
      aria-label={label}
    >
      <motion.div className="cu-kpi-top">
        <span className="cu-kpi-icon">{icon}</span>
        {trendNode}
      </motion.div>
      <div className="cu-kpi-body">
        <span className="cu-kpi-value">{displayValue}</span>
        <span className="cu-kpi-label">{label}</span>
        {subtitle ? <span className="cu-kpi-sub">{subtitle}</span> : null}
        {error ? <span className="cu-kpi-error">{error}</span> : null}
      </div>
    </button>
  );
};

export default AdminKpiCard;
