import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  FolderKanban,
  Calendar,
} from 'lucide-react';
import {
  invitationService,
  type InvitationLookup,
} from '../services/invitation.service';
import './AcceptInvitation.css';

const AcceptInvitation: React.FC = () => {
  const params = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token =
    (params.token || searchParams.get('token') || '').trim() || undefined;

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setServerError("Lien d'invitation invalide ou expiré.");
      setLoading(false);
      return;
    }
    invitationService
      .lookupByToken(token)
      .then((data) => {
        if (!cancelled) setInvitation(data);
      })
      .catch(() => {
        if (!cancelled) {
          setServerError("Lien d'invitation invalide ou expiré.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = () => {
    if (!token) return;
    navigate(`/invitations/setup-password/${encodeURIComponent(token)}`);
  };

  if (loading) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-loading">
          <div className="onboarding-spinner" />
          <p>Vérification du lien d'invitation…</p>
        </div>
      </div>
    );
  }

  if (serverError && !invitation) {
    return (
      <div className="onboarding-page">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="onboarding-card onboarding-error-card"
        >
          <div className="onboarding-error-icon">
            <AlertCircle size={28} />
          </div>
          <h1>Accepter l&apos;invitation</h1>
          <p>{serverError}</p>
          <Link to="/login" className="onboarding-link">
            Retour à la connexion
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    );
  }

  const workspaceName = invitation?.entreprise || 'votre espace de travail';
  const profileName =
    invitation?.profile || invitation?.poste || invitation?.role || 'Membre';
  const inviterName = invitation?.inviter?.name || null;
  const expiryLabel = invitation?.expires_at
    ? new Date(invitation.expires_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="onboarding-page">
      <div className="onboarding-shell">
        <motion.aside
          className="onboarding-hero"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="onboarding-brand">
            <div className="onboarding-brand-mark">
              <Sparkles size={14} />
            </div>
            <span>GestionPro</span>
          </div>

          <div className="onboarding-hero-body">
            <span className="onboarding-eyebrow">Invitation équipe</span>
            <h1>{workspaceName}</h1>
            {inviterName && (
              <p className="onboarding-inviter">
                <strong>{inviterName}</strong> vous invite à collaborer
              </p>
            )}

            <ul className="onboarding-features">
              <li>
                <ShieldCheck size={16} />
                <span>
                  Profil :{' '}
                  <strong className="onboarding-role-chip">{profileName}</strong>
                </span>
              </li>
              <li>
                <Mail size={16} />
                <span>
                  Email : <strong>{invitation?.email}</strong>
                </span>
              </li>
              {expiryLabel && (
                <li>
                  <Calendar size={16} />
                  <span>
                    Valide jusqu&apos;au <strong>{expiryLabel}</strong>
                  </span>
                </li>
              )}
              {(invitation?.projects?.length ?? 0) > 0 && (
                <li>
                  <FolderKanban size={16} />
                  <span>
                    Projets :{' '}
                    <strong>
                      {invitation!.projects!.map((p) => p.nom).join(', ')}
                    </strong>
                  </span>
                </li>
              )}
              <li>
                <Building2 size={16} />
                <span>Espace {workspaceName}</span>
              </li>
            </ul>
          </div>
        </motion.aside>

        <motion.main
          className="onboarding-card"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <header className="onboarding-card-header">
            <h2>Confirmer l&apos;invitation</h2>
            <p>
              Bonjour{' '}
              <strong>
                {[invitation?.prenom, invitation?.nom]
                  .filter(Boolean)
                  .join(' ') || invitation?.email}
              </strong>
              , validez votre invitation pour configurer votre mot de passe.
            </p>
          </header>

          <button
            type="button"
            className="onboarding-submit"
            onClick={handleAccept}
          >
            <ShieldCheck size={16} />
            Accepter l&apos;invitation
          </button>

          <p className="onboarding-footer">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </motion.main>
      </div>
    </div>
  );
};

export default AcceptInvitation;
