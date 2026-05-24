import React from 'react';
import { TaskPriority } from '../types/task';
import {
  memberPriorityTextClass,
  memberListPriorityLabel,
  memberListPriorityValue,
  MEMBER_LIST_PRIORITY_OPTIONS,
  taskPriorityToPillTone,
} from '../lib/memberStatusPill';
import '../styles/memberStatusPill.css';

export type MemberPriorityTextSelectProps = {
  priority?: string | null;
  canEdit?: boolean;
  onChange?: (priority: TaskPriority) => void;
};

/** Member-only priority — colored text (no badge), optional invisible select. */
const MemberPriorityTextSelect: React.FC<MemberPriorityTextSelectProps> = ({
  priority,
  canEdit = false,
  onChange,
}) => {
  const value = memberListPriorityValue(priority);
  const tone = taskPriorityToPillTone(value);
  const label = memberListPriorityLabel(priority);
  const textClass = memberPriorityTextClass(tone);

  if (!canEdit) {
    return <span className={textClass}>{label}</span>;
  }

  return (
    <div
      className="member-priority-text-select"
      onClick={(e) => e.stopPropagation()}
    >
      <span className={textClass}>{label}</span>
      <select
        className="member-priority-text-select-native"
        value={value}
        aria-label={`Priorité : ${label}`}
        onChange={(e) => {
          e.stopPropagation();
          onChange?.(e.target.value as TaskPriority);
        }}
      >
        {MEMBER_LIST_PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MemberPriorityTextSelect;
