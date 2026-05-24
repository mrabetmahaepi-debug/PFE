import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Loader2, Plus, Save, Shield, Users, X } from 'lucide-react';
import { PROJECT_POSTE_OPTIONS } from '../lib/projectRoleLabels';
import { useSetMemberTopbarTitle } from '../context/MemberTopbarTitleContext';
import {
  projectTeamAccessService,
  type ProjectEquipeMember,
  type ProjectEquipeSnapshot,
} from '../services/projectTeamAccess.service';
import { projectService } from '../services/project.service';
import type { User } from '../types/auth.types';
import { dispatchWorkspaceRefresh } from '../lib/workspaceEvents';
import './ProjectEquipePage.css';

const ASSIGNABLE_PROFILES = PROJECT_POSTE_OPTIONS.filter(
  (o) => o !== 'Chef de projet'
);

function memberName(m: ProjectEquipeMember): string {
  const n = `${m.prenom || ''} ${m.nom || ''}`.trim();
  return n || m.email || `Membre #${m.userId}`;
}

function userDisplayName(u: User): string {
  const n = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return n || u.email || `Utilisateur #${u.id_utilisateur}`;
}

function memberHasTeamManage(member: ProjectEquipeMember): boolean {
  return member.permissions.some(
    (p) =>
      p.enabled &&
      (p.key === 'TEAM_MANAGE' || p.key === 'manage_project_members')
  );
}

const ProjectEquipePage: React.FC = () => {
  const { projectId: projectIdParam } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  useSetMemberTopbarTitle('Équipe');

  const [managedProjects, setManagedProjects] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const [snapshot, setSnapshot] = useState<ProjectEquipeSnapshot | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<User[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('Développeur');
  const [addingMember, setAddingMember] = useState(false);

  const loadManaged = useCallback(async () => {
    try {
      const projects = await projectTeamAccessService.getManagedProjects();
      setManagedProjects(projects);
      const fromUrl = projectIdParam ? Number(projectIdParam) : null;
      if (
        fromUrl &&
        Number.isFinite(fromUrl) &&
        projects.some((p) => p.id === fromUrl)
      ) {
        setSelectedProjectId(fromUrl);
      } else if (projects.length > 0) {
        setSelectedProjectId(projects[0].id);
      } else {
        setSelectedProjectId(null);
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de charger vos projets.');
    } finally {
      setLoading(false);
    }
  }, [projectIdParam]);

  const loadEquipe = useCallback(async (projectId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectTeamAccessService.getEquipe(projectId);
      setSnapshot(data);
    } catch (err) {
      console.error(err);
      setSnapshot(null);
      setError("Vous n'avez pas accès à la gestion de l'équipe pour ce projet.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCandidates = useCallback(async (projectId: number) => {
    setCandidatesLoading(true);
    try {
      const users = await projectService.getTeamCandidates(projectId);
      setCandidates(users);
    } catch (err) {
      console.error(err);
      setCandidates([]);
      setError('Impossible de charger la liste des utilisateurs.');
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManaged();
  }, [loadManaged]);

  useEffect(() => {
    if (selectedProjectId != null) {
      void loadEquipe(selectedProjectId);
      navigate(`/equipe/${selectedProjectId}`, { replace: true });
    }
  }, [selectedProjectId, loadEquipe, navigate]);

  const openAddModal = () => {
    if (selectedProjectId == null) return;
    setSelectedUserId('');
    setSelectedProfile('Développeur');
    setAddModalOpen(true);
    void loadCandidates(selectedProjectId);
  };

  const handleAddMember = async () => {
    if (selectedProjectId == null || selectedUserId === '') return;
    setAddingMember(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await projectTeamAccessService.addMember(
        selectedProjectId,
        {
          userId: Number(selectedUserId),
          profilePoste: selectedProfile,
        }
      );
      setSnapshot(updated);
      const added = updated.members.find(
        (m) => m.userId === Number(selectedUserId)
      );
      setSuccess(
        added
          ? `${memberName(added)} a été ajouté(e) à l'équipe.`
          : 'Membre ajouté à l\'équipe.'
      );
      setAddModalOpen(false);
      dispatchWorkspaceRefresh();
    } catch (err) {
      console.error(err);
      setError("Impossible d'ajouter ce membre.");
    } finally {
      setAddingMember(false);
    }
  };

  const editableMembers = useMemo(
    () => (snapshot?.members ?? []).filter((m) => !memberHasTeamManage(m)),
    [snapshot]
  );

  const updateMember = (
    userId: number,
    updater: (m: ProjectEquipeMember) => ProjectEquipeMember
  ) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        members: prev.members.map((m) =>
          m.userId === userId ? updater(m) : m
        ),
      };
    });
  };

  const handleSave = async (member: ProjectEquipeMember) => {
    if (selectedProjectId == null) return;
    setSavingUserId(member.userId);
    setError(null);
    setSuccess(null);
    try {
      const updated = await projectTeamAccessService.saveMemberEquipe(
        selectedProjectId,
        member.userId,
        {
          roleProjet: member.roleProjet,
          permissions: member.permissions,
          sprints: member.sprints,
          lists: member.lists,
          tasks: member.tasks,
        }
      );
      setSnapshot(updated);
      setSuccess(`Accès enregistrés pour ${memberName(member)}.`);
      dispatchWorkspaceRefresh();
    } catch (err) {
      console.error(err);
      setError('Enregistrement impossible.');
    } finally {
      setSavingUserId(null);
    }
  };

  if (!loading && managedProjects.length === 0) {
    return (
      <div className="dashboard-page project-equipe-page">
        <p className="project-equipe-empty-hint">
          Aucun projet où vous pouvez gérer l&apos;équipe. La permission{' '}
          <strong>Gérer l&apos;équipe</strong> est requise sur un projet.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page project-equipe-page" aria-label="Gestion de l'équipe projet">
      <header className="project-equipe-header">
        <div className="project-equipe-header__main">
          <Users size={22} aria-hidden />
          <div>
            <h1 className="project-equipe-title">Équipe</h1>
            <p className="project-equipe-subtitle">
              Gérez les membres, leurs accès et permissions par projet.
            </p>
          </div>
        </div>
        {managedProjects.length > 1 && (
          <label className="project-equipe-project-select">
            <span>Projet</span>
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            >
              {managedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {error && (
        <p className="project-equipe-alert project-equipe-alert--error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="project-equipe-alert project-equipe-alert--success" role="status">
          {success}
        </p>
      )}

      {loading ? (
        <div className="project-equipe-loading" role="status">
          <Loader2 size={20} className="spin" aria-hidden />
          Chargement de l&apos;équipe…
        </div>
      ) : snapshot ? (
        <section className="project-equipe-table-section">
          <div className="project-equipe-table-section-head">
            <div className="project-equipe-table-section-head__left">
              <h2>{snapshot.projectName}</h2>
              <span className="project-equipe-count">
                {snapshot.members.length} membre
                {snapshot.members.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              type="button"
              className="project-equipe-add-btn"
              onClick={openAddModal}
            >
              <Plus size={16} aria-hidden />
              Ajouter un membre
            </button>
          </div>

          <div className="project-equipe-table-wrapper">
            <table className="project-equipe-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Profil</th>
                  <th>Tâches assignées</th>
                  <th>Permissions</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {snapshot.members.map((member) => {
                  const expanded = expandedUserId === member.userId;
                  const teamManager = memberHasTeamManage(member);
                  const enabledCount = member.permissions.filter(
                    (p) => p.enabled
                  ).length;
                  return (
                    <React.Fragment key={member.userId}>
                      <tr className={expanded ? 'is-expanded' : undefined}>
                        <td>
                          <div className="project-equipe-member-name">
                            {memberName(member)}
                            {member.email ? (
                              <span className="project-equipe-member-email">
                                {member.email}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {teamManager ? (
                            <span className="project-equipe-role-badge project-equipe-role-badge--chef">
                              {member.roleProjet}
                            </span>
                          ) : (
                            <select
                              className="project-equipe-role-select"
                              value={member.roleProjet}
                              onChange={(e) =>
                                updateMember(member.userId, (m) => ({
                                  ...m,
                                  roleProjet: e.target.value,
                                }))
                              }
                            >
                              {ASSIGNABLE_PROFILES.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>{member.assignedTaskCount}</td>
                        <td>
                          {teamManager ? (
                            <span className="project-equipe-perm-summary">
                              Accès complet
                            </span>
                          ) : (
                            <span className="project-equipe-perm-summary">
                              {enabledCount} permission
                              {enabledCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td>
                          {!teamManager && (
                            <button
                              type="button"
                              className="project-equipe-expand-btn"
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedUserId(
                                  expanded ? null : member.userId
                                )
                              }
                            >
                              <ChevronDown
                                size={16}
                                className={expanded ? 'is-open' : undefined}
                              />
                              Détails
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && !teamManager && (
                        <tr className="project-equipe-detail-row">
                          <td colSpan={5}>
                            <div className="project-equipe-detail-panel">
                              <div className="project-equipe-perm-grid">
                                <h3>
                                  <Shield size={14} aria-hidden />
                                  Permissions
                                </h3>
                                <div className="project-equipe-perm-toggles">
                                  {member.permissions.map((perm) => (
                                    <label
                                      key={perm.key}
                                      className="project-equipe-perm-toggle"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={perm.enabled}
                                        onChange={(e) =>
                                          updateMember(member.userId, (m) => ({
                                            ...m,
                                            permissions: m.permissions.map(
                                              (p) =>
                                                p.key === perm.key
                                                  ? {
                                                      ...p,
                                                      enabled: e.target.checked,
                                                    }
                                                  : p
                                            ),
                                          }))
                                        }
                                      />
                                      <span>{perm.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <details className="project-equipe-resource-block">
                                <summary>Sprints accessibles</summary>
                                <div className="project-equipe-resource-list">
                                  {member.sprints.map((s) => (
                                    <label key={s.id}>
                                      <input
                                        type="checkbox"
                                        checked={s.granted}
                                        onChange={(e) =>
                                          updateMember(member.userId, (m) => ({
                                            ...m,
                                            sprints: m.sprints.map((x) =>
                                              x.id === s.id
                                                ? {
                                                    ...x,
                                                    granted: e.target.checked,
                                                  }
                                                : x
                                            ),
                                          }))
                                        }
                                      />
                                      {s.name}
                                    </label>
                                  ))}
                                </div>
                              </details>

                              <details className="project-equipe-resource-block">
                                <summary>Listes accessibles</summary>
                                <div className="project-equipe-resource-list">
                                  {member.lists.map((l) => (
                                    <label key={l.id}>
                                      <input
                                        type="checkbox"
                                        checked={l.granted}
                                        onChange={(e) =>
                                          updateMember(member.userId, (m) => ({
                                            ...m,
                                            lists: m.lists.map((x) =>
                                              x.id === l.id
                                                ? {
                                                    ...x,
                                                    granted: e.target.checked,
                                                  }
                                                : x
                                            ),
                                          }))
                                        }
                                      />
                                      {l.name}
                                    </label>
                                  ))}
                                </div>
                              </details>

                              <button
                                type="button"
                                className="project-equipe-save-btn"
                                disabled={savingUserId === member.userId}
                                onClick={() => void handleSave(member)}
                              >
                                {savingUserId === member.userId ? (
                                  <Loader2 size={16} className="spin" />
                                ) : (
                                  <Save size={16} />
                                )}
                                Enregistrer
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editableMembers.length === 0 && snapshot.members.length > 0 && (
            <p className="project-equipe-empty-hint project-equipe-empty-hint--inline">
              Utilisez « Ajouter un membre » pour inviter des collaborateurs sur
              ce projet.
            </p>
          )}
        </section>
      ) : null}

      {addModalOpen && (
        <div
          className="project-equipe-modal-backdrop"
          role="presentation"
          onClick={() => !addingMember && setAddModalOpen(false)}
        >
          <div
            className="project-equipe-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-equipe-add-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="project-equipe-modal__header">
              <h2 id="project-equipe-add-title">Ajouter un membre</h2>
              <button
                type="button"
                className="project-equipe-modal__close"
                aria-label="Fermer"
                disabled={addingMember}
                onClick={() => setAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="project-equipe-modal__body">
              <label className="project-equipe-modal__field">
                <span>Utilisateur</span>
                {candidatesLoading ? (
                  <div className="project-equipe-modal__loading">
                    <Loader2 size={16} className="spin" />
                    Chargement…
                  </div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) =>
                      setSelectedUserId(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    disabled={addingMember || candidates.length === 0}
                  >
                    <option value="">Sélectionner un utilisateur</option>
                    {candidates.map((u) => (
                      <option key={u.id_utilisateur} value={u.id_utilisateur}>
                        {userDisplayName(u)}
                        {u.email ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!candidatesLoading && candidates.length === 0 && (
                  <span className="project-equipe-modal__hint">
                    Aucun utilisateur disponible à ajouter.
                  </span>
                )}
              </label>

              <label className="project-equipe-modal__field">
                <span>Profil de permissions</span>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  disabled={addingMember}
                >
                  {ASSIGNABLE_PROFILES.map((profile) => (
                    <option key={profile} value={profile}>
                      {profile}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <footer className="project-equipe-modal__footer">
              <button
                type="button"
                className="project-equipe-modal__cancel"
                disabled={addingMember}
                onClick={() => setAddModalOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="project-equipe-save-btn"
                disabled={
                  addingMember || selectedUserId === '' || candidatesLoading
                }
                onClick={() => void handleAddMember()}
              >
                {addingMember ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Plus size={16} />
                )}
                Enregistrer
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectEquipePage;
