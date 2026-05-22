import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserPlus, Building2, Trash2, Edit2, Search, Loader2, X, Check, Mail, Lock, User, ChevronDown, Eye } from 'lucide-react';
import { entrepriseService, type Entreprise } from '../services/entreprise.service';
import BackButton from '../components/BackButton';
import PhoneCountryInput, {
  createDefaultPhoneValue,
  type PhoneCountryValue,
} from '../components/PhoneCountryInput';
import { parseStoredPhone, validatePhoneForCountry } from '../lib/phoneCountries';
import '../components/PhoneCountryInput.css';
import InviteEnterpriseSelect from '../components/InviteEnterpriseSelect';
import { enrichEnterpriseListAdmins } from '../lib/enrichEnterpriseListAdmins';
import { getEnterpriseAdmins, groupEnterprisesByName } from '../lib/groupEnterprises';
import '../components/CreateProjectModal.css';
import './Enterprises.css';

const Enterprises: React.FC = () => {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntreprise, setNewEntreprise] = useState({ nom: '', adresse: '' });
  const [editPhone, setEditPhone] = useState<PhoneCountryValue>(createDefaultPhoneValue);
  const [editPhoneError, setEditPhoneError] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ nom: '', prenom: '', email: '', mot_de_passe: '', id_entreprise: 0 });
  const [isInviting, setIsInviting] = useState(false);
  const [isCreatingFromInvite, setIsCreatingFromInvite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entreprise | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PRESENCE_POLL_MS = 30_000;

  const showMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const loadEnterprises = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await entrepriseService.getAll();
      const list = Array.isArray(data) ? data : [];
      const withAdmins = await enrichEnterpriseListAdmins(list);
      setEntreprises(groupEnterprisesByName(withAdmins));
    } catch (err) {
      console.error('Failed to fetch enterprises:', err);
      if (!options?.silent) {
        setError("Impossible de charger les entreprises. Vérifiez votre connexion ou les permissions.");
        showMessage('error', 'Erreur lors du chargement des entreprises');
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const applyEnterpriseUpdate = useCallback((id: number, updated: Entreprise) => {
    setEntreprises((prev) =>
        prev.map((ent) =>
          ent.id_entreprise === id
            ? {
                ...ent,
                ...updated,
                nom: updated.nom ?? ent.nom,
                adresse: updated.adresse ?? ent.adresse,
                telephone: updated.telephone ?? ent.telephone,
                admin: updated.admin ?? ent.admin,
                admins:
                  updated.admins?.length ? updated.admins : ent.admins,
              }
            : ent
        )
    );
  }, []);

  useEffect(() => {
    void loadEnterprises();
  }, [loadEnterprises]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadEnterprises({ silent: true });
    }, PRESENCE_POLL_MS);
    const onFocus = () => {
      void loadEnterprises({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadEnterprises]);

  const isAdminOnline = (admin?: Entreprise['admin']) => admin?.isOnline === true;

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntreprise.nom.trim()) {
      showMessage('error', 'Le nom de l\'entreprise est obligatoire');
      return;
    }
    const isDuplicate = entreprises.some(ent => ent.nom.toLowerCase() === newEntreprise.nom.trim().toLowerCase() && ent.id_entreprise !== editingId);
    if (isDuplicate) {
      showMessage('error', 'Une entreprise avec ce nom existe déjà');
      return;
    }

    const payload = {
      nom: newEntreprise.nom.trim(),
      adresse: newEntreprise.adresse.trim(),
    };

    setIsSaving(true);
    try {
      if (editingId) {
        const nationalDigits = editPhone.phoneNumber;
        if (nationalDigits.length > 0) {
          const phoneCheck = validatePhoneForCountry(
            editPhone.phoneCountryCode,
            nationalDigits
          );
          if (!phoneCheck.valid) {
            setEditPhoneError(phoneCheck.message);
            showMessage('error', phoneCheck.message || 'Numéro de téléphone invalide');
            setIsSaving(false);
            return;
          }
        }
        setEditPhoneError(undefined);

        const updated = await entrepriseService.update(editingId, {
          ...payload,
          phoneCountryCode: editPhone.phoneCountryCode,
          phoneNumber: nationalDigits,
        });
        applyEnterpriseUpdate(editingId, {
          ...updated,
          nom: updated.nom ?? payload.nom,
          adresse: updated.adresse ?? payload.adresse,
          phone: updated.phone ?? updated.telephone ?? null,
          telephone: updated.telephone ?? updated.phone ?? null,
          phoneCountryCode: updated.phoneCountryCode ?? editPhone.phoneCountryCode,
          phoneNumber: updated.phoneNumber ?? editPhone.phoneNumber,
          admin: updated.admin
            ? {
                ...updated.admin,
                phone: updated.admin.phone ?? updated.admin.telephone ?? null,
                telephone: updated.admin.telephone ?? updated.admin.phone ?? null,
                phoneCountryCode:
                  updated.admin.phoneCountryCode ?? editPhone.phoneCountryCode,
                phoneNumber: updated.admin.phoneNumber ?? editPhone.phoneNumber,
              }
            : updated.admin,
          responsibleAdmin: updated.responsibleAdmin ?? updated.admin,
        });
        showMessage('success', 'Entreprise modifiée avec succès');
        closeEnterpriseModal();
        await loadEnterprises({ silent: true });
      } else {
        const created = await entrepriseService.create({
          nom: payload.nom,
          adresse: payload.adresse,
        });
        showMessage('success', 'Entreprise ajoutée avec succès');
        if (isCreatingFromInvite && created?.id_entreprise) {
          setEntreprises((prev) => [...prev, created]);
          setInviteData((prev) => ({ ...prev, id_entreprise: created.id_entreprise }));
        }
        closeEnterpriseModal();
        await loadEnterprises({ silent: true });
      }
    } catch (error: unknown) {
      console.error('Failed to save enterprise:', error);
      const axiosErr = error as {
        response?: { data?: { message?: string; errors?: Array<{ message?: string }> } };
        message?: string;
      };
      const errorMsg = axiosErr.response?.data?.message || axiosErr.message;
      const details = axiosErr.response?.data?.errors?.[0]?.message;
      if (editingId) {
        showMessage(
          'error',
          details || errorMsg || "Erreur lors de la modification de l'entreprise"
        );
      } else {
        showMessage('error', details ? `${errorMsg}: ${details}` : errorMsg || "Échec de l'enregistrement");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const updated = await entrepriseService.toggleStatus(id);
      setEntreprises((prev) =>
        prev.map((ent) =>
          ent.id_entreprise === id ? { ...ent, statut: updated.statut } : ent
        )
      );
      showMessage('success', `Statut ${updated.statut === 'active' ? 'activé' : 'désactivé'}`);
    } catch (error) {
      console.error("Failed to toggle status:", error);
      showMessage('error', 'Échec du changement de statut');
    }
  };

  const openDeleteModal = (entreprise: Entreprise) => {
    setDeleteTarget(entreprise);
  };

  const closeDeleteModal = () => {
    if (!isDeleting) setDeleteTarget(null);
  };

  const confirmDeleteEnterprise = async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id_entreprise;
    setIsDeleting(true);
    try {
      await entrepriseService.delete(deletedId);
      setEntreprises((prev) => prev.filter((e) => e.id_entreprise !== deletedId));
      setDeleteTarget(null);
      showMessage('success', 'Entreprise supprimée');
    } catch (err: unknown) {
      console.error('Failed to delete enterprise:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const backendMsg = axiosErr.response?.data?.message;
      showMessage(
        'error',
        backendMsg || "Échec de la suppression de l'entreprise"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (entreprise: Entreprise) => {
    setIsCreatingFromInvite(false);
    setNewEntreprise({
      nom: entreprise.nom || '',
      adresse: entreprise.adresse || '',
    });
    setEditPhone(
      parseStoredPhone(
        entreprise.admin?.telephone ??
          entreprise.admin?.phone ??
          entreprise.telephone ??
          entreprise.phone
      )
    );
    setEditPhoneError(undefined);
    setEditingId(entreprise.id_entreprise);
    setIsModalOpen(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData.id_entreprise) {
      showMessage('error', 'Veuillez sélectionner une entreprise');
      return;
    }
    setIsInviting(true);
    try {
      const result = await entrepriseService.inviteAdmin(inviteData);
      const msg = result?.message || 'Administrateur créé avec succès';
      showMessage('success', msg);
      setIsInviteModalOpen(false);
      setInviteData({ nom: '', prenom: '', email: '', mot_de_passe: '', id_entreprise: 0 });
      await loadEnterprises({ silent: true });
    } catch (error: any) {
      console.error("Failed to invite admin:", error);
      // Show the exact backend error message
      const backendMsg = error.response?.data?.message;
      const backendError = error.response?.data?.error;
      const validationErrors = error.response?.data?.errors;
      
      let errorMsg = backendMsg || backendError || error.message || "Échec de l'invitation";
      
      if (validationErrors && Array.isArray(validationErrors)) {
        errorMsg = validationErrors.map((e: any) => e.message).join(', ');
      }
      
      showMessage('error', errorMsg);
    } finally {
      setIsInviting(false);
    }
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setInviteData({ nom: '', prenom: '', email: '', mot_de_passe: '', id_entreprise: 0 });
  };

  const closeEnterpriseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setIsCreatingFromInvite(false);
    setNewEntreprise({ nom: '', adresse: '' });
    setEditPhone(createDefaultPhoneValue());
    setEditPhoneError(undefined);
  };

  const filteredEntreprises = (entreprises || []).filter((e) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const adminBlob = getEnterpriseAdmins(e)
      .map((a) => `${a.prenom || ''} ${a.nom || ''} ${a.email || ''}`)
      .join(' ')
      .toLowerCase();
    return (e.nom || '').toLowerCase().includes(q) || adminBlob.includes(q);
  });

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="animate-spin" size={40} />
        <p>Chargement des entreprises...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="enterprises-page">
        <header className="page-header">
          <h1>Entreprises</h1>
        </header>
        <div className="error-banner premium-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
          <X size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Oups ! Quelque chose s'est mal passé</h3>
          <p style={{ color: '#b91c1c', marginBottom: '1.5rem' }}>{error}</p>
          <button className="primary-btn" onClick={() => void loadEnterprises()} style={{ margin: '0 auto' }}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="enterprises-page">
      <BackButton />
      <header className="page-header enterprises-page-header">
        <h1>Entreprises</h1>
      </header>

      {actionMessage && (
        <div className={`action-message ${actionMessage.type} premium-card`}>
          {actionMessage.type === 'success' ? <Check size={18} /> : <X size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      <div className="enterprises-toolbar">
        <label className="enterprises-search-field search-container">
          <Search size={18} className="search-icon" aria-hidden />
          <input
            type="search"
            className="search-input"
            placeholder="Rechercher une entreprise ou un administrateur…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Rechercher une entreprise ou un administrateur"
          />
        </label>
        <div className="enterprises-toolbar-actions">
          <button
            type="button"
            className="enterprises-toolbar-btn"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <UserPlus size={18} aria-hidden />
            <span>Inviter un admin</span>
          </button>
          <button
            type="button"
            className="enterprises-toolbar-btn"
            onClick={() => {
              setEditingId(null);
              setNewEntreprise({ nom: '', adresse: '' });
              setEditPhone(createDefaultPhoneValue());
              setEditPhoneError(undefined);
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} aria-hidden />
            <span>Nouvelle entreprise</span>
          </button>
        </div>
      </div>

      <div className="enterprises-grid">
        {filteredEntreprises.length === 0 ? (
          <div className="enterprises-empty premium-card">
            <Building2 size={28} aria-hidden className="enterprises-empty-icon" />
            <p>Aucune entreprise trouvée.</p>
          </div>
        ) : (
          filteredEntreprises.map((e) => {
            const admins = getEnterpriseAdmins(e);
            const createdLabel = e.createdAt
              ? new Date(e.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
              : '—';
            const adminOnline = admins.some((admin) => isAdminOnline(admin));

            return (
              <article key={e.id_entreprise} className="premium-card enterprise-card">
                <div className="card-header">
                  <div className="enterprise-card-top">
                    <div className="enterprise-icon" aria-hidden>
                      <Building2 size={22} />
                    </div>
                    <div className="enterprise-card-heading">
                      <h3>{e.nom || '—'}</h3>
                      <div className="info-row enterprise-card-date">
                        <span>Créée le {createdLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="card-header-aside">
                    <span
                      className={`status-badge ${adminOnline ? 'active' : 'inactive'}`}
                      title={
                        adminOnline
                          ? 'Administrateur connecté'
                          : e.admin
                            ? 'Administrateur hors ligne'
                            : 'Aucun administrateur assigné'
                      }
                    >
                      <span
                        className={`status-dot ${adminOnline ? 'active' : 'inactive'}`}
                        aria-hidden
                      />
                      {adminOnline ? 'Actif' : 'Inactif'}
                    </span>
                    <div className="card-actions">
                      <Link
                        to={`/enterprises/${e.id_entreprise}`}
                        className="icon-btn card-action-link"
                        title="Voir le détail"
                      >
                        <Eye size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(e.id_entreprise)}
                        className="icon-btn"
                        title={e.statut === 'inactive' ? 'Activer' : 'Désactiver'}
                      >
                        <div
                          className={`status-dot ${adminOnline ? 'active' : 'inactive'}`}
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(e)}
                        className="icon-btn edit"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openDeleteModal(e);
                        }}
                        className="icon-btn delete"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-footer enterprise-card-admin">
                  {admins.length === 0 ? (
                    <div className="admin-info">
                      <div className="avatar-small" aria-hidden>
                        ?
                      </div>
                      <div className="enterprise-admin-details">
                        <p className="admin-name">Non assigné</p>
                      </div>
                    </div>
                  ) : (
                    admins.map((admin) => {
                      const adminName =
                        `${admin.prenom || ''} ${admin.nom || ''}`.trim() || '—';
                      const adminEmail = admin.email || '—';
                      const initials =
                        `${admin.prenom?.[0] || ''}${admin.nom?.[0] || ''}`.toUpperCase() ||
                        '?';
                      return (
                        <div
                          key={admin.id_utilisateur ?? admin.email ?? adminName}
                          className="admin-info"
                        >
                          <div className="avatar-small" aria-hidden>
                            {initials}
                          </div>
                          <div className="enterprise-admin-details">
                            <p className="admin-name">{adminName}</p>
                            <div className="info-row enterprise-admin-email">
                              <Mail size={14} aria-hidden />
                              <span>{adminEmail}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isInviteModalOpen && (
              <div
                className="modal-overlay compact-modal-overlay"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) closeInviteModal();
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 12 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="modal-container compact-modal enterprises-platform-modal enterprises-invite-modal"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="modal-header compact-modal-header">
                    <h2>Inviter un administrateur</h2>
                    <button
                      onClick={closeInviteModal}
                      className="close-btn"
                      aria-label="Fermer"
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleInvite} className="modal-form compact-modal-form">
                    <div className="compact-modal-body">
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="ent-invite-prenom">Prénom</label>
                          <div className="input-wrapper">
                            <User className="input-icon" size={16} />
                            <input
                              id="ent-invite-prenom"
                              type="text"
                              required
                              value={inviteData.prenom}
                              onChange={(e) =>
                                setInviteData({ ...inviteData, prenom: e.target.value })
                              }
                              placeholder="Prénom"
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label htmlFor="ent-invite-nom">Nom</label>
                          <div className="input-wrapper">
                            <User className="input-icon" size={16} />
                            <input
                              id="ent-invite-nom"
                              type="text"
                              required
                              value={inviteData.nom}
                              onChange={(e) =>
                                setInviteData({ ...inviteData, nom: e.target.value })
                              }
                              placeholder="Nom"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="ent-invite-email">Email</label>
                        <div className="input-wrapper">
                          <Mail className="input-icon" size={16} />
                          <input
                            id="ent-invite-email"
                            type="email"
                            required
                            value={inviteData.email}
                            onChange={(e) =>
                              setInviteData({ ...inviteData, email: e.target.value })
                            }
                            placeholder="admin@entreprise.com"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="ent-invite-password">Mot de passe temporaire</label>
                        <div className="input-wrapper">
                          <Lock className="input-icon" size={16} />
                          <input
                            id="ent-invite-password"
                            type="password"
                            required
                            value={inviteData.mot_de_passe}
                            onChange={(e) =>
                              setInviteData({ ...inviteData, mot_de_passe: e.target.value })
                            }
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="ent-invite-entreprise">Entreprise</label>
                        <div className="input-wrapper enterprises-invite-enterprise-picker">
                          <Building2 className="input-icon" size={16} />
                          <InviteEnterpriseSelect
                            id="ent-invite-entreprise"
                            value={inviteData.id_entreprise || ''}
                            entreprises={entreprises}
                            onSelect={(entrepriseId) =>
                              setInviteData({ ...inviteData, id_entreprise: entrepriseId })
                            }
                            onCreateNew={() => {
                              setIsCreatingFromInvite(true);
                              setEditingId(null);
                              setNewEntreprise({ nom: '', adresse: '' });
                              setEditPhone(createDefaultPhoneValue());
                              setEditPhoneError(undefined);
                              setIsModalOpen(true);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer compact-modal-footer">
                      <button type="button" onClick={closeInviteModal} className="secondary-btn">
                        Annuler
                      </button>
                      <button type="submit" className="primary-btn" disabled={isInviting}>
                        {isInviting ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          "Envoyer l'invitation"
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <div
                className="modal-overlay"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) closeEnterpriseModal();
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`modal-container enterprises-enterprise-modal enterprises-platform-modal${editingId ? ' enterprises-enterprise-modal--edit' : ''}`}
                  onMouseDown={(e) => e.stopPropagation()}
                >
            <div className="modal-header">
              <h2 className="enterprises-modal-title-gradient">
                {editingId ? 'Modifier l\'entreprise' : 'Ajouter une entreprise'}
              </h2>
              <button onClick={closeEnterpriseModal} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateOrUpdate} className="modal-form">
              <div className="form-group">
                <label>Nom de l'entreprise</label>
                <input 
                  type="text" 
                  required 
                  value={newEntreprise.nom}
                  onChange={(e) => setNewEntreprise({...newEntreprise, nom: e.target.value})}
                  placeholder="Ex: Tech Solutions"
                />
              </div>
              <div className="form-group">
                <label>Adresse / Siège social</label>
                <input 
                  type="text" 
                  value={newEntreprise.adresse}
                  onChange={(e) => setNewEntreprise({...newEntreprise, adresse: e.target.value})}
                  placeholder="Ex: Tunis, Tunisie"
                />
              </div>
              {editingId ? (
                <div className="form-group">
                  <label>Numéro de téléphone</label>
                  <div className="enterprises-edit-phone">
                    <PhoneCountryInput
                      value={editPhone}
                      onChange={(value) => {
                        setEditPhone(value);
                        setEditPhoneError(undefined);
                      }}
                      error={editPhoneError}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              ) : null}
              <div className="modal-footer enterprises-enterprise-modal__footer">
                <button type="button" onClick={closeEnterpriseModal} className="secondary-btn">Annuler</button>
                <button type="submit" className="primary-btn" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : (editingId ? 'Enregistrer les modifications' : 'Créer l\'entreprise')}
                </button>
              </div>
            </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deleteTarget && (
              <motion.div
                className="enterprises-delete-overlay"
                role="presentation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget && !isDeleting) closeDeleteModal();
                }}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="enterprises-delete-title"
                  className="enterprises-delete-modal"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <h3 id="enterprises-delete-title">Supprimer l&apos;entreprise</h3>
                  <p className="enterprises-delete-enterprise-name">{deleteTarget.nom}</p>
                  <p className="enterprises-delete-question">
                    Voulez-vous vraiment supprimer cette entreprise ?
                  </p>
                  <div className="enterprises-delete-actions">
                    <button
                      type="button"
                      className="enterprises-delete-btn enterprises-delete-btn--cancel"
                      onClick={closeDeleteModal}
                      disabled={isDeleting}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="enterprises-delete-btn enterprises-delete-btn--confirm"
                      onClick={() => void confirmDeleteEnterprise()}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="animate-spin" size={18} aria-hidden />
                          Suppression…
                        </>
                      ) : (
                        'Supprimer'
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
    </>
  );
};

export default Enterprises;
