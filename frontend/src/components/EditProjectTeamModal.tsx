import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Users, UserCircle2 } from 'lucide-react';
import { projectService, buildCreateProjectRequestBody } from '../services/project.service';
import { useAuth } from '../hooks/useAuth';
import {
  canManageProjectTeam,
  normalizeProjectManageContext,
  resolveUserNumericId,
  type ProjectManageContext,
} from '../lib/projectManageAccess';
import type { User } from '../types/auth.types';
import { PROJECT_MEMBER_ROLE_OPTIONS } from '../types/project';
import './CreateProjectModal.css';

export type EditProjectTeamModalProps = {
  isOpen: boolean;
  projectId: number;
  projectNom?: string | null;
  chefId: number | null;
  team?: {
    userId: number | null;
    roleProjet: string;
    email: string;
    prenom: string;
    nom: string;
  }[];
  project?: ProjectManageContext | Record<string, unknown> | null;
  onClose: () => void;
  onSuccess: () => void;
};

const DEFAULT_MEMBER_ROLE = PROJECT_MEMBER_ROLE_OPTIONS[0];

function userNumericId(u: User): number {
  return Number(u.id_utilisateur ?? u.id);
}

function userDisplayName(u: User): string {
  const n = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return n || u.email;
}

const EditProjectTeamModal: React.FC<EditProjectTeamModalProps> = ({
  isOpen,
  projectId,
  projectNom,
  chefId: chefIdProp,
  team,
  project: projectProp,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();

  const projectCtx = useMemo(() => {
    const raw = projectProp ?? { id_projet: projectId, chef_id: chefIdProp, chef_de_projet_id: chefIdProp };
    return normalizeProjectManageContext(raw);
  }, [
    projectId,
    chefIdProp,
    (projectProp as { chef_id?: number | null } | null | undefined)?.chef_id,
    (projectProp as { chef_de_projet_id?: number | null } | null | undefined)?.chef_de_projet_id,
    (projectProp as { projectManagerId?: number | null } | null | undefined)?.projectManagerId,
    (projectProp as { currentUserProjectRole?: string | null } | null | undefined)
      ?.currentUserProjectRole,
  ]);

  const canManage = useMemo(
    () => Boolean(user && canManageProjectTeam(user, projectCtx)),
    [user, projectCtx]
  );

  const [chefId, setChefId] = useState<number | null>(null);
  const [extraMembers, setExtraMembers] = useState<{ userId: number; projectRole: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadGenRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      setTeamLoading(false);
      return;
    }

    if (!user) return;

    const gen = ++loadGenRef.current;
    setError('');
    setIsSubmitting(false);

    if (!canManageProjectTeam(user, projectCtx)) {
      setTeamMembers([]);
      setTeamLoading(false);
      setError("Vous n'avez pas la permission de gérer l'équipe de ce projet.");
      return;
    }

    setTeamLoading(true);
    void (async () => {
      try {
        const data = await projectService.getTeamCandidates(projectId);
        if (gen !== loadGenRef.current) return;
        const list = Array.isArray(data) ? data : [];
        setTeamMembers(list);
        if (list.length === 0) {
          setError('Aucun membre disponible dans votre entreprise.');
        }
      } catch (e: unknown) {
        if (gen !== loadGenRef.current) return;
        console.error(e);
        setTeamMembers([]);
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Impossible de charger les membres de l'équipe.";
        setError(msg);
      } finally {
        if (gen === loadGenRef.current) {
          setTeamLoading(false);
        }
      }
    })();

    return () => {
      loadGenRef.current += 1;
    };
  }, [
    isOpen,
    projectId,
    user,
    chefIdProp,
    projectCtx?.chef_id,
    projectCtx?.chef_de_projet_id,
    projectCtx?.projectManagerId,
    canManage,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const uid = resolveUserNumericId(user);
    let initialChef = chefIdProp ?? null;
    if (initialChef == null && uid != null && projectCtx) {
      const leaderIds = [
        projectCtx.chef_id,
        projectCtx.chef_de_projet_id,
        projectCtx.projectManagerId,
        projectCtx.chefProjetId,
      ]
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (leaderIds.includes(uid)) initialChef = uid;
    }
    setChefId(initialChef);
    const chef = initialChef ?? -1;
    const opts = PROJECT_MEMBER_ROLE_OPTIONS as readonly string[];
    const rows = (team ?? [])
      .filter((r) => r.userId != null && Number(r.userId) !== chef)
      .map((r) => ({
        userId: Number(r.userId),
        projectRole: opts.includes(r.roleProjet) ? r.roleProjet : DEFAULT_MEMBER_ROLE,
      }));
    setExtraMembers(rows);
  }, [isOpen, chefIdProp, team, user, projectCtx]);

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
    if (!user || !canManage) {
      setError('Permission refusée.');
      return;
    }
    if (chefId == null) {
      setError('Veuillez sélectionner un chef de projet.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload = buildCreateProjectRequestBody({
        nom_p: (projectNom || `Projet #${projectId}`).trim(),
        description_p: '',
        date_debut: today,
        date_fin: today,
        chefId,
        extraMembers,
      });
      await projectService.updateTeam(projectId, payload, {
        project: projectCtx ?? undefined,
        user,
      });
      window.dispatchEvent(new CustomEvent('projects:updated'));
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
          "Échec de l'enregistrement de l'équipe."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  if (isOpen && user && !canManage && !teamLoading) {
    return createPortal(
      <div className="modal-overlay compact-modal-overlay" onMouseDown={onClose}>
        <div className="modal-container compact-modal" onMouseDown={(e) => e.stopPropagation()}>
          <p style={{ padding: '1.5rem', color: '#b91c1c' }}>
            Vous n&apos;avez pas la permission de gérer l&apos;équipe de ce projet.
          </p>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>,
      document.body
    );
  }

  const noTeam = !teamLoading && teamMembers.length === 0;
  const submitDisabled = isSubmitting || chefId == null || teamLoading || noTeam || !canManage;

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-overlay compact-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-container compact-modal create-project-modal-wide edit-project-team-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header compact-modal-header edit-project-team-modal-header">
              <h2>Équipe du projet</h2>
              <button onClick={onClose} className="close-btn" type="button" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form compact-modal-form">
              <div className="compact-modal-body">
                {teamLoading ? (
                  <div className="create-project-loading">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Chargement de l&apos;équipe…</span>
                  </div>
                ) : (
                  <>
                    {error && (
                      <p className="create-project-team-empty" style={{ color: '#b91c1c' }}>
                        {error}
                      </p>
                    )}

                    <div className="create-project-section">
                      <h3 className="create-project-section-title">
                        <UserCircle2 size={14} aria-hidden />
                        Chef de projet
                      </h3>
                      <div className="form-group form-group--flush">
                        <div className="input-wrapper">
                          <UserCircle2 className="input-icon" size={16} />
                          <select
                            id="edit-project-chef"
                            aria-label="Chef de projet"
                            required
                            value={chefId ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setChefId(v ? Number(v) : null);
                            }}
                            disabled={noTeam}
                          >
                            <option value="">Sélectionner</option>
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

                    <div className="create-project-section">
                      <h3 className="create-project-section-title">
                        <Users size={14} aria-hidden />
                        Membres
                      </h3>
                      <div className="form-group form-group--flush">
                        <div className="input-wrapper">
                          <Users className="input-icon" size={16} />
                          <select
                            id="edit-add-member"
                            aria-label="Ajouter un membre"
                            defaultValue=""
                            onChange={addMemberFromSelect}
                            disabled={noTeam || !chefId || membersAvailableToAdd.length === 0}
                          >
                            <option value="">
                              {membersAvailableToAdd.length === 0
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

                      {extraMembers.length > 0 && (
                        <ul className="create-project-member-list" aria-label="Membres">
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
                                  aria-label="Retirer"
                                >
                                  <X size={16} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div
                className="compact-modal-footer"
                style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
              >
                <button type="button" className="secondary-btn" onClick={onClose}>
                  Annuler
                </button>
                <button type="submit" className="primary-btn" disabled={submitDisabled}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Enregistrer'}
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

export default EditProjectTeamModal;
