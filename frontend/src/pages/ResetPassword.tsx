import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/auth.service';
import { getPasswordChecks, isPasswordStrong } from '../lib/passwordRules';
import './Auth.css';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token')?.trim() || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordIsStrong = isPasswordStrong(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Lien de réinitialisation invalide. Demandez un nouveau lien.');
      return;
    }

    if (!passwordIsStrong) {
      setError('Veuillez respecter les exigences du mot de passe.');
      return;
    }

    if (!passwordsMatch) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      navigate('/login', {
        replace: true,
        state: {
          flashMessage:
            'Mot de passe mis à jour. Vous pouvez vous connecter avec votre nouveau mot de passe.',
        },
      });
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string; code?: string } };
      };
      const code = ax.response?.data?.code;
      const msg = ax.response?.data?.message;
      if (code === 'AUTH_RESET_TOKEN_EXPIRED') {
        setError(msg || 'Ce lien a expiré. Demandez un nouveau lien de réinitialisation.');
      } else if (code === 'AUTH_RESET_TOKEN_INVALID') {
        setError(msg || 'Lien de réinitialisation invalide.');
      } else {
        setError(msg || 'Erreur lors de la réinitialisation du mot de passe.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="auth-card"
        >
          <div className="auth-header">
            <div className="auth-logo">GP</div>
            <h1 className="auth-title-gradient">Lien invalide</h1>
          </div>
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>Ce lien de réinitialisation est invalide ou incomplet.</span>
          </div>
          <div className="auth-footer">
            <Link to="/forgot-password">Demander un nouveau lien</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-card"
      >
        <div className="auth-header">
          <div className="auth-logo">GP</div>
          <h1 className="auth-title-gradient">Nouveau mot de passe</h1>
        </div>

        {error ? (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Nouveau mot de passe</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <ul className="password-rules">
              {passwordChecks.map((c) => (
                <li
                  key={c.label}
                  className={c.valid ? 'password-rule--valid' : 'password-rule--pending'}
                >
                  {c.valid ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="form-group">
            <label>Confirmer mot de passe</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {confirmPassword.length > 0 && !passwordsMatch ? (
              <p className="field-error" role="alert">
                Les mots de passe ne correspondent pas.
              </p>
            ) : null}
            {passwordsMatch && confirmPassword.length > 0 ? (
              <p className="auth-match-hint">
                <CheckCircle2 size={14} />
                Les mots de passe correspondent
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="auth-submit auth-submit--gradient"
            disabled={isSubmitting || !passwordIsStrong || !passwordsMatch}
          >
            {isSubmitting ? <span className="loader-small" /> : 'Réinitialiser le mot de passe'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">Retour à la connexion</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
