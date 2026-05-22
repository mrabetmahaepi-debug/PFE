import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/auth.service';
import './Auth.css';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Veuillez saisir une adresse email valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authService.forgotPassword(trimmed);
      setSuccess(
        result.message ||
          'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.'
      );
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { message?: string; code?: string } };
      };
      const code = ax.response?.data?.code;
      const msg = ax.response?.data?.message;
      if (code === 'AUTH_RESET_EMAIL_NOT_FOUND') {
        setError(msg || 'Aucun compte associé à cet email.');
      } else if (ax.response?.status === 400 || ax.response?.status === 403) {
        setError(msg || "Impossible d'envoyer le lien pour ce compte.");
      } else {
        setError(msg || 'Erreur serveur. Réessayez plus tard.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-card"
      >
        <div className="auth-header">
          <div className="auth-logo">GP</div>
          <h1 className="auth-title-gradient">Mot de passe oublié</h1>
        </div>

        {success ? (
          <div className="auth-info">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        ) : null}

        {error ? (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {!success ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <p className="auth-lead">
              Saisissez votre email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  type="email"
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit auth-submit--gradient"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loader-small" />
              ) : (
                'Envoyer le lien de réinitialisation'
              )}
            </button>
          </form>
        ) : null}

        <div className="auth-footer">
          <Link to="/login" className="auth-back-link">
            <ArrowLeft size={16} />
            Retour à la connexion
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
