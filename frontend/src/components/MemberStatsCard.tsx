import React from 'react';

export type MemberStatsCardTint = 'projects' | 'members' | 'tasks' | 'risks';

export type MemberStatsCardProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tint: MemberStatsCardTint;
  onClick?: () => void;
  loading?: boolean;
};

const MemberStatsCard: React.FC<MemberStatsCardProps> = ({
  label,
  value,
  icon,
  tint,
  onClick,
  loading = false,
}) => {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={[
        'member-stats-card',
        `member-stats-card--${tint}`,
        onClick ? 'member-stats-card--clickable' : '',
        loading ? 'member-stats-card--loading' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={onClick ? loading : undefined}
      aria-label={label}
    >
      <span className="member-stats-card__icon" aria-hidden>
        {icon}
      </span>
      <span className="member-stats-card__label">{label}</span>
      <span className="member-stats-card__value">{loading ? '—' : value}</span>
    </Tag>
  );
};

export default MemberStatsCard;
