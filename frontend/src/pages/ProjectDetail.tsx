import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Building2,
  Users,
  CheckSquare,
  TrendingUp,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { teamService } from '../services/team.service';
import { usePermission } from '../hooks/usePermission';
import { useAuth } from '../hooks/useAuth';
import {
  canManageProject,
  canManageProjectTeam,
  normalizeProjectManageContext,
} from '../lib/projectManageAccess';
import type { Projet } from '../types/project';
import type { User } from '../types/auth.types';
import { projectCan } from '../lib/projectPermissions';
import EditProjectTeamModal from '../components/EditProjectTeamModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import UserAvatar, { type UserAvatarUser } from '../components/UserAvatar';
import {
  dispatchProjectTeamChanged,
  PROJECTS_UPDATED_EVENT,
  PROJECT_TASK_STATS_CHANGED_EVENT,
  WORKSPACE_REFRESH_EVENT,
} from '../lib/workspaceEvents';
import { isChefDeProjetMemberRole } from '../lib/projectRoleLabels';
import { useAdminPageHeader } from '../context/AdminPageHeaderContext';
import './ProjectDetail.css';

function toDateInputValue(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatProjectDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

function normalizeRoleKey(nom: string): string {
  return String(nom ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '');
}

function projectRoleBadgeClass(roleProjet: string): string {
  const key = normalizeRoleKey(roleProjet);
  if (key.includes('CHEF') || key.includes('PROJET') || key === 'PM' || key.includes('LEAD')) {
    return 'project-detail-role-badge project-detail-role-badge--chef';
  }
  if (key.includes('DEV') || key.includes('DEVELOP')) {
    return 'project-detail-role-badge project-detail-role-badge--dev';
  }
  if (key.includes('DESIGN')) return 'project-detail-role-badge project-detail-role-badge--designer';
  if (key.includes('ANALYST')) return 'project-detail-role-badge project-detail-role-badge--analyste';
  return 'project-detail-role-badge project-detail-role-badge--default';
}

function projectEntrepriseName(project: Projet): string {
  const p = project as Projet & {
    company?: string | { nom?: string | null; name?: string | null };
    organisation?: { nom?: string | null; name?: string | null };
    organization?: { nom?: string | null; name?: string | null };
    workspace?: { nom?: string | null; name?: string | null };
  };

  const fromObject = (o: { nom?: string | null; name?: string | null } | undefined) =>
    o?.nom?.trim() || o?.name?.trim() || '';

  const entNom = fromObject(p.entreprise);
  if (entNom) return entNom;

  if (typeof p.company === 'string' && p.company.trim()) return p.company.trim();
  const companyNom = fromObject(
    typeof p.company === 'object' ? p.company : undefined,
  );
  if (companyNom) return companyNom;

  for (const key of ['organisation', 'organization', 'workspace'] as const) {
    const label = fromObject(p[key]);
    if (label) return label;
  }

  return '';
}

function displayGlobalAccountRole(member: User): string {
  const raw = typeof member.role === 'object' ? member.role?.nom : member.role;
  if (!raw) return 'Membre';
  const n = raw.trim();
  if (/superadmin/i.test(n)) return 'Super Admin';
  if (/^admin$/i.test(n) || n === 'ADMIN') return 'Admin';
  if (/^membre$|^member$/i.test(n)) return 'Membre';
  if (/chef|développeur|developpeur|developer|tester|testeur|designer|analyste|\bpm\b|lead|responsable/i.test(n)) return 'Membre';
  return n;
}

function resolveChefAvatarUser(project: Projet, teamMembers: User[]): UserAvatarUser | null {
  const chefId = project.chef_id ?? project.chef_de_projet_id ?? null;
  if (chefId != null) {
    const member = teamMembers.find((m) => Number(m.id_utilisateur) === Number(chefId));
    if (member) {
      return {
        prenom: member.prenom,
        nom: member.nom,
        email: member.email,
        photoUrl: member.photoUrl,
      };
    }
  }
  const photoUrl = project.responsablePhotoUrl;
  const name = String(project.responsable ?? '').trim();
  if (!photoUrl && (!name || name === 'Non assigné')) return null;
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    prenom: parts[0],
    nom: parts.slice(1).join(' ') || undefined,
    photoUrl: photoUrl ?? undefined,
  };
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = usePermission();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setHeader: setAdminPageHeader } = useAdminPageHeader();
  const [project, setProject] = useState<Projet | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [editingResponsable, setEditingResponsable] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState(false);
  const [editNom, setEditNom] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDateDebut, setEditDateDebut] = useState('');
  const [editDateFin, setEditDateFin] = useState('');
  const [editDateError, setEditDateError] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<
    NonNullable<Projet['projectTeam']>[number] | null
  >(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeMemberError, setRemoveMemberError] = useState<string | null>(null);
  const [taskStats, setTaskStats] = useState<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    lateTasks: number;
    todoTasks: number;
    avancement: number;
  } | null>(null);

  const pp = useMemo(
    () => project?.currentUserPermissions ?? [],
    [project?.currentUserPermissions],
  );
  const projectCtx = useMemo(
    () => (project ? normalizeProjectManageContext(project) : null),
    [project],
  );

  const canManageProjectActions =
    project != null && canManageProject(user, project);
  const canManageMembers =
    canManageProjectActions ||
    (project != null &&
      (projectCan(pp, 'manage_project_members') ||
        canManageProjectTeam(user, project)));
  const canEditProjectInfo = canManageProjectActions;
  const chefDeProjetId =
    project?.chef_id ?? project?.chef_de_projet_id ?? null;

  const canRemoveTeamMember = (row: NonNullable<Projet['projectTeam']>[number]) => {
    if (!canManageMembers || !project) return false;
    if (chefDeProjetId != null && row.userId === chefDeProjetId) return false;
    return true;
  };

  const resetEditForm = () => {
    if (!project) return;
    setEditNom(project.nom_p || '');
    setEditDescription(project.description_p || '');
    setEditDateDebut(toDateInputValue(project.date_debut));
    setEditDateFin(toDateInputValue(project.date_fin));
    setEditDateError('');
  };

  useEffect(() => {
    if (!project) return;
    resetEditForm();
  }, [
    project?.id_projet,
    project?.nom_p,
    project?.description_p,
    project?.date_debut,
    project?.date_fin,
  ]);

  useEffect(() => {
    if (!project?.id_projet) return;
    if (isSuperAdmin || canManageMembers) {
      teamService.getAllMembers({ type: 'all' }).then(setTeamMembers).catch(console.error);
    } else {
      setTeamMembers([]);
    }
  }, [project?.id_projet, isSuperAdmin, canManageMembers]);

  const handleAssignResponsable = async (projectId: number, userId: number) => {
    if (!canEditProjectInfo || !projectCtx) return;
    try {
      await projectService.assignChef(projectId, userId, { project: projectCtx });
      setEditingResponsable(false);
      fetchProject(projectId);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTaskStats = async (projectId: number) => {
    try {
      const stats = await projectService.getStats(projectId);
      setTaskStats({
        totalTasks: stats.totalTasks ?? stats.tachesCount ?? 0,
        completedTasks: stats.completedTasks ?? 0,
        inProgressTasks: stats.inProgressTasks ?? 0,
        lateTasks: stats.lateTasks ?? 0,
        todoTasks: stats.todoTasks ?? 0,
        avancement: stats.avancement ?? stats.progressPercent ?? 0,
      });
    } catch (error) {
      console.error('Failed to fetch project task stats:', error);
    }
  };

  const fetchProject = async (projectId: number, options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setForbidden(false);
      const data = await projectService.getById(projectId);
      setProject(data);
      void fetchTaskStats(projectId);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setForbidden(true);
        setProject(null);
        setTaskStats(null);
      } else {
        console.error('Failed to fetch project:', error);
        if (!options?.silent) setProject(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      const pid = parseInt(id, 10);
      if (Number.isFinite(pid) && pid > 0) {
        void fetchProject(pid);
      }
    }
  }, [id]);

  useEffect(() => {
    if (loading || forbidden || !project) {
      setAdminPageHeader(null);
      return;
    }
    setAdminPageHeader({
      title: project.nom_p,
      subtitle: project.description_p?.trim() || 'Aucune description fournie.',
    });
    return () => setAdminPageHeader(null);
  }, [loading, forbidden, project, setAdminPageHeader]);

  useEffect(() => {
    if (!id) return;
    const pid = parseInt(id, 10);
    if (!Number.isFinite(pid) || pid <= 0) return;
    const refreshStats = (e?: Event) => {
      const detail = (e as CustomEvent<{ projectId?: number }> | undefined)?.detail;
      if (detail?.projectId != null && detail.projectId !== pid) return;
      void fetchTaskStats(pid);
    };
    const refreshAll = () => {
      void fetchProject(pid, { silent: true });
    };
    window.addEventListener(PROJECT_TASK_STATS_CHANGED_EVENT, refreshStats);
    window.addEventListener(PROJECTS_UPDATED_EVENT, refreshStats);
    window.addEventListener(WORKSPACE_REFRESH_EVENT, refreshAll);
    return () => {
      window.removeEventListener(PROJECT_TASK_STATS_CHANGED_EVENT, refreshStats);
      window.removeEventListener(PROJECTS_UPDATED_EVENT, refreshStats);
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, refreshAll);
    };
  }, [id]);

  const handleSaveProjectInfo = async () => {
    if (!project?.id_projet || !canEditProjectInfo || !projectCtx) return;
    const dateErr = validateProjectDates(editDateDebut, editDateFin);
    if (dateErr) {
      setEditDateError(dateErr);
      return;
    }
    setEditDateError('');
    setSavingInfo(true);
    try {
      const date_debut = new Date(`${editDateDebut}T00:00:00`).toISOString();
      const date_fin = new Date(`${editDateFin}T00:00:00`).toISOString();
      await projectService.update(
        project.id_projet,
        {
          nom_p: editNom.trim(),
          description_p: editDescription,
          date_debut,
          date_fin,
        },
        { project: projectCtx }
      );
      setEditingProjectInfo(false);
      await fetchProject(project.id_projet);
      window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
    } catch (e) {
      console.error(e);
    } finally {
      setSavingInfo(false);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!project?.id_projet || !memberToRemove || !projectCtx) return;
    setRemovingMember(true);
    setRemoveMemberError(null);
    try {
      const result = await projectService.removeTeamMember(
        project.id_projet,
        memberToRemove.userId,
        { project: projectCtx, user },
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              projectTeam: result.projectTeam,
              membre_projet: result.projectTeam.map((m) => ({
                id_utilisateur: m.userId,
                role_projet: m.roleProjet,
              })),
              _count: {
                ...prev._count,
                tache: prev._count?.tache ?? 0,
                membres: result.memberCount,
              },
            }
          : prev,
      );
      dispatchProjectTeamChanged({ projectId: project.id_projet });
      window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
      setMemberToRemove(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        "Impossible de retirer ce membre du projet.";
      setRemoveMemberError(msg);
    } finally {
      setRemovingMember(false);
    }
  };

  const eligibleMembers = teamMembers.filter(m => {
    const roleName = typeof m.role === 'string' ? m.role : m.role?.nom;
    if (roleName && /superadmin/i.test(roleName)) return false;
    if (!memberSearch) return true;
    const fullName = `${m.prenom} ${m.nom}`.toLowerCase();
    return fullName.includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase());
  });

  const chefAvatarUser = project ? resolveChefAvatarUser(project, teamMembers) : null;

  const taskCount =
    taskStats?.totalTasks ??
    project?.totalTasks ??
    project?.tachesCount ??
    project?._count?.tache ??
    0;
  const memberCount =
    project?.projectTeam?.length ?? project?.membre_projet?.length ?? 0;
  const progressPercent =
    taskStats?.avancement ??
    project?.avancement ??
    project?.progressPercent ??
    0;

  if (loading) {
    return (
      <div className="project-detail-page project-detail-page--loading">
        <div className="project-detail-loading" role="status">
          Chargement…
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="project-detail-page project-detail-page--error">
        <h2>Accès refusé</h2>
        <p>Vous n&apos;êtes pas assigné à ce projet.</p>
        <button type="button" className="project-detail-soft-btn" onClick={() => navigate('/projects')}>
          Retour aux projets
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail-page project-detail-page--error">
        <p>Projet non trouvé.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="project-detail-page"
    >
      {(canManageMembers || canEditProjectInfo || project.currentUserProjectRole) && (
        <div className="project-detail-toolbar">
          {(canManageMembers || canEditProjectInfo) && (
            <div className="project-detail-actions-row">
              {canManageMembers && (
                <button
                  type="button"
                  className="project-detail-soft-btn"
                  onClick={() => setTeamModalOpen(true)}
                >
                  <Users size={16} aria-hidden />
                  Gérer l&apos;équipe
                </button>
              )}
              {canEditProjectInfo && !editingProjectInfo && (
                <button
                  type="button"
                  className="project-detail-soft-btn"
                  onClick={() => setEditingProjectInfo(true)}
                >
                  <Pencil size={16} aria-hidden />
                  Modifier le projet
                </button>
              )}
            </div>
          )}
          {project.currentUserProjectRole ? (
            <p className="project-detail-user-role">
              Votre rôle : <strong>{project.currentUserProjectRole}</strong>
            </p>
          ) : null}
        </div>
      )}

      <div className="project-detail-panel">
      <div className="project-detail-stats-row" aria-label="Statistiques du projet">
        <div className="project-detail-stat-card">
          <span className="project-detail-stat-icon project-detail-stat-icon--tasks" aria-hidden>
            <CheckSquare size={18} />
          </span>
          <div className="project-detail-stat-body">
            <span className="project-detail-stat-label">Tâches</span>
            <span className="project-detail-stat-value">{taskCount}</span>
          </div>
        </div>
        <div className="project-detail-stat-card">
          <span className="project-detail-stat-icon project-detail-stat-icon--members" aria-hidden>
            <Users size={18} />
          </span>
          <div className="project-detail-stat-body">
            <span className="project-detail-stat-label">Membres</span>
            <span className="project-detail-stat-value">{memberCount}</span>
          </div>
        </div>
        <div className="project-detail-stat-card">
          <span className="project-detail-stat-icon project-detail-stat-icon--progress" aria-hidden>
            <TrendingUp size={18} />
          </span>
          <div className="project-detail-stat-body">
            <span className="project-detail-stat-label">Avancement</span>
            <span className="project-detail-stat-value">{progressPercent}%</span>
          </div>
        </div>
      </div>

      <div className="project-detail-panel-body">
          <section className="project-detail-section project-detail-section--info">
            <h2 className="project-detail-section-title">Informations générales</h2>
            {canEditProjectInfo && editingProjectInfo && (
              <form
                className="project-detail-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSaveProjectInfo();
                }}
              >
                <label htmlFor="edit-project-nom">Nom</label>
                <input
                  id="edit-project-nom"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  required
                />
                <label htmlFor="edit-project-description">Description</label>
                <textarea
                  id="edit-project-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
                <div className="project-detail-edit-dates">
                  <div className="project-detail-edit-field">
                    <label htmlFor="edit-project-date-debut">Date de début</label>
                    <input
                      id="edit-project-date-debut"
                      type="date"
                      value={editDateDebut}
                      onChange={(e) => {
                        setEditDateDebut(e.target.value);
                        setEditDateError('');
                      }}
                      required
                    />
                  </div>
                  <div className="project-detail-edit-field">
                    <label htmlFor="edit-project-date-fin">Date de fin</label>
                    <input
                      id="edit-project-date-fin"
                      type="date"
                      value={editDateFin}
                      min={editDateDebut || undefined}
                      onChange={(e) => {
                        setEditDateFin(e.target.value);
                        setEditDateError('');
                      }}
                      required
                    />
                  </div>
                </div>
                {editDateError && (
                  <p className="project-detail-edit-error" role="alert">
                    {editDateError}
                  </p>
                )}
                <div className="project-detail-edit-actions">
                  <button type="submit" className="project-detail-soft-btn project-detail-soft-btn--primary" disabled={savingInfo}>
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    className="project-detail-soft-btn"
                    disabled={savingInfo}
                    onClick={() => {
                      setEditingProjectInfo(false);
                      resetEditForm();
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
            <div className="project-detail-info-grid">
              <div className="project-detail-info-item">
                <span className="project-detail-info-label">Entreprise</span>
                <div className="project-detail-info-value">
                  <Building2 size={16} className="project-detail-info-icon" aria-hidden />
                  <span>{projectEntrepriseName(project) || '—'}</span>
                </div>
              </div>
              <div className="project-detail-info-item">
                <span className="project-detail-info-label">Dates</span>
                <div className="project-detail-info-value">
                  <Calendar size={16} className="project-detail-info-icon" aria-hidden />
                  <span>
                    {formatProjectDate(project.date_debut)} → {formatProjectDate(project.date_fin)}
                  </span>
                </div>
              </div>
              <div className="project-detail-info-item project-detail-info-item--responsable">
                <span className="project-detail-info-label">Responsable</span>
                <div className="project-detail-responsable-inline">
                  <div className="project-detail-responsable-avatar">
                    <UserAvatar
                      user={chefAvatarUser}
                      className="project-detail-responsable-avatar-inner"
                      imgClassName="project-detail-responsable-avatar-img"
                    />
                  </div>
                  {canManageMembers || isSuperAdmin ? (
                    <div className="project-detail-responsable-picker">
                      <button
                        type="button"
                        className="project-detail-responsable-trigger"
                        onClick={() => setEditingResponsable(!editingResponsable)}
                        aria-expanded={editingResponsable}
                      >
                        <span>
                          {project.responsable && project.responsable !== 'Non assigné'
                            ? project.responsable
                            : 'Choisir responsable'}
                        </span>
                        <span className="project-detail-responsable-chevron" aria-hidden>
                          ▼
                        </span>
                      </button>

                      {editingResponsable && (
                        <div className="project-detail-responsable-dropdown">
                          <div className="project-detail-responsable-search">
                            <Search size={14} aria-hidden />
                            <input
                              type="text"
                              placeholder="Chercher un membre…"
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              autoFocus
                            />
                          </div>

                          <div className="project-detail-responsable-dropdown-label">
                            Responsables éligibles
                          </div>

                          <ul className="project-detail-responsable-list">
                            {eligibleMembers.length === 0 ? (
                              <li className="project-detail-responsable-empty">Aucun membre trouvé</li>
                            ) : (
                              eligibleMembers.map((m) => (
                                <li key={m.id_utilisateur}>
                                  <button
                                    type="button"
                                    className={`project-detail-responsable-option${
                                      project.chef_id === m.id_utilisateur ? ' is-selected' : ''
                                    }`}
                                    onClick={() => {
                                      handleAssignResponsable(project.id_projet, Number(m.id_utilisateur));
                                      setEditingResponsable(false);
                                      setMemberSearch('');
                                    }}
                                  >
                                    <span
                                      className={`project-detail-responsable-option-avatar${
                                        project.chef_id === m.id_utilisateur ? ' is-active' : ''
                                      }`}
                                    >
                                      <UserAvatar
                                        user={m}
                                        className="project-detail-responsable-avatar-inner"
                                        imgClassName="project-detail-responsable-avatar-img"
                                      />
                                    </span>
                                    <span className="project-detail-responsable-option-meta">
                                      <span className="project-detail-responsable-option-name">
                                        {m.prenom} {m.nom}
                                      </span>
                                      <span className="project-detail-responsable-option-role">
                                        {displayGlobalAccountRole(m)}
                                      </span>
                                    </span>
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="project-detail-responsable-name">
                      {project.responsable || 'Non assigné'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {project.projectTeam && project.projectTeam.length > 0 && (
            <section className="project-detail-section project-detail-section--team">
              <h2 className="project-detail-section-title">Équipe du projet</h2>
              <div className="project-detail-table-wrap">
                <table className="project-detail-team-table">
                  <thead>
                    <tr>
                      <th>Membre</th>
                      <th>Email</th>
                      <th>Rôle</th>
                      {canManageMembers && <th className="project-detail-team-actions-th">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {project.projectTeam.map((row) => {
                      const memberLabel =
                        `${row.prenom || ''} ${row.nom || ''}`.trim() || row.email;
                      const isProjectChef =
                        chefDeProjetId != null && row.userId === chefDeProjetId;
                      const isLastChef =
                        isChefDeProjetMemberRole(row.roleProjet) &&
                        project.projectTeam!.filter(
                          (m) =>
                            m.userId !== row.userId &&
                            isChefDeProjetMemberRole(m.roleProjet),
                        ).length === 0;
                      const removeBlocked = isProjectChef || isLastChef;
                      return (
                      <tr key={`${row.userId}-${row.email}`}>
                        <td className="project-detail-team-name">
                          <span className="project-detail-team-name-cell">
                            <span className="project-detail-team-avatar">
                              <UserAvatar
                                user={{
                                  prenom: row.prenom,
                                  nom: row.nom,
                                  email: row.email,
                                  photoUrl: row.photoUrl,
                                }}
                                className="project-detail-team-avatar-inner"
                                imgClassName="project-detail-team-avatar-img"
                              />
                            </span>
                            <span>{memberLabel}</span>
                          </span>
                          {isProjectChef && (
                            <span className="project-detail-team-responsable-tag">
                              Responsable
                            </span>
                          )}
                        </td>
                        <td className="project-detail-team-email">{row.email}</td>
                        <td>
                          <span className={projectRoleBadgeClass(row.roleProjet)}>
                            {row.roleProjet}
                          </span>
                        </td>
                        {canManageMembers && (
                          <td className="project-detail-team-actions">
                            {canRemoveTeamMember(row) ? (
                              <button
                                type="button"
                                className="project-detail-team-remove-btn"
                                aria-label={`Retirer ${memberLabel} du projet`}
                                title={
                                  removeBlocked
                                    ? 'Assignez un autre Chef de projet avant de retirer ce membre'
                                    : 'Retirer du projet'
                                }
                                disabled={removeBlocked}
                                onClick={() => {
                                  setRemoveMemberError(null);
                                  setMemberToRemove(row);
                                }}
                              >
                                <Trash2 size={16} aria-hidden />
                              </button>
                            ) : (
                              <span className="project-detail-team-actions-muted">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
      </div>
      </div>

      <EditProjectTeamModal
        isOpen={teamModalOpen}
        projectId={project.id_projet}
        projectNom={project.nom_p}
        chefId={project.chef_id ?? project.chef_de_projet_id ?? null}
        team={project.projectTeam}
        project={project}
        onClose={() => setTeamModalOpen(false)}
        onSuccess={() => void fetchProject(project.id_projet)}
      />

      <DeleteConfirmModal
        open={memberToRemove != null}
        itemName={
          memberToRemove
            ? `${memberToRemove.prenom || ''} ${memberToRemove.nom || ''}`.trim() ||
              memberToRemove.email
            : ''
        }
        title="Retirer du projet"
        descriptionLine="Voulez-vous retirer ce membre du projet ?"
        showIrreversibleNote={false}
        confirmLabel="Retirer"
        loading={removingMember}
        errorMessage={removeMemberError}
        onCancel={() => {
          if (!removingMember) {
            setMemberToRemove(null);
            setRemoveMemberError(null);
          }
        }}
        onConfirm={() => void handleConfirmRemoveMember()}
      />
    </motion.div>
  );
};

export default ProjectDetail;
