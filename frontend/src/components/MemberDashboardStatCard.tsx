import React from 'react';
import './MemberDashboardStatCard.css';

type MemberDashboardStatCardProps = {
  icon: string;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  ariaLabel: string;
  onClick: () => void;
};

const MemberDashboardStatCard: React.FC<MemberDashboardStatCardProps> = ({
  icon,
  label,
  value,
  valueClassName = '',
  ariaLabel,
  onClick,
}) => (
  <button
    type="button"
    className="mcdb-stat-card"
    onClick={onClick}
    aria-label={ariaLabel}
  >
    <span className="mcdb-stat-icon" aria-hidden>
      {icon}
    </span>
    <span className="mcdb-stat-body">
      <span className="mcdb-stat-label">{label}</span>
      <strong className={`mcdb-stat-value${valueClassName ? ` ${valueClassName}` : ''}`}>
        {value}
      </strong>
    </span>
    <span className="mcdb-stat-arrow" aria-hidden>
      →
    </span>
  </button>
);

export default MemberDashboardStatCard;
