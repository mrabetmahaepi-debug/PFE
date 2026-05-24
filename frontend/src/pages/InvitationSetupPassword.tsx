import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  invitationService,
  type InvitationLookup,
} from '../services/invitation.service';
import { passwordRules } from '../lib/passwordRules';
import './AcceptInvitation.css';

type ValidationErrors = Partial<{
  password: string;
  confirmPassword: string;
}>;

const memberSafeMessage = (err: unknown): string => {
  const data = (err as { response?: { data?: { message?: string } } })?.response
    ?.data;
  const msg = data?.message;
  if (msg && typeof msg === 'string') return msg;
  return 'Impossible de finaliser votre inscription. Vérifiez le lien ou contactez votre administrateur.';
};

const InvitationSetupPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    let cancelled = false;
    if (!token?.trim()) {
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

  const validate = (): ValidationErrors => {
    const errors: ValidationErrors = {};
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
    if (Object.keys(errors).length > 0 || !token?.trim() || !invitation) return;

    const prenom = (invitation.prenom || '').trim() || 'Membre';
    const nom = (invitation.nom || '').trim() || '—';

    setSubmitting(true);
    try {
      const response = await invitationService.acceptByToken(token, {
        prenom,
        nom,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      const msg =
        response?.message ||
        'Compte activé. Connectez-vous avec votre email et votre nouveau mot de passe.';
      navigate('/login', {
        replace: true,
        state: { flashMessage: msg },
      });
    } catch (err) {
      setServerError(memberSafeMessage(err));
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
          <p>Préparation de votre compte…</p>
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
          <h1>Configuration du mot de passe</h1>
          <p>{serverError}</p>
          <Link to="/login" className="onboarding-link">
            Retour à la connexion
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <motion.main
        className="onboarding-card onboarding-card-centered"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="onboarding-card-header">
          <h2>Définir votre mot de passe</h2>
          <p>
            Dernière étape pour rejoindre{' '}
            <strong>{invitation?.entreprise || 'votre espace'}</strong>.
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
            <label htmlFor="setup-password">
              Mot de passe <span className="onboarding-required">*</span>
            </label>
            <div
              className={`onboarding-input ${
                validationErrors.password ? 'has-error' : ''
              }`}
            >
              <Lock size={16} className="onboarding-input-icon" />
              <input
                id="setup-password"
                type="password"
                autoComplete="new-password"
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
              >
                <div className="onboarding-strength-bar">
                  <span
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                    }}
                  />
                </div>
                <span className="onboarding-strength-label">
                  {passwordStrength.label}
                </span>
              </div>
            )}
            <ul className="onboarding-rules">
              {passwordRules.map((rule) => {
                const valid = rule.test(formData.password);
                return (
                  <li key={rule.label} className={valid ? 'valid' : 'idle'}>
                    {valid ? '✓' : '○'} {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="onboarding-field">
            <label htmlFor="setup-confirm">
              Confirmer mot de passe{' '}
              <span className="onboarding-required">*</span>
            </label>
            <div
              className={`onboarding-input ${
                validationErrors.confirmPassword ? 'has-error' : ''
              }`}
            >
              <Lock size={16} className="onboarding-input-icon" />
              <input
                id="setup-confirm"
                type="password"
                autoComplete="new-password"
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
                <CheckCircle2 size={16} />
                Confirmer et activer mon compte
              </>
            )}
          </button>

          <p className="onboarding-footer">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </form>
      </motion.main>
    </div>
  );
};

export default InvitationSetupPassword;
