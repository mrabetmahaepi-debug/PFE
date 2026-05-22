import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Type,
  AlignLeft,
  Loader2,
  UserCircle2,
  Users,
} from 'lucide-react';
import {
  projectService,
  buildCreateProjectRequestBody,
} from '../services/project.service';
import { PROJECT_MEMBER_ROLE_OPTIONS, type Projet } from '../types/project';
import type { User } from '../types/auth.types';
import { useAuth } from '../hooks/useAuth';
import {
  canManageProject,
  normalizeProjectManageContext,
  type ProjectManageContext,
} from '../lib/projectManageAccess';
import { usePermission } from '../hooks/usePermission';
import { isEnterpriseAdmin } from '../lib/permissions';
import { projectCan } from '../lib/projectPermissions';
import './CreateProjectModal.css';

export type EditProjectModalProps = {
  isOpen: boolean;
  projectId: number | null;
  onClose: () => void;
  onSuccess: () => void;
};

const DEFAULT_MEMBER_ROLE = PROJECT_MEMBER_ROLE_OPTIONS[0];

function toDateInputValue(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function validateProjectDates(debut: string, fin: string): string | null {
  if (!debut.trim() || !fin.trim()) {
    return 'Veuillez renseigner la date de début et la date de fin.';
  }
  const start = new Date(`${debut}T00:00:00`);
  const end = new Date(`${fin}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Dates invalides.';
  }
  if (end < start) {
    return 'La date de fin ne peut pas être antérieure à la date de début.';
  }
  return null;
}

function userNumericId(u: User): number {
  return Number(u.id_utilisateur ?? u.id);
}

function userDisplayName(u: User): string {
  const n = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return n || u.email;
}

function resolveChefUserId(project: Projet): number | null {
  const p = project as Projet & {
    chef_de_projet?: { id_utilisateur?: number; id?: number };
  };
  if (p.chef_de_projet_id != null && Number(p.chef_de_projet_id) > 0) {
    return Number(p.chef_de_projet_id);
  }
  if (p.chef_id != null && Number(p.chef_id) > 0) return Number(p.chef_id);
  const chefUser = p.chef_de_projet;
  if (chefUser?.id_utilisateur != null) return Number(chefUser.id_utilisateur);
  if (chefUser?.id != null) return Number(chefUser.id);
  const fromTeam = project.projectTeam?.find((m) =>
    /chef/i.test(m.roleProjet || ''),
  );
  if (fromTeam?.userId != null) return Number(fromTeam.userId);
  return null;
}

function mapProjectTeamToExtraMembers(
  team: Projet['projectTeam'],
  chefId: number | null,
): { userId: number; projectRole: string }[] {
  const chef = chefId ?? -1;
  const opts = PROJECT_MEMBER_ROLE_OPTIONS as readonly string[];
  return (team ?? [])
    .filter((r) => r.userId != null && Number(r.userId) !== chef)
    .map((r) => ({
      userId: Number(r.userId),
      projectRole: opts.includes(r.roleProjet) ? r.roleProjet : DEFAULT_MEMBER_ROLE,
    }));
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  projectId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { can } = usePermission();
  const [projectCtx, setProjectCtx] = useState<ProjectManageContext | null>(null);
  const canPickChefGlobally = isEnterpriseAdmin(user) || can('PROJECT_EDIT');

  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [chefId, setChefId] = useState<number | null>(null);
  const [extraMembers, setExtraMembers] = useState<{ userId: number; projectRole: string }[]>(
    [],
  );
  const [canManageChef, setCanManageChef] = useState(false);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [dateError, setDateError] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTeamCandidates = useCallback(async (id: number) => {
    setTeamLoading(true);
    try {
      const data = await projectService.getTeamCandidates(id);
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      console.error(e);
      setTeamMembers([]);
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Impossible de charger les membres disponibles.";
      setError((prev) => prev || msg);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const loadProject = useCallback(
    async (id: number) => {
      setLoading(true);
      setError('');
      try {
        const project = await projectService.getById(id);
        setNom(project.nom_p || '');
        setDescription(project.description_p || '');
        setDateDebut(toDateInputValue(project.date_debut));
        setDateFin(toDateInputValue(project.date_fin));
        const ctx = normalizeProjectManageContext(project);
        setProjectCtx(ctx);
        const chef = resolveChefUserId(project);
        setChefId(chef);
        setExtraMembers(mapProjectTeamToExtraMembers(project.projectTeam, chef));
        const canManage = canManageProject(user, project);
        const pp = project.currentUserPermissions ?? [];
        const manageTeam =
          canManage && (canPickChefGlobally || projectCan(pp, 'manage_project_members'));
        setCanManageChef(manageTeam);
        setCanManageMembers(manageTeam);
        if (manageTeam) {
          await loadTeamCandidates(id);
        } else {
          setTeamMembers([]);
        }
      } catch (e: unknown) {
        console.error(e);
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Impossible de charger le projet.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [can, canPickChefGlobally, loadTeamCandidates, user],
  );

  useEffect(() => {
    if (!isOpen || projectId == null) return;
    void loadProject(projectId);
  }, [isOpen, projectId, loadProject]);

  useEffect(() => {
    if (!isOpen || chefId == null) return;
    setExtraMembers((prev) => prev.filter((m) => m.userId !== chefId));
  }, [chefId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isSubmitting, onClose]);

  const membersAvailableToAdd = teamMembers.filter(
    (m) =>
      userNumericId(m) !== chefId &&
      !extraMembers.some((row) => row.userId === userNumericId(m)),
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
    setExtraMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, projectRole } : m)),
    );
  };

  const removeMemberRow = (userId: number) => {
    setExtraMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const userById = (id: number) => teamMembers.find((m) => userNumericId(m) === id);

  const showChefSection = canManageChef || canManageMembers;
  const showMembersSection = canManageMembers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (projectId == null || !canManageProject(user, projectCtx)) return;
    if (!nom.trim()) {
      setError('Le nom du projet est obligatoire.');
      return;
    }
    const dateErr = validateProjectDates(dateDebut, dateFin);
    if (dateErr) {
      setDateError(dateErr);
      return;
    }
    if (canManageMembers && chefId == null) {
      setError('Veuillez sélectionner un chef de projet pour enregistrer l\'équipe.');
      return;
    }
    setDateError('');
    setError('');
    setIsSubmitting(true);
    try {
      const date_debut = new Date(`${dateDebut}T00:00:00`).toISOString();
      const date_fin = new Date(`${dateFin}T00:00:00`).toISOString();
      await projectService.update(
        projectId,
        {
          nom_p: nom.trim(),
          description_p: description,
          date_debut,
          date_fin,
        },
        { project: projectCtx ?? undefined }
      );

      if (canManageMembers && chefId != null) {
        const payload = buildCreateProjectRequestBody({
          nom_p: nom.trim(),
          description_p: description,
          date_debut: dateDebut,
          date_fin: dateFin,
          chefId,
          extraMembers,
        });
        await projectService.updateTeam(projectId, payload, {
          project: projectCtx ?? undefined,
        });
      } else if (canManageChef && chefId != null) {
        await projectService.assignChef(projectId, chefId, {
          project: projectCtx ?? undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      setError(
        ax?.response?.data?.message ||
          ax?.response?.data?.error ||
          ax?.message ||
          'Erreur lors de la mise à jour du projet.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;
  if (isOpen && projectId != null && projectCtx && !canManageProject(user, projectCtx)) {
    return null;
  }

  const noTeam = !teamLoading && teamMembers.length === 0;

  const modal = (
    <AnimatePresence>
      {isOpen && projectId != null && (
        <div
          className="modal-overlay compact-modal-overlay create-project-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-container compact-modal create-project-modal-wide edit-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header compact-modal-header">
              <div>
                <h2 id="edit-project-modal-title">Modifier le projet</h2>
                <p>Mettez à jour les informations du projet</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="close-btn"
                aria-label="Fermer"
                disabled={isSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form compact-modal-form">
              <div className="compact-modal-body">
                {(loading || teamLoading) && (
                  <div className="create-project-loading">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Chargement…</span>
                  </div>
                )}

                {error && !loading && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                {!loading && (
                  <>
                    <div className="create-project-section">
                      <h3 className="create-project-section-title">
                        <Type size={14} aria-hidden />
                        Informations du projet
                      </h3>
                      <div className="form-group">
                        <label htmlFor="edit-project-name">Nom du projet</label>
                        <div className="input-wrapper">
                          <Type className="input-icon" size={16} />
                          <input
                            id="edit-project-name"
                            type="text"
                            value={nom}
                            onChange={(e) => setNom(e.target.value)}
                            required
                            disabled={isSubmitting}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="edit-project-description">Description</label>
                        <div className="input-wrapper">
                          <AlignLeft className="input-icon-top" size={16} />
                          <textarea
                            id="edit-project-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="create-project-section">
                      <h3 className="create-project-section-title">
                        <Calendar size={14} aria-hidden />
                        Dates
                      </h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="edit-project-start">Date de début</label>
                          <div className="input-wrapper">
                            <Calendar className="input-icon" size={16} />
                            <input
                              id="edit-project-start"
                              type="date"
                              value={dateDebut}
                              onChange={(e) => {
                                setDateDebut(e.target.value);
                                setDateError('');
                              }}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label htmlFor="edit-project-end">Date de fin</label>
                          <div className="input-wrapper">
                            <Calendar className="input-icon" size={16} />
                            <input
                              id="edit-project-end"
                              type="date"
                              value={dateFin}
                              min={dateDebut || undefined}
                              onChange={(e) => {
                                setDateFin(e.target.value);
                                setDateError('');
                              }}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                      </div>
                      {dateError && (
                        <p className="form-error" role="alert">
                          {dateError}
                        </p>
                      )}
                    </div>

                    {showChefSection && (
                      <div className="create-project-section create-project-section--tight-top">
                        <h3 className="create-project-section-title">
                          <UserCircle2 size={14} aria-hidden />
                          Responsable du projet
                        </h3>
                        <div className="form-group form-group--flush">
                          <label htmlFor="edit-project-chef">Chef de projet</label>
                          <div className="input-wrapper">
                            <UserCircle2 className="input-icon" size={16} />
                            <select
                              id="edit-project-chef"
                              value={chefId ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChefId(v ? Number(v) : null);
                              }}
                              disabled={isSubmitting || teamLoading || noTeam}
                              required={canManageMembers}
                            >
                              <option value="">
                                {canManageMembers ? 'Sélectionner un chef de projet' : 'Non assigné'}
                              </option>
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
                      </div>
                    )}

                    {showMembersSection && (
                      <div className="create-project-section">
                        <h3 className="create-project-section-title">
                          <Users size={14} aria-hidden />
                          Membres du projet
                        </h3>
                        <div className="form-group form-group--flush">
                          <label htmlFor="edit-add-member">Ajouter un membre</label>
                          <div className="input-wrapper">
                            <Users className="input-icon" size={16} />
                            <select
                              id="edit-add-member"
                              aria-label="Ajouter un membre"
                              defaultValue=""
                              onChange={addMemberFromSelect}
                              disabled={
                                isSubmitting ||
                                teamLoading ||
                                noTeam ||
                                !chefId ||
                                membersAvailableToAdd.length === 0
                              }
                            >
                              <option value="">
                                {!chefId
                                  ? 'Sélectionnez d\'abord un chef de projet'
                                  : membersAvailableToAdd.length === 0
                                    ? 'Aucun membre à ajouter'
                                    : 'Ajouter…'}
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

                        {extraMembers.length > 0 ? (
                          <ul className="create-project-member-list" aria-label="Membres du projet">
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
                                      onChange={(e) =>
                                        updateMemberRole(row.userId, e.target.value)
                                      }
                                      disabled={isSubmitting}
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
                                    disabled={isSubmitting}
                                  >
                                    <X size={16} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="create-project-team-empty" role="status">
                            Aucun membre additionnel pour ce projet.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="compact-modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSubmitting || loading || !nom.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Enregistrement…
                    </>
                  ) : (
                    'Enregistrer'
                  )}
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

export default EditProjectModal;
