import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Briefcase, 
  MapPin, 
  Calendar, 
  ChevronRight,
  Mail,
  Smartphone,
  Loader2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { entrepriseService, type Entreprise } from '../services/entreprise.service';
import { adminKey, getCompanyAdmins } from '../lib/companyAdmins';
import { getUserInitials } from '../lib/profilePhoto';
import {
  formatFullPhone,
  parseStoredPhone,
  resolveAdminPhoneDisplay,
  validatePhoneForCountry,
} from '../lib/phoneCountries';
import PhoneCountryInput, {
  type PhoneCountryValue,
} from '../components/PhoneCountryInput';
import '../components/PhoneCountryInput.css';
import { ProjectStatus } from '../types/project';
import BackButton from '../components/BackButton';
import './EnterpriseDetail.css';

type EnterpriseProject = {
  id_projet: number;
  nom_p: string;
  statut_p?: string;
  statut?: string;
  responsable?: string;
  _count?: { membres?: number };
  membre_projet?: unknown[];
};

type LoadError = 'not_found' | 'server' | null;

type AdminEditDraft = {
  email: string;
  phone: PhoneCountryValue;
};

function formatProjectStatus(status: string): string {
  switch (status) {
    case ProjectStatus.IN_PROGRESS:
      return 'En cours';
    case ProjectStatus.COMPLETED:
      return 'Terminé';
    case ProjectStatus.ON_HOLD:
      return 'En attente';
    case ProjectStatus.DELAYED:
      return 'En retard';
    case ProjectStatus.PLANNING:
      return 'Planning';
    default:
      return status?.replace(/_/g, ' ') || 'Planning';
  }
}

function projectStatusClass(status: string): string {
  switch (status) {
    case ProjectStatus.IN_PROGRESS:
      return 'enterprise-detail-project-status--progress';
    case ProjectStatus.COMPLETED:
      return 'enterprise-detail-project-status--done';
    case ProjectStatus.ON_HOLD:
      return 'enterprise-detail-project-status--hold';
    case ProjectStatus.DELAYED:
      return 'enterprise-detail-project-status--delayed';
    default:
      return 'enterprise-detail-project-status--planning';
  }
}

function formatCreatedAt(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function displayOrMissing(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed || 'Non renseigné';
}

function formatAdminName(admin: NonNullable<Entreprise['admin']>): string {
  return [admin.prenom, admin.nom].filter(Boolean).join(' ').trim() || 'Administrateur';
}

function projectMemberHint(project: EnterpriseProject): string {
  if (project.responsable?.trim()) return project.responsable;
  const count =
    project._count?.membres ??
    (Array.isArray(project.membre_projet) ? project.membre_projet.length : 0);
  if (count > 0) {
    return `${count} membre${count > 1 ? 's' : ''}`;
  }
  return 'Aucun responsable';
}

function normalizeProjects(enterprise: Entreprise | null): EnterpriseProject[] {
  const raw = enterprise?.projet;
  return Array.isArray(raw) ? (raw as EnterpriseProject[]) : [];
}

function buildAdminDrafts(admins: NonNullable<Entreprise['admin']>[]): Record<string, AdminEditDraft> {
  const drafts: Record<string, AdminEditDraft> = {};
  for (const admin of admins) {
    drafts[adminKey(admin)] = {
      email: admin.email ?? '',
      phone: parseStoredPhone(admin.telephone ?? admin.phone ?? ''),
    };
  }
  return drafts;
}

const PRESENCE_POLL_MS = 30_000;

const EnterpriseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [enterprise, setEnterprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editNom, setEditNom] = useState('');
  const [editAdresse, setEditAdresse] = useState('');
  const [editAdmins, setEditAdmins] = useState<Record<string, AdminEditDraft>>({});

  const enterpriseId = Number.parseInt(id ?? '', 10);

  const loadEnterprise = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!Number.isFinite(enterpriseId) || enterpriseId <= 0) {
        setEnterprise(null);
        setLoadError('not_found');
        setLoading(false);
        return;
      }

      if (!options?.silent) {
        setLoading(true);
        setLoadError(null);
      }

      try {
        const data = await entrepriseService.getById(enterpriseId);
        if (!data?.id_entreprise) {
          setEnterprise(null);
          setLoadError('not_found');
          return;
        }
        setEnterprise(data);
        setLoadError(null);
      } catch (error) {
        console.error('Failed to fetch enterprise detail:', error);
        setEnterprise(null);
        setLoadError('server');
      } finally {
        if (!options?.silent) {
        setLoading(false);
        }
      }
    },
    [enterpriseId]
  );

  useEffect(() => {
    void loadEnterprise();
  }, [loadEnterprise]);

  useEffect(() => {
    if (!enterpriseId || enterpriseId <= 0 || isEditing || isSaving) return;
    const intervalId = window.setInterval(() => {
      void loadEnterprise({ silent: true });
    }, PRESENCE_POLL_MS);
    const onFocus = () => {
      void loadEnterprise({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [enterpriseId, loadEnterprise, isEditing, isSaving]);

  const beginEdit = useCallback(() => {
    if (!enterprise) return;
    const admins = getCompanyAdmins(enterprise);
    setEditNom(enterprise.nom ?? '');
    setEditAdresse(enterprise.adresse ?? '');
    setEditAdmins(buildAdminDrafts(admins));
    setSaveError(null);
    setSaveSuccess(false);
    setIsEditing(true);
  }, [enterprise]);

  const cancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const updateAdminDraft = (
    key: string,
    patch: Partial<AdminEditDraft>
  ) => {
    setEditAdmins((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleSave = async () => {
    if (!enterprise?.id_entreprise) return;

    const nom = editNom.trim();
    const adresse = editAdresse.trim();
    if (!nom) {
      setSaveError('Le nom de l\'entreprise est obligatoire.');
      return;
    }

    const admins = getCompanyAdmins(enterprise);
    for (const admin of admins) {
      const key = adminKey(admin);
      const draft = editAdmins[key];
      if (!draft) continue;
      const email = draft.email.trim();
      if (!email) {
        setSaveError(`L'email de ${formatAdminName(admin)} est obligatoire.`);
        return;
      }
      const digits = draft.phone.phoneNumber.replace(/\D/g, '');
      if (digits.length > 0) {
        const check = validatePhoneForCountry(draft.phone.phoneCountryCode, digits);
        if (!check.valid) {
          setSaveError(
            check.message ?? `Numéro invalide pour ${formatAdminName(admin)}.`
          );
          return;
        }
      }
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const adminUpdates = admins
        .filter((admin) => admin.id_utilisateur)
        .map((admin) => {
          const key = adminKey(admin);
          const draft = editAdmins[key];
          if (!draft) return null;

          const digits = draft.phone.phoneNumber.replace(/\D/g, '');
          const telephone =
            digits.length > 0
              ? formatFullPhone(draft.phone.phoneCountryCode, digits)
              : null;

          return {
            id_utilisateur: admin.id_utilisateur!,
            email: draft.email.trim(),
            telephone,
          };
        })
        .filter(
          (entry): entry is {
            id_utilisateur: number;
            email: string;
            telephone: string | null;
          } => entry !== null
        );

      await entrepriseService.update(enterprise.id_entreprise, {
        nom,
        adresse,
        admins: adminUpdates.length ? adminUpdates : undefined,
      });

      await loadEnterprise({ silent: true });
      setIsEditing(false);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 4000);
    } catch (error: unknown) {
      console.error('Failed to save enterprise:', error);
      const axiosErr = error as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      setSaveError(
        axiosErr.response?.data?.message ??
          axiosErr.response?.data?.error ??
          axiosErr.message ??
          'Échec de l\'enregistrement.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        className="enterprise-detail-page enterprise-detail-loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="animate-spin" size={40} aria-hidden />
        <p>Chargement de l&apos;entreprise…</p>
      </motion.div>
    );
  }

  if (loadError === 'server') {
    return (
      <motion.div className="enterprise-detail-page enterprise-detail-empty">
        <BackButton fallback="/enterprises" />
        <p>Erreur lors du chargement de l&apos;entreprise</p>
      </motion.div>
    );
  }

  if (!enterprise || loadError === 'not_found') {
    return (
      <motion.div className="enterprise-detail-page enterprise-detail-empty">
        <BackButton fallback="/enterprises" />
        <p>Entreprise introuvable</p>
      </motion.div>
    );
  }

  const companyAdmins = getCompanyAdmins(enterprise);
  const projects = normalizeProjects(enterprise);
  const multipleAdmins = companyAdmins.length > 1;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="enterprise-detail-page"
    >
      <BackButton fallback="/enterprises" />

      <header className="enterprise-detail-header">
        <div className="enterprise-detail-header__main">
          {isEditing ? (
            <input
              type="text"
              className="enterprise-detail-info-input enterprise-detail-info-input--title"
              value={editNom}
              onChange={(e) => setEditNom(e.target.value)}
              aria-label="Nom de l'entreprise"
            />
          ) : (
            <h1 className="enterprise-detail-title">{enterprise?.nom ?? '—'}</h1>
          )}
        </div>
      </header>

      <div className="enterprise-detail-grid">
        <section
          className="enterprise-detail-card enterprise-detail-card--info"
          aria-labelledby="ent-info-title"
        >
          <div className="enterprise-detail-card__head">
            <h2 id="ent-info-title" className="enterprise-detail-card__title">
              <span className="enterprise-detail-card__title-text">Informations générales</span>
            </h2>
            <div className="enterprise-detail-card__head-actions">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="enterprise-detail-edit-btn enterprise-detail-edit-btn--save"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    title="Enregistrer"
                    aria-label="Enregistrer"
                  >
                    {isSaving ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden />
                    ) : (
                      <Check size={18} aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className="enterprise-detail-edit-btn enterprise-detail-edit-btn--cancel"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    title="Annuler"
                    aria-label="Annuler"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="enterprise-detail-edit-btn"
                  onClick={beginEdit}
                  title="Modifier"
                  aria-label="Modifier les informations"
                >
                  <Edit2 size={18} aria-hidden />
                </button>
              )}
              <span
                className="enterprise-detail-card__icon enterprise-detail-card__icon--info"
                aria-hidden
              >
                <Building2 size={20} />
              </span>
            </div>
          </div>

          {saveError ? (
            <p className="enterprise-detail-save-error" role="alert">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="enterprise-detail-save-success" role="status">
              Modifications enregistrées.
            </p>
          ) : null}

          <div className="enterprise-detail-info-list">
            <div className={`info-row${isEditing ? ' info-row--edit' : ''}`}>
              <div className="info-icon-box" aria-hidden>
                <MapPin className="info-icon" strokeWidth={2} />
              </div>
              <div>
                <label>Adresse</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="enterprise-detail-info-input"
                    value={editAdresse}
                    onChange={(e) => setEditAdresse(e.target.value)}
                  />
                ) : (
                  <span>{enterprise?.adresse || '—'}</span>
                )}
              </div>
            </div>
            {companyAdmins.length === 0 ? (
              <>
                <div className="info-row">
                  <div className="info-icon-box" aria-hidden>
                    <Mail className="info-icon" strokeWidth={2} />
                  </div>
                  <div>
                    <label>Email admin</label>
                    <span>Non renseigné</span>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-icon-box" aria-hidden>
                    <Smartphone className="info-icon" strokeWidth={2} />
                  </div>
                  <div>
                    <label>Téléphone admin</label>
                    <span>Non renseigné</span>
                  </div>
                </div>
              </>
            ) : (
              companyAdmins.map((admin, index) => {
                const adminName = formatAdminName(admin);
                const key = adminKey(admin);
                const emailLabel = multipleAdmins
                  ? `Email — ${adminName}`
                  : 'Email admin';
                const phoneLabel = multipleAdmins
                  ? `Téléphone — ${adminName}`
                  : 'Téléphone admin';
                const createdLabel = multipleAdmins
                  ? `Créée le — ${adminName}`
                  : 'Créée le';
                const draft = editAdmins[key];

                return (
                  <div
                    key={key}
                    className={`enterprise-detail-info-admin-group${index > 0 ? ' enterprise-detail-info-admin-group--separated' : ''}`}
                  >
                    <div className="info-row">
                      <div className="info-icon-box" aria-hidden>
                        <Calendar className="info-icon" strokeWidth={2} />
                      </div>
                      <div>
                        <label>{createdLabel}</label>
                        <span>{formatCreatedAt(admin.createdAt)}</span>
                      </div>
                    </div>
                    <div className={`info-row${isEditing ? ' info-row--edit' : ''}`}>
                      <div className="info-icon-box" aria-hidden>
                        <Mail className="info-icon" strokeWidth={2} />
                      </div>
                      <div>
                        <label>{emailLabel}</label>
                        {isEditing && draft ? (
                          <input
                            type="email"
                            className="enterprise-detail-info-input"
                            value={draft.email}
                            onChange={(e) =>
                              updateAdminDraft(key, { email: e.target.value })
                            }
                          />
                        ) : (
                          <span>{displayOrMissing(admin.email)}</span>
                        )}
                      </div>
                    </div>
                    <div className={`info-row${isEditing ? ' info-row--edit' : ''}`}>
                      <div className="info-icon-box" aria-hidden>
                        <Smartphone className="info-icon" strokeWidth={2} />
                      </div>
              <div>
                        <label>{phoneLabel}</label>
                        {isEditing && draft ? (
                          <div className="enterprise-detail-info-phone">
                            <PhoneCountryInput
                              value={draft.phone}
                              onChange={(phone) => updateAdminDraft(key, { phone })}
                            />
                          </div>
                        ) : (
                          <span>{resolveAdminPhoneDisplay(admin)}</span>
                        )}
              </div>
            </div>
          </div>
                );
              })
            )}
        </div>
        </section>

        <section
          className="enterprise-detail-card enterprise-detail-card--projects"
          aria-labelledby="ent-projects-title"
        >
          <div className="enterprise-detail-card__head">
            <h2 id="ent-projects-title" className="enterprise-detail-card__title">
              <span className="enterprise-detail-card__title-text">Projets</span>
              <span className="enterprise-detail-card__count">{projects.length}</span>
            </h2>
            <span
              className="enterprise-detail-card__icon enterprise-detail-card__icon--projects"
              aria-hidden
            >
              <Briefcase size={20} />
            </span>
          </div>
          <div className="enterprise-detail-scroll" role="list">
            {projects.length === 0 ? (
              <p className="enterprise-detail-empty-block">Aucun projet pour cette entreprise.</p>
            ) : (
              projects.map((p) => {
                const rawStatus = p?.statut_p || p?.statut || ProjectStatus.PLANNING;
                return (
                  <div
                    key={p.id_projet}
                    className="enterprise-detail-project-card"
                    role="listitem"
                  >
                    <div className="enterprise-detail-project-card__body">
                      <p className="enterprise-detail-project-card__name">
                        {p?.nom_p ?? '—'}
                      </p>
                      <p className="enterprise-detail-project-card__meta">
                        {projectMemberHint(p)}
                      </p>
                </div>
                    <span
                      className={`enterprise-detail-project-status ${projectStatusClass(rawStatus)}`}
                    >
                      {formatProjectStatus(rawStatus)}
                    </span>
                </div>
                );
              })
            )}
          </div>
        </section>

        <section
          className="enterprise-detail-card enterprise-detail-card--team"
          aria-labelledby="ent-team-title"
        >
          <div className="enterprise-detail-card__head">
            <h2 id="ent-team-title" className="enterprise-detail-card__title">
              <span className="enterprise-detail-card__title-text">Admins</span>
              <span className="enterprise-detail-card__count">
                {companyAdmins.length}
              </span>
            </h2>
            <span
              className="enterprise-detail-card__icon enterprise-detail-card__icon--team"
              aria-hidden
            >
              <Users size={20} />
            </span>
          </div>
          <div className="enterprise-detail-scroll">
            {companyAdmins.length === 0 ? (
              <p className="enterprise-detail-empty-block">Aucun administrateur trouvé</p>
            ) : (
              companyAdmins.map((admin) => (
                <button
                  key={admin.id_utilisateur ?? admin.email}
                  type="button"
                  className="enterprise-detail-member-row"
                  onClick={() => {
                    if (admin.id_utilisateur) {
                      navigate(`/team/${admin.id_utilisateur}`);
                    }
                  }}
                >
                  <div className="enterprise-detail-member-avatar" aria-hidden>
                    <span>{getUserInitials(admin)}</span>
                </div>
                  <div className="enterprise-detail-member-body">
                    <p className="enterprise-detail-member-name">
                      {[admin.prenom, admin.nom].filter(Boolean).join(' ') ||
                        'Administrateur'}
                    </p>
                    <p className="enterprise-detail-member-email">
                      {admin.email || 'Non renseigné'}
                    </p>
                    <span className="enterprise-detail-member-role enterprise-detail-member-role--admin">
                      Admin
                    </span>
              </div>
                  <ChevronRight size={18} className="enterprise-detail-chevron" aria-hidden />
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default EnterpriseDetail;
