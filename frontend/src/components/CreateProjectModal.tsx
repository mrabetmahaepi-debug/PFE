import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Type,
  AlignLeft,
  Loader2,
  Users,
  UserCircle2,
} from 'lucide-react';
import { projectService, buildCreateProjectRequestBody } from '../services/project.service';
import { teamService } from '../services/team.service';
import type { User } from '../types/auth.types';
import { PROJECT_MEMBER_ROLE_OPTIONS } from '../types/project';
import { dispatchProjectTeamChanged } from '../lib/workspaceEvents';
import './CreateProjectModal.css';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project?: any) => void;
  /** When set, the new project is created inside this space (sidebar dossier). */
  spaceId?: number | null;
}

const today = () => new Date().toISOString().split('T')[0];

const DEFAULT_MEMBER_ROLE = 'Membre';

function userNumericId(u: User): number {
  return Number(u.id_utilisateur ?? u.id);
}

function userDisplayName(u: User): string {
  const n = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return n || u.email;
}

const buildInitialFormData = () => ({
  nom_p: '',
  description_p: '',
  date_debut: today(),
  date_fin: '',
});

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  spaceId = null,
}) => {
  const [formData, setFormData] = useState(buildInitialFormData);
  const [chefId, setChefId] = useState<number | null>(null);
  const [extraMembers, setExtraMembers] = useState<{ userId: number; projectRole: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const data = await teamService.getAllMembers();
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTeamMembers([]);
      setError("Impossible de charger les membres de l'équipe.");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(buildInitialFormData());
    setChefId(null);
    setExtraMembers([]);
    setError('');
    setIsSubmitting(false);
    loadTeam();
  }, [isOpen, loadTeam]);

  useEffect(() => {
    if (!isOpen || teamLoading) return;
    if (chefId == null) return;
    if (!teamMembers.some((m) => userNumericId(m) === chefId)) {
      setChefId(null);
    }
  }, [isOpen, teamLoading, teamMembers, chefId]);

  useEffect(() => {
    if (!isOpen || chefId == null) return;
    setExtraMembers((prev) => prev.filter((m) => m.userId !== chefId));
  }, [chefId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const membersAvailableToAdd = teamMembers.filter(
    (m) =>
      userNumericId(m) !== chefId &&
      !extraMembers.some((row) => row.userId === userNumericId(m))
  );

  const addMemberFromSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    e.target.value = '';
    if (!v) return;
    const uid = Number(v);
    if (!Number.isFinite(uid) || uid <= 0) return;
    setExtraMembers((prev) => [...prev, { userId: uid, projectRole: DEFAULT_MEMBER_ROLE }]);
  };

  const updateMemberRole = (userId: number, projectRole: string) => {
    setExtraMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, projectRole } : m)));
  };

  const removeMemberRow = (userId: number) => {
    setExtraMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const userById = (id: number) => teamMembers.find((m) => userNumericId(m) === id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom_p.trim()) {
      setError('Le nom du projet est obligatoire.');
      return;
    }
    if (chefId == null) {
      setError('Veuillez sélectionner un chef de projet.');
      return;
    }
    if (formData.date_fin && formData.date_debut && formData.date_fin < formData.date_debut) {
      setError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const payload = buildCreateProjectRequestBody({
        nom_p: formData.nom_p.trim(),
        description_p: formData.description_p,
        date_debut: formData.date_debut,
        date_fin: formData.date_fin,
        chefId: chefId!,
        extraMembers,
        spaceId: spaceId ?? undefined,
      });
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[CreateProjectModal] create payload', payload);
      }
      const created = await projectService.create(payload);
      const createdId = Number(
        (created as { id_projet?: number })?.id_projet ??
          (created as { id?: number })?.id
      );
      if (Number.isFinite(createdId) && createdId > 0) {
        dispatchProjectTeamChanged({ projectId: createdId });
      }
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          (typeof err?.response?.data === 'string' ? err.response.data : null) ||
          err?.message ||
          'Erreur lors de la création du projet'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const noTeam = !teamLoading && teamMembers.length === 0;
  const submitDisabled =
    isSubmitting ||
    !formData.nom_p.trim() ||
    chefId == null ||
    teamLoading ||
    noTeam;

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-overlay compact-modal-overlay create-project-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-container compact-modal create-project-modal-wide"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header compact-modal-header">
              <div>
                <h2>Nouveau projet</h2>
                <p>Créez un nouveau projet pour votre équipe</p>
              </div>
              <button onClick={onClose} className="close-btn" type="button" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form compact-modal-form">
              <div className="compact-modal-body">
                {teamLoading && (
                  <div className="create-project-loading">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Chargement de l&apos;équipe…</span>
                  </div>
                )}

                {noTeam && (
                  <p className="create-project-team-empty" role="status">
                    Aucun membre disponible. Invitez des membres avant de créer un projet.
                  </p>
                )}

                <div className="create-project-section">
                  <h3 className="create-project-section-title">
                    <Type size={14} aria-hidden />
                    Informations du projet
                  </h3>
                  <div className="form-group">
                    <label htmlFor="project-name">
                      Nom du projet
                    </label>
                    <div className="input-wrapper">
                      <Type className="input-icon" size={16} />
                      <input
                        id="project-name"
                        type="text"
                        name="nom_p"
                        placeholder="Ex : Refonte Site Web"
                        value={formData.nom_p}
                        onChange={handleChange}
                        autoFocus
                        disabled={teamLoading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="project-description">Description</label>
                    <div className="input-wrapper">
                      <AlignLeft className="input-icon-top" size={16} />
                      <textarea
                        id="project-description"
                        name="description_p"
                        placeholder="Décrivez brièvement les objectifs du projet…"
                        value={formData.description_p}
                        onChange={handleChange}
                        rows={2}
                        disabled={teamLoading}
                      />
                    </div>
                  </div>
                </div>

                <div className="create-project-section">
                  <h3 className="create-project-section-title">
                    <UserCircle2 size={14} aria-hidden />
                    Responsable du projet
                  </h3>
                  <div className="form-group">
                    <label htmlFor="project-chef">
                      Chef de Projet
                    </label>
                    <div className="input-wrapper">
                      <UserCircle2 className="input-icon" size={16} />
                      <select
                        id="project-chef"
                        value={chefId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setChefId(v ? Number(v) : null);
                        }}
                        disabled={teamLoading || noTeam}
                      >
                        <option value="">Sélectionner un chef de projet</option>
                        {teamMembers.map((m) => {
                          const id = userNumericId(m);
                          return (
                            <option key={id} value={id}>
                              {userDisplayName(m)} — {m.email}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {chefId != null && (
                    <p className="create-project-chef-role-hint">
                      Rôle dans le projet : <strong>Chef de Projet</strong>
                    </p>
                  )}
                </div>

                <div className="create-project-section">
                  <h3 className="create-project-section-title">
                    <Users size={14} aria-hidden />
                    Équipe du projet
                  </h3>
                  <div className="form-group">
                    <label htmlFor="project-add-member">Membres de l&apos;équipe</label>
                    <div className="input-wrapper">
                      <Users className="input-icon" size={16} />
                      <select
                        id="project-add-member"
                        defaultValue=""
                        onChange={addMemberFromSelect}
                        disabled={teamLoading || noTeam || !chefId || membersAvailableToAdd.length === 0}
                      >
                        <option value="">
                          {membersAvailableToAdd.length === 0
                            ? 'Tous les membres disponibles sont ajoutés'
                            : 'Ajouter des membres'}
                        </option>
                        {membersAvailableToAdd.map((m) => {
                          const id = userNumericId(m);
                          return (
                            <option key={id} value={id}>
                              {userDisplayName(m)} — {m.email}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {extraMembers.length > 0 && (
                    <ul className="create-project-member-list" aria-label="Membres ajoutés">
                      {extraMembers.map((row) => {
                        const u = userById(row.userId);
                        return (
                          <li key={row.userId} className="create-project-member-row">
                            <div className="create-project-member-identity">
                              <span className="create-project-member-name">
                                {u ? userDisplayName(u) : `Utilisateur #${row.userId}`}
                              </span>
                              <span className="create-project-member-email">{u?.email}</span>
                            </div>
                            <label className="create-project-role-label">
                              <span>Rôle dans le projet</span>
                              <select
                                value={row.projectRole}
                                onChange={(e) => updateMemberRole(row.userId, e.target.value)}
                              >
                                {PROJECT_MEMBER_ROLE_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="create-project-member-remove"
                              onClick={() => removeMemberRow(row.userId)}
                              aria-label="Retirer ce membre"
                            >
                              <X size={16} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="create-project-section">
                  <h3 className="create-project-section-title">
                    <Calendar size={14} aria-hidden />
                    Dates
                  </h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="project-start">Date de début</label>
                      <div className="input-wrapper">
                        <Calendar className="input-icon" size={16} />
                        <input
                          id="project-start"
                          type="date"
                          name="date_debut"
                          value={formData.date_debut}
                          onChange={handleChange}
                          disabled={teamLoading}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="project-end">
                        Fin prévue <span className="optional">optionnel</span>
                      </label>
                      <div className="input-wrapper">
                        <Calendar className="input-icon" size={16} />
                        <input
                          id="project-end"
                          type="date"
                          name="date_fin"
                          value={formData.date_fin}
                          onChange={handleChange}
                          disabled={teamLoading}
                        />
                      </div>
                    </div>
                  </div>
                </div>


                {error && <p className="form-error">{error}</p>}
              </div>

              <div className="modal-footer compact-modal-footer">
                <button type="button" onClick={onClose} className="secondary-btn" disabled={isSubmitting}>
                  Annuler
                </button>
                <button type="submit" className="primary-btn" disabled={submitDisabled}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Créer le projet'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
};

export default CreateProjectModal;
