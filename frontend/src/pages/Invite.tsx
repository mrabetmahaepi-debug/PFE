import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  User,
  Send,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings,
  Calendar,
  FolderKanban,
  Shield,
} from 'lucide-react';
import {
  invitationService,
  type TeamInvitationResult,
  type TeamInvitationResponse,
  type InvitationSmtpSetupError,
} from '../services/invitation.service';
import { projectService } from '../services/project.service';
import type { Projet } from '../types/project';
import { INVITATION_PROFILE_OPTIONS } from '../lib/invitationProfiles';
import './Invite.css';

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isInvitationCreated = (r: TeamInvitationResult): r is Extract<
  TeamInvitationResult,
  { status: 'created' | 'sent' }
> => r.status === 'created' || r.status === 'sent';

const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
};

const defaultExpiryIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return d.toISOString().slice(0, 16);
};

const Invite: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [poste, setPoste] = useState<string>(INVITATION_PROFILE_OPTIONS[1]);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [expiresAt, setExpiresAt] = useState(defaultExpiryIso);
  const [projects, setProjects] = useState<Projet[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [smtpSetupError, setSmtpSetupError] =
    useState<InvitationSmtpSetupError | null>(null);
  const [results, setResults] = useState<TeamInvitationResult[]>([]);
  const [responseMeta, setResponseMeta] = useState<
    Pick<
      TeamInvitationResponse,
      'message' | 'workspace' | 'email_configured' | 'summary' | 'warning'
    > | null
  >(null);
  const [copiedLinkEmail, setCopiedLinkEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    projectService
      .getAll()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(
    () =>
      !submitting &&
      isValidEmail(email) &&
      prenom.trim().length >= 1 &&
      nom.trim().length >= 1 &&
      poste.trim().length > 0 &&
      projectIds.length > 0 &&
      !!expiresAt &&
      new Date(expiresAt).getTime() > Date.now(),
    [submitting, email, prenom, nom, poste, projectIds, expiresAt],
  );

  const toggleProject = (id: number) => {
    setProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      setFormError('Indiquez une adresse email valide');
      return;
    }
    if (prenom.trim().length < 1 || nom.trim().length < 1) {
      setFormError('Prénom et nom sont requis');
      return;
    }
    if (projectIds.length === 0) {
      setFormError('Sélectionnez au moins un projet accessible');
      return;
    }
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      setFormError("La date d'expiration doit être dans le futur");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSmtpSetupError(null);
    setResults([]);
    setResponseMeta(null);

    try {
      const data = await invitationService.sendTeamInvitations({
        emails: [trimmedEmail],
        prenom: prenom.trim(),
        nom: nom.trim(),
        poste,
        project_ids: projectIds,
        expires_at: expiry.toISOString(),
      });
      setResults(data.results);
      setResponseMeta({
        message: data.message,
        workspace: data.workspace,
        email_configured: data.email_configured,
        summary: data.summary,
        warning: data.warning,
      });

      const createdRows = data.results.filter(isInvitationCreated);
      const deliveredOk = createdRows.filter(
        (r) => r.emailStatus === 'sent' || r.email_delivery === 'sent',
      ).length;
      const failedTransport = createdRows.filter(
        (r) => r.emailStatus === 'failed' || r.email_delivery === 'failed',
      ).length;
      const pendingTransport = createdRows.filter(
        (r) => r.emailStatus === 'pending',
      ).length;

      if (deliveredOk > 0) {
        setToast({
          type: 'success',
          message: data.message || 'Invitation envoyée par email.',
        });
      } else if (createdRows.length > 0) {
        setToast({
          type: 'warning',
          message:
            data.warning ||
            "Invitation créée. L'email n'a pas pu être envoyé — copiez le lien ci-dessous.",
        });
      } else {
        const hardErr = data.results.find((r) => r.status === 'error');
        setToast({
          type: hardErr ? 'error' : 'warning',
          message:
            hardErr?.status === 'error'
              ? hardErr.reason
              : data.message || 'Aucune invitation créée',
        });
      }

      if (
        createdRows.length > 0 &&
        deliveredOk === 0 &&
        (failedTransport > 0 || pendingTransport > 0)
      ) {
        // keep email for retry / copy link
      } else if (deliveredOk > 0) {
        setEmail('');
        setPrenom('');
        setNom('');
        setProjectIds([]);
      }
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      const status = anyErr.response?.status;
      const data = anyErr.response?.data as
        | (Partial<TeamInvitationResponse> & Partial<InvitationSmtpSetupError>)
        | undefined;

      const is503Config =
        status === 503 &&
        (data?.code === 'EMAIL_NOT_CONFIGURED' ||
          data?.code === 'SMTP_NOT_CONFIGURED');

      if (is503Config) {
        const m =
          data?.message ||
          "L'envoi d'email n'est pas configuré sur ce serveur.";
        setSmtpSetupError({
          code: (data!.code ?? 'EMAIL_NOT_CONFIGURED') as
            | 'EMAIL_NOT_CONFIGURED'
            | 'SMTP_NOT_CONFIGURED',
          message: m,
          hint: data?.hint,
        });
        setToast({ type: 'warning', message: m });
      } else {
        if (Array.isArray(data?.results)) {
          setResults(data.results as TeamInvitationResult[]);
        }
        const msg =
          data?.message ||
          anyErr.message ||
          "Une erreur est survenue lors de l'envoi";
        setSubmitError(msg);
        setToast({ type: 'error', message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const createdCount = results.filter(isInvitationCreated).length;
  const deliveredCount = results.filter(
    (r) =>
      isInvitationCreated(r) &&
      (r.emailStatus === 'sent' || r.email_delivery === 'sent'),
  ).length;

  const handleCopyLink = async (targetEmail: string, link: string) => {
    try {
      await copyText(link);
      setCopiedLinkEmail(targetEmail);
      window.setTimeout(() => setCopiedLinkEmail(null), 2500);
    } catch {
      setToast({
        type: 'error',
        message: 'Impossible de copier le lien.',
      });
    }
  };

  return (
    <div className="invite-page invite-page--admin">
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`invite-toast invite-toast-${toast.type}`}
            role="alert"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} aria-hidden />
            ) : (
              <AlertCircle size={18} aria-hidden />
            )}
            <span className="invite-toast-text">{toast.message}</span>
            <button
              type="button"
              className="invite-toast-close"
              onClick={() => setToast(null)}
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="invite-header">
        <div className="invite-header-copy">
          <h1>Inviter un membre</h1>
          <p className="invite-header-sub">
            Invitez une personne à rejoindre votre espace de travail.
          </p>
        </div>
        <button
          type="submit"
          form="invite-form"
          className="invite-btn invite-btn--primary invite-header-submit"
          disabled={!canSubmit}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden />
              Envoi…
            </>
          ) : (
            <>
              <Send size={16} aria-hidden />
              Inviter
            </>
          )}
        </button>
      </header>

      {smtpSetupError && (
        <motion.div
          className="invite-banner invite-banner-setup"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
        >
          <div className="invite-banner-icon">
            <Settings size={18} />
          </div>
          <div className="invite-banner-body">
            <strong>Configuration email</strong>
            <p>{smtpSetupError.message}</p>
            <p className="invite-banner-hint">
              Vous pouvez tout de même créer l&apos;invitation et copier le lien
              manuellement.
            </p>
          </div>
        </motion.div>
      )}

      <div className="invite-card">
        <form id="invite-form" onSubmit={handleSubmit} className="invite-form">
          <div className="invite-field invite-field--full">
            <label className="invite-label" htmlFor="invite-email">
              <Mail size={14} aria-hidden />
              Email du membre
            </label>
            <div className="invite-input-wrap">
              <input
                id="invite-email"
                type="email"
                className="invite-input"
                placeholder="membre@entreprise.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                }}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="invite-field-row">
            <div className="invite-field">
              <label className="invite-label" htmlFor="invite-prenom">
                <User size={14} aria-hidden />
                Prénom
              </label>
              <div className="invite-input-wrap">
                <input
                  id="invite-prenom"
                  type="text"
                  className="invite-input"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="invite-field">
              <label className="invite-label" htmlFor="invite-nom">
                <User size={14} aria-hidden />
                Nom
              </label>
              <div className="invite-input-wrap">
                <input
                  id="invite-nom"
                  type="text"
                  className="invite-input"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="invite-field invite-field--full">
            <label className="invite-label" htmlFor="invite-poste">
              <Shield size={14} aria-hidden />
              Profil de permissions
            </label>
            <div className="invite-input-wrap">
              <select
                id="invite-poste"
                className="invite-input invite-select"
                value={poste}
                onChange={(e) => setPoste(e.target.value)}
                required
              >
                {INVITATION_PROFILE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <p className="invite-field-hint">
              L&apos;espace membre s&apos;adapte aux permissions du profil (pas au
              rôle global).
            </p>
          </div>

          <div className="invite-field invite-field--full">
            <label className="invite-label">
              <FolderKanban size={14} aria-hidden />
              Projets accessibles
            </label>
            {projectsLoading ? (
              <p className="invite-field-hint">Chargement des projets…</p>
            ) : projects.length === 0 ? (
              <p className="invite-inline-error">
                <AlertCircle size={14} />
                <span>Aucun projet disponible. Créez un projet d&apos;abord.</span>
              </p>
            ) : (
              <div className="invite-project-grid" role="group">
                {projects.map((p) => {
                  const selected = projectIds.includes(p.id_projet);
                  return (
                    <button
                      key={p.id_projet}
                      type="button"
                      className={`invite-project-chip ${selected ? 'selected' : ''}`}
                      onClick={() => toggleProject(p.id_projet)}
                      aria-pressed={selected}
                    >
                      {p.nom_p}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="invite-field invite-field--full">
            <label className="invite-label" htmlFor="invite-expires">
              <Calendar size={14} aria-hidden />
              Date expiration
            </label>
            <div className="invite-input-wrap">
              <input
                id="invite-expires"
                type="datetime-local"
                className="invite-input"
                value={expiresAt}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
              />
            </div>
          </div>

          {formError && (
            <p className="invite-inline-error">
              <AlertCircle size={14} />
              <span>{formError}</span>
            </p>
          )}

          {submitError && !smtpSetupError && (
            <div className="invite-banner invite-banner-error">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <div className="invite-form-footer">
            <button
              type="button"
              className="invite-btn invite-btn--ghost"
              onClick={() => navigate('/team')}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="invite-btn invite-btn--primary"
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" aria-hidden />
                  Envoi…
                </>
              ) : (
                <>
                  <Send size={16} aria-hidden />
                  Inviter
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.section
            className="invite-results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <header className="invite-results-header">
              <h2>Résultat</h2>
              {responseMeta?.message && (
                <p className="invite-results-note">
                  {deliveredCount > 0 ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  <span>{responseMeta.message}</span>
                </p>
              )}
            </header>

            <ul className="invite-results-list">
              {results.map((res) => {
                if (isInvitationCreated(res)) {
                  const delivered =
                    res.emailStatus === 'sent' || res.email_delivery === 'sent';
                  return (
                    <li
                      key={`created-${res.token}`}
                      className={`invite-result ${
                        delivered ? 'success' : 'warning'
                      }`}
                    >
                      <div className="invite-result-main">
                        {delivered ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <AlertCircle size={16} />
                        )}
                        <div>
                          <span className="invite-result-email">{res.email}</span>
                          <small>
                            {delivered
                              ? 'Email envoyé au membre'
                              : "Invitation créée — copiez le lien si l'email n'est pas arrivé"}
                            {res.expires_at && (
                              <>
                                {' '}
                                · Expire le{' '}
                                {new Date(res.expires_at).toLocaleString('fr-FR')}
                              </>
                            )}
                          </small>
                          {!delivered && (
                            <div className="invite-result-link-row">
                              <input
                                className="invite-result-link-input"
                                readOnly
                                value={res.link}
                                aria-label={`Lien pour ${res.email}`}
                              />
                              <button
                                type="button"
                                className="invite-result-copy-btn"
                                onClick={() =>
                                  void handleCopyLink(res.email, res.link)
                                }
                              >
                                {copiedLinkEmail === res.email
                                  ? 'Copié'
                                  : "Copier le lien d'invitation"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li
                    key={`${res.status}-${res.email}`}
                    className={`invite-result ${
                      res.status === 'skipped' ? 'warning' : 'danger'
                    }`}
                  >
                    <div className="invite-result-main">
                      <AlertCircle size={16} />
                      <div>
                        <span className="invite-result-email">{res.email}</span>
                        <small>{res.reason}</small>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Invite;
