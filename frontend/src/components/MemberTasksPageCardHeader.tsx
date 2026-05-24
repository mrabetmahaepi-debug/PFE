import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './MemberTasksPageCardHeader.css';

interface MemberTasksPageCardHeaderProps {
  currentLabel: string;
}

const MemberTasksPageCardHeader: React.FC<MemberTasksPageCardHeaderProps> = ({
  currentLabel,
}) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="member-tasks-card-header">
        <button
          type="button"
          className="member-tasks-card-back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          Retour
        </button>
        <nav className="member-tasks-card-breadcrumb" aria-label="Fil d'Ariane">
          <span className="member-tasks-card-crumb-muted">Mes tâches</span>
          <span className="member-tasks-card-crumb-sep" aria-hidden>
            &gt;
          </span>
          <span className="member-tasks-card-crumb-current">{currentLabel}</span>
        </nav>
      </div>
      <hr className="member-tasks-card-header-divider" />
    </>
  );
};

export default MemberTasksPageCardHeader;
