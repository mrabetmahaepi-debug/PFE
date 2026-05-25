import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Building2,
  Shield,
  Calendar,
  Activity,
  Briefcase,
} from 'lucide-react';
import { teamService } from '../services/team.service';
import type { User } from '../types/auth.types';
import { displayGlobalAccountRole } from '../lib/accountRoleDisplay';
import BackButton from '../components/BackButton';
import UserAvatar from '../components/UserAvatar';
import './UserDetail.css';

type UserDetailRecord = User & {
  createdAt?: string | null;
  photoUrl?: string | null;
};

function normalizeRoleKey(nom: string): string {
  return String(nom ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '');
}

function memberStatutUpper(member: User): string {
  return (member.statut || '').trim().toUpperCase();
}

function roleBadgeClass(roleLabel: string): string {
  const key = normalizeRoleKey(roleLabel);
  if (key === 'SUPERADMIN' || key === 'ADMIN' || key === 'ADMINISTRATEUR' || key === 'ADMINENTREPRISE') {
    return 'user-detail-role-badge user-detail-role-badge--admin';
  }
  if (key.includes('CHEF') || key.includes('PROJET') || key === 'PM' || key.includes('LEAD')) {
    return 'user-detail-role-badge user-detail-role-badge--chef';
  }
  if (key.includes('DESIGN')) return 'user-detail-role-badge user-detail-role-badge--designer';
  if (key.includes('ANALYST')) return 'user-detail-role-badge user-detail-role-badge--analyste';
  if (key.includes('DEV') || key.includes('DEVELOP')) {
    return 'user-detail-role-badge user-detail-role-badge--dev';
  }
  return 'user-detail-role-badge user-detail-role-badge--default';
}

function projectBadgeClass(roleProjet?: string): string {
  const key = normalizeRoleKey(roleProjet || '');
  if (key.includes('CHEF') || key.includes('PROJET') || key === 'PM') {
    return 'user-detail-project-badge user-detail-project-badge--chef';
  }
  if (key.includes('DESIGN')) return 'user-detail-project-badge user-detail-project-badge--designer';
  if (key.includes('ANALYST')) return 'user-detail-project-badge user-detail-project-badge--analyste';
  return 'user-detail-project-badge';
}

function formatJoinedDate(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function isMemberOnline(member: UserDetailRecord): boolean {
  return member.isOnline === true;
}

function renderStatusBadge(member: UserDetailRecord): React.ReactNode {
  const statut = memberStatutUpper(member);
  if (statut === 'INVITATION_PENDING') {
    return (
      <span className="user-detail-statut-badge user-detail-statut-invitation">
        Invitation envoyée
      </span>
    );
  }
  if (statut === 'PENDING') {
    return (
      <span className="user-detail-statut-badge user-detail-statut-pending">En attente</span>
    );
  }

  const online = isMemberOnline(member);
  return (
    <motion.span
      key={online ? 'online' : 'offline'}
      className={`user-detail-statut-badge ${online ? 'user-detail-statut-active' : 'user-detail-statut-inactive'}`}
      initial={{ opacity: 0.88, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
      aria-label={online ? 'Actif — connecté' : 'Inactif — hors ligne'}
    >
      <span
        className={`user-detail-statut-dot${online ? ' is-pulsing' : ''}`}
        aria-hidden
      />
      {online ? 'Actif' : 'Inactif'}
    </motion.span>
  );
}

function statusFieldLabel(member: UserDetailRecord): string {
  const statut = memberStatutUpper(member);
  if (statut === 'INVITATION_PENDING') return 'Invitation envoyée';
  if (statut === 'PENDING') return 'En attente';
  return isMemberOnline(member) ? 'Actif' : 'Inactif';
}

type InfoFieldProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

function InfoField({ icon, label, value }: InfoFieldProps) {
  return (
    <div className="user-detail-field">
      <div className="user-detail-field-icon" aria-hidden>
        {icon}
      </div>
      <div className="user-detail-field-body">
        <span className="user-detail-field-label">{label}</span>
        <div className="user-detail-field-value">{value}</div>
      </div>
    </div>
  );
}

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<UserDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const PRESENCE_POLL_MS = 30_000;

    const fetchDetail = async (initial = false) => {
      if (initial) {
        setLoading(true);
        setError(false);
      }
      try {
        const data = await teamService.getMemberById(id);
        if (!cancelled) {
          setMember(data as UserDetailRecord);
          if (initial) setError(false);
        }
      } catch (err) {
        console.error('Failed to fetch user detail:', err);
        if (!cancelled && initial) setError(true);
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    void fetchDetail(true);

    const intervalId = window.setInterval(() => {
      void fetchDetail(false);
    }, PRESENCE_POLL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchDetail(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="dashboard-page user-detail-page">
        <div className="user-detail-loading" role="status" aria-live="polite">
          <div className="loader" />
          <span>Chargement du profil…</span>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="dashboard-page user-detail-page">
        <BackButton fallback="/team" />
        <div className="user-detail-error" role="alert">
          <p>Utilisateur introuvable.</p>
          <button type="button" className="user-detail-error-btn" onClick={() => navigate('/team')}>
            Retour à l&apos;équipe
          </button>
        </div>
      </div>
    );
  }

  const fullName = `${member.prenom ?? ''} ${member.nom ?? ''}`.trim() || 'Utilisateur';
  const roleLabel = displayGlobalAccountRole(member);
  const enterpriseName = member.entreprise?.nom || 'Indépendant';
  const canOpenEnterprise = Boolean(member.id_entreprise);
  const projects = member.projects?.filter((p) => p?.name) ?? [];
  const showProjects = projects.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-page user-detail-page"
    >
      <BackButton fallback="/team" />

      <header className="user-detail-card user-detail-header-card">
        <div className="user-detail-header-inner">
          <UserAvatar
            user={member}
            className="user-detail-avatar"
            imgClassName="user-detail-avatar"
            title={fullName}
          />
          <div className="user-detail-hero-main">
            <h1 className="user-detail-name">{fullName}</h1>
            <div className="user-detail-header-meta">
              <span className={roleBadgeClass(roleLabel)}>{roleLabel}</span>
              {member.poste ? (
                <span className="user-detail-poste">{member.poste}</span>
              ) : null}
              {renderStatusBadge(member)}
            </div>
          </div>
        </div>
      </header>

      <div className="user-detail-cards-grid">
        <section
          className="user-detail-card user-detail-profile-card"
          aria-labelledby="user-detail-info-title"
        >
          <h2 id="user-detail-info-title" className="user-detail-card-title">
            Informations du profil
          </h2>
          <div className="user-detail-fields user-detail-fields--profile">
            <InfoField icon={<Mail size={16} />} label="Email" value={member.email} />
            <InfoField
              icon={<Activity size={16} />}
              label="Statut"
              value={statusFieldLabel(member)}
            />
            <InfoField
              icon={<Shield size={16} />}
              label="Association plateforme"
              value={roleLabel}
            />
            <InfoField
              icon={<Calendar size={16} />}
              label="Date d'inscription"
              value={formatJoinedDate(member.createdAt)}
            />
          </div>
        </section>

        <section
          className="user-detail-card user-detail-enterprise-card"
          aria-labelledby="user-detail-enterprise-title"
        >
          <h2 id="user-detail-enterprise-title" className="user-detail-card-title">
            Entreprise
          </h2>
          <div className="user-detail-enterprise-body">
            {canOpenEnterprise ? (
              <button
                type="button"
                className="user-detail-enterprise-pill is-clickable"
                onClick={() => navigate(`/enterprises/${member.id_entreprise}`)}
                aria-label={`Voir l'entreprise ${enterpriseName}`}
              >
                <Building2 size={18} aria-hidden />
                <span className="user-detail-enterprise-text">
                  <span className="user-detail-enterprise-label">Entreprise</span>
                  <strong>{enterpriseName}</strong>
                </span>
              </button>
            ) : (
              <div className="user-detail-enterprise-pill" role="text">
                <Building2 size={18} aria-hidden />
                <span className="user-detail-enterprise-text">
                  <span className="user-detail-enterprise-label">Entreprise</span>
                  <strong>{enterpriseName}</strong>
                </span>
              </div>
            )}
          </div>
        </section>

        {showProjects ? (
          <section
            className="user-detail-card user-detail-projects-card"
            aria-labelledby="user-detail-projects-title"
          >
            <h2 id="user-detail-projects-title" className="user-detail-card-title">
              <Briefcase size={18} aria-hidden />
              Projets associés
            </h2>
            <ul className="user-detail-projects-list">
              {projects.map((project) => (
                <li key={project.id} className="user-detail-project-item">
                  <span className="user-detail-project-name">{project.name}</span>
                  {project.roleProjet ? (
                    <span className={projectBadgeClass(project.roleProjet)}>
                      {project.roleProjet}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </motion.div>
  );
};

export default UserDetail;
