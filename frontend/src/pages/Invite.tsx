import React, {
  useEffect,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  UserPlus,
  Send,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import {
  invitationService,
  type TeamInvitationResult,
  type TeamInvitationResponse,
  type InvitationSmtpSetupError,
} from '../services/invitation.service';
import './Invite.css';

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const splitMemberDisplayName = (raw: string): { prenom: string; nom: string } => {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { prenom: '', nom: '' };
  if (tokens.length === 1) return { prenom: tokens[0], nom: tokens[0] };
  const [prenom, ...rest] = tokens;
  return { prenom, nom: rest.join(' ') };
};

const Invite: React.FC = () => {
  const [memberDisplayName, setMemberDisplayName] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [smtpSetupError, setSmtpSetupError] =
    useState<InvitationSmtpSetupError | null>(null);
  const [results, setResults] = useState<TeamInvitationResult[]>([]);
  const [responseMeta, setResponseMeta] = useState<
    Pick<
      TeamInvitationResponse,
      'message' | 'workspace' | 'email_configured' | 'summary'
    > | null
  >(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const canSubmit =
    !submitting &&
    memberDisplayName.trim().length >= 2 &&
    (emails.length > 0 || isValidEmail(emailDraft));

  const tryCommitEmail = (raw: string) => {
    const value = raw.trim().replace(/[,;\s]+$/g, '');
    if (!value) return true;
    if (!isValidEmail(value)) {
      setEmailError(`"${value}" n'est pas un email valide`);
      return false;
    }
    if (emails.includes(value.toLowerCase())) {
      setEmailDraft('');
      return true;
    }
    setEmails((prev) => [...prev, value.toLowerCase()]);
    setEmailDraft('');
    setEmailError(null);
    return true;
  };

  const handleEmailKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
      e.preventDefault();
      tryCommitEmail(emailDraft);
    } else if (
      e.key === 'Backspace' &&
      emailDraft === '' &&
      emails.length > 0
    ) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleEmailPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const data = e.clipboardData.getData('text');
    if (!data || !/[,;\s]/.test(data)) return;
    e.preventDefault();
    const tokens = data
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    let added = 0;
    let firstInvalid: string | null = null;
    setEmails((prev) => {
      const next = [...prev];
      for (const token of tokens) {
        if (!isValidEmail(token)) {
          if (!firstInvalid) firstInvalid = token;
          continue;
        }
        const lower = token.toLowerCase();
        if (!next.includes(lower)) {
          next.push(lower);
          added += 1;
        }
      }
      return next;
    });
    setEmailDraft('');
    if (firstInvalid && added === 0) {
      setEmailError(`"${firstInvalid}" n'est pas un email valide`);
    } else if (firstInvalid) {
      setEmailError(`Certains emails ont été ignorés (ex : "${firstInvalid}")`);
    } else {
      setEmailError(null);
    }
  };

  const removeEmail = (target: string) => {
    setEmails((prev) => prev.filter((e) => e !== target));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let working = [...emails];
    if (emailDraft.trim()) {
      const draft = emailDraft.trim().toLowerCase();
      if (!isValidEmail(draft)) {
        setEmailError(`"${emailDraft.trim()}" n'est pas un email valide`);
        return;
      }
      if (!working.includes(draft)) working.push(draft);
      setEmails(working);
      setEmailDraft('');
    }
    if (working.length === 0) {
      setEmailError('Ajoutez au moins un email à inviter');
      return;
    }
    if (memberDisplayName.trim().length < 2) {
      setEmailError('Indiquez le nom du membre (au moins 2 caractères)');
      return;
    }

    const { prenom, nom } = splitMemberDisplayName(memberDisplayName);

    setSubmitting(true);
    setSubmitError(null);
    setSmtpSetupError(null);
    setResults([]);
    setResponseMeta(null);
    try {
      const data = await invitationService.sendTeamInvitations({
        emails: working,
        prenom,
        nom,
      });
      setResults(data.results);
      setResponseMeta({
        message: data.message,
        workspace: data.workspace,
        email_configured: data.email_configured,
        summary: data.summary,
      });

      const deliveredOk = data.results.filter(
        (r) =>
          r.status === 'sent' &&
          'email_delivery' in r &&
          r.email_delivery === 'sent',
      ).length;
      const failedTransport = data.results.filter(
        (r) =>
          r.status === 'sent' &&
          'email_delivery' in r &&
          r.email_delivery === 'failed',
      ).length;

      if (deliveredOk > 0 && failedTransport === 0) {
        setToast({
          type: 'success',
          message:
            data.message ||
            `${deliveredOk} invitation(s) envoyée(s) par email.`,
        });
      } else if (failedTransport > 0 && deliveredOk === 0) {
        const firstFail = data.results.find(
          (r) =>
            r.status === 'sent' &&
            'delivery_error' in r &&
            (r as { delivery_error?: string }).delivery_error,
        ) as { delivery_error?: string } | undefined;
        setToast({
          type: 'error',
          message:
            firstFail?.delivery_error ||
            data.message ||
            "Les emails n'ont pas été livrés. Vérifiez Brevo (clé API, expéditeur vérifié).",
        });
      } else if (failedTransport > 0 && deliveredOk > 0) {
        setToast({
          type: 'warning',
          message:
            data.message ||
            'Certains emails n’ont pas été livrés — voir le détail ci-dessous.',
        });
      } else {
        const onlySoft = data.results.every((r) => r.status === 'skipped');
        const hardErr = data.results.find((r) => r.status === 'error');
        if (onlySoft) {
          setToast({
            type: 'warning',
            message:
              data.message ||
              'Aucun envoi : certaines adresses sont déjà invitées ou en attente.',
          });
        } else if (hardErr && hardErr.status === 'error') {
          setToast({
            type: 'error',
            message: hardErr.reason || data.message || 'Échec des invitations',
          });
        }
      }

      // Keep emails that were not delivered so the user can retry.
      const undelivered = data.results
        .filter(
          (r) =>
            r.status !== 'sent' ||
            (r.status === 'sent' && r.email_delivery !== 'sent'),
        )
        .map((r) => r.email);
      setEmails(undelivered);
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
        code?: string;
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
        setToast({ type: 'error', message: m });
      } else {
        if (Array.isArray(data?.results)) {
          setResults(data.results as TeamInvitationResult[]);
          setResponseMeta({
            message: data.message || 'Certaines invitations ont échoué',
            workspace: data.workspace || '',
            email_configured: !!data.email_configured,
            summary: data.summary,
          });
        }

        const aborted =
          anyErr.code === 'ECONNABORTED' || anyErr.code === 'ERR_CANCELED';
        const network = !anyErr.response?.status;

        let msg =
          data?.message ||
          anyErr.message ||
          'Une erreur est survenue lors de l\'envoi';
        if (aborted) {
          msg =
            'Délai dépassé (90 s). Le serveur peut être bloqué sur l\'API Brevo ou injoignable — vérifiez le terminal backend.';
        } else if (network && !is503Config) {
          msg =
            'Impossible de joindre l\'API. Vérifiez que le backend tourne et que VITE_API_URL pointe vers le bon port.';
        }

        if (!is503Config) {
          setSubmitError(msg);
          setToast({
            type: 'error',
            message: msg,
          });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const deliveredCount = results.filter(
    (r) => r.status === 'sent' && r.email_delivery === 'sent',
  ).length;
  const failedDeliveryCount = results.filter(
    (r) => r.status === 'sent' && r.email_delivery === 'failed',
  ).length;

  return (
    <div className="invite-page">
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
            ) : toast.type === 'warning' ? (
              <AlertCircle size={18} aria-hidden />
            ) : (
              <AlertCircle size={18} aria-hidden />
            )}
            <span className="invite-toast-text">{toast.message}</span>
            <button
              type="button"
              className="invite-toast-close"
              onClick={() => setToast(null)}
              aria-label="Fermer la notification"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="invite-hero">
        <div className="invite-hero-text">
          <h1>Inviter un membre</h1>
          <p className="invite-hero-lead">Ajoutez un membre à votre espace.</p>
        </div>
        <div className="invite-hero-illustration">
          <div className="invite-hero-icon">
            <UserPlus size={22} />
          </div>
        </div>
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
            <strong>Configuration email requise</strong>
            <p>{smtpSetupError.message}</p>
            {smtpSetupError.hint?.required_env && (
              <p className="invite-banner-hint">
                Variables requises dans <code>backend/.env</code> :{' '}
                {smtpSetupError.hint.required_env.map((k, i) => (
                  <React.Fragment key={k}>
                    {i > 0 ? ', ' : ''}
                    <code>{k}</code>
                  </React.Fragment>
                ))}
              </p>
            )}
            {smtpSetupError.hint?.example_brevo && (
              <details className="invite-banner-details" open>
                <summary>Brevo (recommandé)</summary>
                <pre>
                  {Object.entries(smtpSetupError.hint.example_brevo)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n')}
                </pre>
                <small>
                  Créez un compte sur{' '}
                  <a
                    href="https://www.brevo.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    brevo.com
                  </a>
                  , générez une clé API, vérifiez votre adresse{' '}
                  <code>EMAIL_FROM</code>, puis redémarrez le backend.
                </small>
              </details>
            )}
            {(smtpSetupError.hint?.alternative_smtp ||
              smtpSetupError.hint?.example_gmail) && (
              <details className="invite-banner-details">
                <summary>Alternative : SMTP (Gmail, SES, …)</summary>
                <pre>
                  {Object.entries(
                    smtpSetupError.hint.alternative_smtp ||
                      smtpSetupError.hint.example_gmail ||
                      {},
                  )
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n')}
                </pre>
                <small>
                  Pour Gmail, <code>SMTP_PASS</code> doit être un{' '}
                  <em>App Password</em> Google.
                </small>
              </details>
            )}
          </div>
        </motion.div>
      )}

      <div className="invite-card">
        <form onSubmit={handleSubmit} className="invite-form">
          <div className="invite-field">
            <label className="invite-label" htmlFor="invite-member-name">
              Nom du membre
            </label>
            <input
              id="invite-member-name"
              type="text"
              className="invite-input-single"
              placeholder="Saisir le nom complet"
              value={memberDisplayName}
              onChange={(e) => setMemberDisplayName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="invite-field">
            <label className="invite-label">
              Email du membre
            </label>
            <div
              className={`invite-emails ${emailError ? 'has-error' : ''}`}
              onClick={(e) => {
                const input = (e.currentTarget as HTMLDivElement).querySelector(
                  'input',
                ) as HTMLInputElement | null;
                input?.focus();
              }}
            >
              <Mail size={16} className="invite-emails-icon" />
              <div className="invite-emails-tags">
                <AnimatePresence initial={false}>
                  {emails.map((email) => (
                    <motion.span
                      key={email}
                      className="invite-chip"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.12 }}
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removeEmail(email);
                        }}
                        aria-label={`Retirer ${email}`}
                      >
                        <X size={12} />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  type="text"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onKeyDown={handleEmailKeyDown}
                  onPaste={handleEmailPaste}
                  onBlur={() => {
                    if (emailDraft.trim()) tryCommitEmail(emailDraft);
                  }}
                  placeholder="Saisir l'adresse e-mail"
                  aria-label="Adresses e-mail à inviter"
                />
              </div>
            </div>
            {emailError && (
              <p className="invite-inline-error">
                <AlertCircle size={14} />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {submitError && !smtpSetupError && (
            <div className="invite-banner invite-banner-error">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <div className="invite-actions">
            <button
              type="submit"
              className="invite-submit"
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Envoyer l&apos;invitation
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
            transition={{ duration: 0.18 }}
          >
            <header className="invite-results-header">
              <h2>Résultat de l'envoi</h2>
              <div className="invite-results-summary">
                {deliveredCount > 0 && (
                  <span className="invite-tag tag-success">
                    <Mail size={12} />
                    {deliveredCount} email{deliveredCount > 1 ? 's' : ''}{' '}
                    envoyé{deliveredCount > 1 ? 's' : ''}
                  </span>
                )}
                {failedDeliveryCount > 0 && (
                  <span className="invite-tag tag-danger">
                    <AlertCircle size={12} />
                    {failedDeliveryCount} email
                    {failedDeliveryCount > 1 ? 's' : ''} non remis
                  </span>
                )}
                {skippedCount > 0 && (
                  <span className="invite-tag tag-warning">
                    {skippedCount} ignorée{skippedCount > 1 ? 's' : ''}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="invite-tag tag-danger">
                    <AlertCircle size={12} />
                    {errorCount} échec{errorCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </header>

            {responseMeta?.message && (
              <p
                className={`invite-results-note ${
                  deliveredCount > 0 ? 'success' : 'warning'
                }`}
              >
                {deliveredCount > 0 ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
                <span>{responseMeta.message}</span>
              </p>
            )}

            {responseMeta &&
              !responseMeta.email_configured &&
              sentCount > 0 && (
                <p className="invite-results-note warning">
                  <AlertCircle size={14} />
                  <span>
                    Le fournisseur d'emails n'est plus disponible. Vérifiez{' '}
                    <code>BREVO_API_KEY</code> / <code>EMAIL_FROM</code> (ou
                    votre configuration SMTP) dans{' '}
                    <code>backend/.env</code> puis redémarrez l'API.
                  </span>
                </p>
              )}

            <ul className="invite-results-list">
              {results.map((res) => {
                if (res.status === 'sent') {
                  const delivered = res.email_delivery === 'sent';
                  return (
                    <li
                      key={`sent-${res.token}`}
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
                          <span className="invite-result-email">
                            {res.email}
                          </span>
                          <small>
                            {delivered
                              ? 'Invitation envoyée'
                              : res.email_delivery === 'failed'
                              ? `Non remis${
                                  (res as { delivery_error?: string })
                                    .delivery_error
                                    ? ` — ${(res as { delivery_error?: string }).delivery_error}`
                                    : ''
                                }`
                              : "Email en attente"}
                            {res.expires_at && (
                              <>
                                {' '}· Lien valide jusqu'au{' '}
                                {new Date(res.expires_at).toLocaleDateString(
                                  'fr-FR',
                                )}
                              </>
                            )}
                          </small>
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
                        <span className="invite-result-email">
                          {res.email}
                        </span>
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
