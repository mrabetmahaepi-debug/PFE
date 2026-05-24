import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './MemberTasksPageHeader.css';

interface MemberTasksPageHeaderProps {
  currentLabel: string;
}

const MemberTasksPageHeader: React.FC<MemberTasksPageHeaderProps> = ({
  currentLabel,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="member-tasks-page-header">
      <button
        type="button"
        className="member-tasks-page-back"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        {t('navbar.back')}
      </button>
      <nav className="member-tasks-page-breadcrumb" aria-label="Breadcrumb">
        <span className="member-tasks-page-crumb-muted">{t('tasks.myTasks')}</span>
        <span className="member-tasks-page-crumb-sep" aria-hidden>
          &gt;
        </span>
        <span className="member-tasks-page-crumb-current">{currentLabel}</span>
      </nav>
    </div>
  );
};

export default MemberTasksPageHeader;
