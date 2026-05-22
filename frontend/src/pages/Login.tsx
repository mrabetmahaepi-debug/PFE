import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getRoleKey } from '../lib/permissions';
import type { User } from '../types/auth.types';
import { cn } from '../lib/cn';
import { cu } from '../lib/cu-styles';
import { appPaths } from '../lib/workspaceRoutes';

const REMEMBER_KEY = 'auth.rememberEmail';

const routeForUser = (user: User) => {
  const key = getRoleKey(user);
  switch (key) {
    case 'SUPERADMIN':
      return '/enterprises';
    case 'ADMIN':
      return appPaths.dashboard;
    case 'CHEF_DE_PROJET':
    case 'MEMBRE':
      return appPaths.home;
    default:
      return appPaths.home;
  }
};

type LoginLocationState = { flashMessage?: string } | null;

const Login: React.FC = () => {
  const initialEmail = typeof window !== 'undefined'
    ? window.localStorage.getItem(REMEMBER_KEY) || ''
    : '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!initialEmail);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const st = location.state as LoginLocationState;
    if (st?.flashMessage) {
      setInfoMessage(st.flashMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  React.useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(routeForUser(user));
    }
  }, [isAuthenticated, user, navigate, loading]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>Vérification de la session...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const userData = await login({ email, password });

      if (remember) {
        window.localStorage.setItem(REMEMBER_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }

      navigate(routeForUser(userData));
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: Record<string, unknown> };
        message?: string;
        code?: string;
      };
      const data = ax.response?.data;
      const status = ax.response?.status;

      const isNetworkError =
        ax.response == null &&
        (ax.code === 'ERR_NETWORK' ||
          String(ax.message || '').toLowerCase().includes('network'));

      if (isNetworkError) {
        setError(
          "Impossible de joindre l'API. Démarrez le backend (port 5000 par défaut). En développement, ne définissez pas VITE_API_URL pour utiliser le proxy Vite, ou corrigez VITE_API_URL / VITE_DEV_BACKEND_PORT si le port diffère."
        );
        return;
      }

      /** Vite proxy returns 502 when the upstream (backend) is down or refuses the connection. */
      if (status === 502 || status === 503 || status === 504) {
        setError(
          "Le serveur API ne répond pas (erreur proxy / passerelle). Démarrez le backend dans un terminal : `cd backend` puis `npm run dev`, ou depuis la racine du dépôt : `npm run dev`. Vérifiez que le port (défaut 5000) correspond à VITE_DEV_BACKEND_PORT / VITE_DEV_BACKEND_URL."
        );
        return;
      }

      if (status === 429) {
        const retrySec =
          typeof data?.retryAfterSeconds === 'number'
            ? data.retryAfterSeconds
            : undefined;
        const mins =
          retrySec != null ? Math.max(1, Math.ceil(retrySec / 60)) : undefined;
        const msg =
          (typeof data?.message === 'string' && data.message) ||
          (mins != null
            ? `Trop de tentatives. Réessayez dans ${mins} minute${mins > 1 ? 's' : ''}.`
            : 'Trop de tentatives. Réessayez plus tard.');
        setError(msg);
        return;
      }

      const code = data?.code as string | undefined;
      const zodExtra =
        Array.isArray(data?.errors) && (data!.errors as { message?: string }[]).length
          ? (data!.errors as { message?: string }[])
              .map((e) => e.message)
              .filter(Boolean)
              .join(' ')
          : '';
      const backendMsg =
        (typeof data?.message === 'string' && data.message) ||
        (typeof ax.message === 'string' && ax.message) ||
        '';
      const byCode: Record<string, string> = {
        AUTH_INVALID: backendMsg || "Identifiants invalides.",
        AUTH_PENDING:
          backendMsg ||
          "Votre compte est en attente de validation par un administrateur.",
        AUTH_REJECTED:
          backendMsg ||
          "Votre demande d'inscription a été refusée.",
        AUTH_INACTIVE:
          backendMsg ||
          "Votre compte n'est pas actif. Contactez un administrateur.",
        AUTH_INVITATION_PENDING:
          backendMsg ||
          "Votre invitation n'est pas encore finalisée. Ouvrez le lien reçu par e-mail pour définir votre mot de passe, ou demandez un nouvel envoi à votre administrateur.",
        AUTH_DB_SCHEMA:
          backendMsg ||
          "Service temporairement indisponible. Contactez l'administrateur système.",
        AUTH_RATE_LIMITED:
          backendMsg ||
          "Trop de tentatives. Réessayez plus tard.",
      };
      const fallback =
        (typeof data?.error === 'string' && data.error) || zodExtra || backendMsg;
      setError(
        (code && byCode[code]) ||
          backendMsg ||
          (fallback ? String(fallback) : null) ||
          "Identifiants invalides."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center bg-cu-app p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(cu.card, 'auth-card w-full max-w-[440px] p-10')}
      >
        <div className="auth-header mb-8 text-center">
          <div className="auth-logo mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-cu-primary text-xl font-extrabold text-white">
            GP
          </div>
          <h1 className="auth-title-gradient text-3xl font-extrabold tracking-tight text-cu-primary">
            Bienvenue
          </h1>
        </div>

        {infoMessage && (
          <div className="auth-info">
            <CheckCircle2 size={18} />
            <span>{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
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

          <div className="form-group">
            <label>Mot de passe</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="auth-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Se souvenir de moi</span>
            </label>
            <Link to="/forgot-password" className="forgot-password">
              Mot de passe oublié ?
            </Link>
          </div>

          <button type="submit" className={cn(cu.btnPrimary, 'auth-submit mt-2 w-full py-3')} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="loader-small" />
            ) : (
              <>
                <LogIn size={20} />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Pas encore de compte ? <Link to="/register">S'inscrire</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
