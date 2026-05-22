import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  invitationService,
  type InvitationLookup,
} from '../services/invitation.service';
import './AcceptInvitation.css';

type ValidationErrors = Partial<{
  fullName: string;
  password: string;
  confirmPassword: string;
}>;

const passwordRules = [
  { test: (v: string) => v.length >= 8, label: 'Au moins 8 caractères' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Une minuscule' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Une majuscule' },
  { test: (v: string) => /[0-9]/.test(v), label: 'Un chiffre' },
];

const splitFullName = (raw: string): { prenom: string; nom: string } => {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { prenom: '', nom: '' };
  if (tokens.length === 1) return { prenom: tokens[0], nom: tokens[0] };
  const [prenom, ...rest] = tokens;
  return { prenom, nom: rest.join(' ') };
};

const AcceptInvitation: React.FC = () => {
  const params = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const token =
    (params.token || searchParams.get('token') || '').trim() || undefined;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [serverError, setServerError] = useState('');
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

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
        if (cancelled) return;
        setInvitation(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setServerError(
          err.response?.data?.message || "Lien d'invitation invalide ou expiré.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!invitation) return;
    const suggested = [invitation.prenom, invitation.nom]
      .filter((s) => s && String(s).trim())
      .join(' ')
      .trim();
    if (!suggested) return;
    setFormData((f) => ({
      ...f,
      fullName: f.fullName.trim() ? f.fullName : suggested,
    }));
  }, [invitation]);

  const validate = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    if (!formData.fullName.trim()) {
      errors.fullName = 'Nom complet requis';
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Nom trop court';
    }
    const failedRules = passwordRules.filter(
      (rule) => !rule.test(formData.password),
    );
    if (failedRules.length > 0) {
      errors.password = `Mot de passe invalide : ${failedRules
        .map((r) => r.label.toLowerCase())
        .join(', ')}`;
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errors = validate();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0 || !token) return;

    setSubmitting(true);
    try {
      const { prenom, nom } = splitFullName(formData.fullName);
      const response = await invitationService.acceptByToken(token, {
        prenom,
        nom,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      const msg =
        response?.message ||
        'Compte activé avec succès. Vous pouvez vous connecter.';
      setSuccessMessage(msg);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { flashMessage: msg },
        });
      }, 1200);
    } catch (err: any) {
      setServerError(
        err.response?.data?.message ||
          "Impossible d'accepter l'invitation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const passwordStrength = useMemo(() => {
    const passed = passwordRules.filter((rule) =>
      rule.test(formData.password),
    ).length;
    if (formData.password.length === 0) return { score: 0, label: '' };
    if (passed <= 1) return { score: 1, label: 'Faible' };
    if (passed === 2) return { score: 2, label: 'Moyen' };
    if (passed === 3) return { score: 3, label: 'Bon' };
    return { score: 4, label: 'Excellent' };
  }, [formData.password]);

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

  if (success) {
    return (
      <div className="onboarding-page">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="onboarding-card onboarding-success-card"
        >
          <div className="onboarding-success-icon">
            <CheckCircle2 size={32} />
          </div>
          <h1>Compte activé</h1>
          <p>{successMessage}</p>
          <Link to="/login" className="onboarding-link">
            Aller à la connexion
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    );
  }

  const workspaceName = invitation?.entreprise || "votre espace de travail";
  const roleName = invitation?.role || 'Membre';
  const inviterName = invitation?.inviter?.name || null;

  return (
    <div className="onboarding-page">
      <div className="onboarding-shell">
        {/* Left: hero / brand panel */}
        <motion.aside
          className="onboarding-hero"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="onboarding-brand">
            <div className="onboarding-brand-mark">
              <Sparkles size={14} />
            </div>
            <span>GestionPro</span>
          </div>

          <div className="onboarding-hero-body">
            <span className="onboarding-eyebrow">Accepter l&apos;invitation</span>
            <h1>{workspaceName}</h1>
            {inviterName && (
              <p className="onboarding-inviter">
                <strong>{inviterName}</strong> vous invite à collaborer
                {invitation?.inviter?.email && (
                  <> <span className="dot">·</span> <span>{invitation.inviter.email}</span></>
                )}
              </p>
            )}

            <ul className="onboarding-features">
              <li>
                <ShieldCheck size={16} />
                <span>
                  Rôle attribué :{' '}
                  <strong className="onboarding-role-chip">{roleName}</strong>
                </span>
              </li>
              <li>
                <Building2 size={16} />
                <span>
                  Espace de travail dédié à <strong>{workspaceName}</strong>
                </span>
              </li>
              <li>
                <Mail size={16} />
                <span>
                  Email pré-rempli :{' '}
                  <strong>{invitation?.email}</strong>
                </span>
              </li>
            </ul>
          </div>

          <p className="onboarding-hero-footer">
            En continuant, vous acceptez les conditions d'utilisation et la
            politique de confidentialité de la plateforme.
          </p>
        </motion.aside>

        {/* Right: onboarding form */}
        <motion.main
          className="onboarding-card"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <header className="onboarding-card-header">
            <h2>Accepter l&apos;invitation</h2>
            <p>
              Quelques détails et c'est parti — votre compte sera activé
              avec le rôle <strong>{roleName}</strong>.
            </p>
          </header>

          {serverError && (
            <div className="onboarding-banner">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="onboarding-form">
            <div className="onboarding-field">
              <label htmlFor="ob-email">Email</label>
              <div className="onboarding-input">
                <Mail size={16} className="onboarding-input-icon" />
                <input
                  id="ob-email"
                  type="email"
                  value={invitation?.email || ''}
                  disabled
                />
              </div>
              <small className="onboarding-help">
                Cet email est défini par votre invitation et ne peut pas
                être modifié.
              </small>
            </div>

            <div className="onboarding-field">
              <label htmlFor="ob-name">
                Prénom et nom <span className="onboarding-required">*</span>
              </label>
              <div
                className={`onboarding-input ${
                  validationErrors.fullName ? 'has-error' : ''
                }`}
              >
                <User size={16} className="onboarding-input-icon" />
                <input
                  id="ob-name"
                  type="text"
                  placeholder="Jean Dupont"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, fullName: e.target.value }))
                  }
                  autoFocus
                  required
                />
              </div>
              {validationErrors.fullName && (
                <small className="onboarding-error-text">
                  {validationErrors.fullName}
                </small>
              )}
            </div>

            <div className="onboarding-field">
              <label htmlFor="ob-password">
                Nouveau mot de passe <span className="onboarding-required">*</span>
              </label>
              <div
                className={`onboarding-input ${
                  validationErrors.password ? 'has-error' : ''
                }`}
              >
                <Lock size={16} className="onboarding-input-icon" />
                <input
                  id="ob-password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                />
              </div>
              {formData.password.length > 0 && (
                <div
                  className={`onboarding-strength score-${passwordStrength.score}`}
                  aria-live="polite"
                >
                  <div className="onboarding-strength-bar">
                    <span style={{ width: `${(passwordStrength.score / 4) * 100}%` }} />
                  </div>
                  <span className="onboarding-strength-label">
                    {passwordStrength.label}
                  </span>
                </div>
              )}
              <ul className="onboarding-rules" aria-label="Règles du mot de passe">
                {passwordRules.map((rule) => {
                  const valid = rule.test(formData.password);
                  return (
                    <li
                      key={rule.label}
                      className={valid ? 'valid' : 'idle'}
                    >
                      {valid ? '✓' : '○'} {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="onboarding-field">
              <label htmlFor="ob-confirm">
                Confirmer le mot de passe{' '}
                <span className="onboarding-required">*</span>
              </label>
              <div
                className={`onboarding-input ${
                  validationErrors.confirmPassword ? 'has-error' : ''
                }`}
              >
                <Lock size={16} className="onboarding-input-icon" />
                <input
                  id="ob-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      confirmPassword: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              {validationErrors.confirmPassword && (
                <small className="onboarding-error-text">
                  {validationErrors.confirmPassword}
                </small>
              )}
            </div>

            <button
              type="submit"
              className="onboarding-submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className="onboarding-spinner-sm" aria-hidden />
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Activer mon compte
                </>
              )}
            </button>

            <p className="onboarding-footer">
              Déjà un compte ? <Link to="/login">Se connecter</Link>
            </p>
          </form>
        </motion.main>
      </div>
    </div>
  );
};

export default AcceptInvitation;
