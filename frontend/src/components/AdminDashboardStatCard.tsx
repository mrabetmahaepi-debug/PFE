import React from 'react';
import './AdminDashboardStatCard.css';

type AdminDashboardStatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'violet' | 'amber' | 'rose' | 'teal';
  ariaLabel: string;
  onClick?: () => void;
};

const AdminDashboardStatCard: React.FC<AdminDashboardStatCardProps> = ({
  icon,
  label,
  value,
  tone = 'default',
  ariaLabel,
  onClick,
}) => {
  if (onClick) {
    return (
      <button
        type="button"
        className={`tadb-stat-card tadb-stat-card--${tone} is-clickable`}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        <span className="tadb-stat-icon" aria-hidden>
          {icon}
        </span>
        <span className="tadb-stat-body">
          <span className="tadb-stat-label">{label}</span>
          <strong className="tadb-stat-value">{value}</strong>
        </span>
      </button>
    );
  }

  return (
    <div
      className={`tadb-stat-card tadb-stat-card--${tone}`}
      aria-label={ariaLabel}
    >
      <span className="tadb-stat-icon" aria-hidden>
        {icon}
      </span>
      <span className="tadb-stat-body">
        <span className="tadb-stat-label">{label}</span>
        <strong className="tadb-stat-value">{value}</strong>
      </span>
    </div>
  );
};

export default AdminDashboardStatCard;
