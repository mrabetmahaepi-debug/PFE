import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Building2,
  Shield,
  Calendar,
  Activity,
} from 'lucide-react';
import { teamService } from '../services/team.service';
import type { User } from '../types/auth.types';
import BackButton from '../components/BackButton';
import './UserDetail.css';

const API_ORIGIN =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';

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

function rawGlobalRoleNom(member: User): string {
  const raw = typeof member.role === 'object' ? member.role?.nom : member.role;
  return String(raw ?? '').trim();
}

function displayGlobalAccountRole(member: User): string {
  const raw = rawGlobalRoleNom(member);
  if (!raw) return 'Membre';
  const key = normalizeRoleKey(raw);
  if (key === 'SUPERADMIN') return 'Super Admin';
  if (key === 'ADMIN' || key === 'ADMINISTRATEUR' || key === 'ADMINENTREPRISE') return 'Admin';
  if (key === 'MEMBRE' || key === 'MEMBER') return 'Membre';
  return raw;
}

function memberStatutUpper(member: User): string {
  return (member.statut || '').trim().toUpperCase();
}

function getInitials(prenom?: string, nom?: string): string {
  const a = (prenom?.[0] ?? '').toUpperCase();
  const b = (nom?.[0] ?? '').toUpperCase();
  return `${a}${b}` || '?';
}

function avatarUrl(member: UserDetailRecord): string | null {
  const photo = member.photoUrl;
  if (photo) {
    return photo.startsWith('http') ? photo : `${API_ORIGIN}${photo}`;
  }
  return null;
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

/** Mirrors backend `computePresenceOnline` — connection state, not account statut. */
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
          <button type="button" className="primary-btn" onClick={() => navigate('/team')}>
            Retour à l&apos;équipe
          </button>
        </div>
      </div>
    );
  }

  const fullName = `${member.prenom ?? ''} ${member.nom ?? ''}`.trim() || 'Utilisateur';
  const roleLabel = displayGlobalAccountRole(member);
  const photo = avatarUrl(member);
  const enterpriseName = member.entreprise?.nom || 'Indépendant';
  const canOpenEnterprise = Boolean(member.id_entreprise);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-page user-detail-page"
    >
      <BackButton fallback="/team" />

      <header className="user-detail-hero">
        <div className="user-detail-avatar" aria-hidden>
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            getInitials(member.prenom, member.nom)
          )}
        </div>
        <div className="user-detail-hero-main">
          <h1 className="user-detail-name">{fullName}</h1>
          <p className="user-detail-role-line">{member.poste || roleLabel}</p>
          {renderStatusBadge(member)}
        </div>
      </header>

      <div className="user-detail-cards-row">
        <section
          className="user-detail-card user-detail-profile-card"
          aria-labelledby="user-detail-info-title"
        >
          <h2 id="user-detail-info-title" className="user-detail-card-title">
            Informations du profil
          </h2>
          <div className="user-detail-fields user-detail-fields--profile">
            <InfoField
              icon={<Mail size={17} />}
              label="Adresse e-mail"
              value={member.email}
            />
            <InfoField
              icon={<Shield size={17} />}
              label="Association plateforme"
              value={roleLabel}
            />
            <InfoField
              icon={<Activity size={17} />}
              label="Statut"
              value={statusFieldLabel(member)}
            />
            <InfoField
              icon={<Calendar size={17} />}
              label="Inscrit sur la plateforme"
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
                <Building2 size={20} aria-hidden />
                <span>
                  Entreprise : <strong>{enterpriseName}</strong>
                </span>
              </button>
            ) : (
              <div className="user-detail-enterprise-pill" role="text">
                <Building2 size={20} aria-hidden />
                <span>
                  Entreprise : <strong>{enterpriseName}</strong>
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default UserDetail;
