import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Building2, Users, CheckSquare, Clock, Search, Pencil } from 'lucide-react';
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
import './ProjectDetail.css';

const PROJECTS_UPDATED_EVENT = 'projects:updated';

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

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = usePermission();
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const fetchProject = async (projectId: number) => {
    try {
      setLoading(true);
      setForbidden(false);
      const data = await projectService.getById(projectId);
      setProject(data);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setForbidden(true);
        setProject(null);
      } else {
        console.error('Failed to fetch project:', error);
        setProject(null);
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

  const eligibleMembers = teamMembers.filter(m => {
    const roleName = typeof m.role === 'string' ? m.role : m.role?.nom;
    if (roleName && /superadmin/i.test(roleName)) return false;
    if (!memberSearch) return true;
    const fullName = `${m.prenom} ${m.nom}`.toLowerCase();
    return fullName.includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase());
  });

  if (loading) return <div className="loading-screen">Chargement...</div>;
  if (forbidden) {
    return (
      <div className="error-screen" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Accès refusé</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Vous n&apos;êtes pas assigné à ce projet.
        </p>
        <button type="button" className="primary-btn" onClick={() => navigate('/projects')}>
          Retour aux projets
        </button>
      </div>
    );
  }
  if (!project) return <div className="error-screen">Projet non trouvé.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="project-detail-page"
      style={{ padding: '2rem' }}
    >
      <header className="project-detail-header">
        <motion.div className="project-detail-header-left">
          <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Retour">
            <ArrowLeft size={20} />
          </button>
          <div className="project-detail-header-titles">
            <h1 className="project-detail-title">{project.nom_p}</h1>
            {project.currentUserProjectRole && (
              <p className="subtitle project-detail-role">
                Votre rôle dans ce projet :{' '}
                <strong>{project.currentUserProjectRole}</strong>
              </p>
            )}
            <p className="project-detail-description">
              {project.description_p || 'Aucune description fournie.'}
            </p>
          </div>
        </motion.div>
      </header>

      <div className="project-overview-grid">
        <div className="main-info">
          <section className="premium-card project-detail-card project-detail-card--info">
            <h3 className="project-detail-card-title">Informations générales</h3>
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
                  <button type="submit" className="primary-btn" disabled={savingInfo}>
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
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
                    {new Date(project.date_debut || '').toLocaleDateString()} –{' '}
                    {new Date(project.date_fin || '').toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="project-detail-info-item project-detail-info-item--responsable">
                <span className="project-detail-info-label">Responsable</span>
                <div className="project-detail-info-value project-detail-info-value--responsable">
                  <div className="responsable-avatar">
                    {String(project.responsable || '?')[0].toUpperCase()}
                  </div>
                  {canManageMembers || isSuperAdmin ? (
                    <div style={{ position: 'relative' }}>
                      <div 
                        onClick={() => setEditingResponsable(!editingResponsable)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                          padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-main)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600
                        }}
                      >
                        <span>{project.responsable && project.responsable !== 'Non assigné' ? project.responsable : 'Choisir responsable'}</span>
                        <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>▼</span>
                      </div>

                      {editingResponsable && (
                        <div 
                          style={{
                            position: 'absolute', top: '110%', left: 0, minWidth: '260px',
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)', padding: '0.75rem',
                            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', zIndex: 100,
                            maxHeight: '300px', overflowY: 'auto'
                          }}
                        >
                          <div className="search-box" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.5rem', height: '32px' }}>
                            <Search size={14} />
                            <input 
                              type="text" 
                              placeholder="Chercher un membre..." 
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              style={{ fontSize: '0.8rem' }}
                              autoFocus
                            />
                          </div>

                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, padding: '0.25rem 0.5rem', letterSpacing: '0.05em' }}>
                            Responsables Éligibles
                          </div>
                          
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {eligibleMembers.length === 0 ? (
                              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Aucun membre trouvé
                              </div>
                            ) : (
                              eligibleMembers.map(m => {
                                return (
                                  <div 
                                    key={m.id_utilisateur}
                                    onClick={() => {
                                      handleAssignResponsable(project.id_projet, Number(m.id_utilisateur));
                                      setEditingResponsable(false);
                                      setMemberSearch('');
                                    }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem',
                                      cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
                                      backgroundColor: project.chef_id === m.id_utilisateur ? 'var(--primary-light)' : 'transparent'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = project.chef_id === m.id_utilisateur ? 'var(--primary-light)' : 'transparent'}
                                  >
                                    <div className="responsable-avatar" style={{
                                      width: '32px', height: '32px', fontSize: '0.85rem',
                                      background: project.chef_id === m.id_utilisateur ? 'var(--primary)' : 'var(--bg-main)',
                                      color: project.chef_id === m.id_utilisateur ? 'white' : 'var(--text-main)'
                                    }}>
                                      {String(m.prenom?.[0] || m.email[0]).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{m.prenom} {m.nom}</span>
                                        {project.chef_id === m.id_utilisateur && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></div>}
                                      </div>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                                        {displayGlobalAccountRole(m)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="responsable-name" style={{ fontWeight: 600 }}>{project.responsable || 'Non assigné'}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {project.projectTeam && project.projectTeam.length > 0 && (
            <section className="premium-card project-detail-card project-detail-card--team">
              <h3 className="project-detail-card-title">Équipe du projet</h3>
              <div className="project-detail-table-wrap">
                <table className="project-detail-team-table">
                  <thead>
                    <tr>
                      <th>Membre</th>
                      <th>Email</th>
                      <th>Rôle dans le projet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.projectTeam.map((row) => (
                      <tr key={`${row.userId}-${row.email}`}>
                        <td className="project-detail-team-name">
                          {(row.prenom || '')} {(row.nom || '')}
                        </td>
                        <td className="project-detail-team-email">{row.email}</td>
                        <td>
                          <span className="project-detail-role-badge">{row.roleProjet}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="side-info project-detail-sidebar">
          {(canManageMembers || canEditProjectInfo) && (
            <section className="premium-card project-detail-sidebar-card project-detail-actions-card">
              <h3 className="project-detail-sidebar-title">Actions</h3>
              <div className="project-detail-actions-list">
                {canManageMembers && (
                  <button
                    type="button"
                    className="primary-btn project-detail-action-btn"
                    onClick={() => setTeamModalOpen(true)}
                  >
                    <Users size={18} aria-hidden />
                    Gérer l&apos;équipe
                  </button>
                )}
                {canEditProjectInfo && !editingProjectInfo && (
                  <button
                    type="button"
                    className="primary-btn project-detail-action-btn"
                    onClick={() => setEditingProjectInfo(true)}
                  >
                    <Pencil size={18} aria-hidden />
                    Modifier le projet
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="premium-card project-detail-sidebar-card project-detail-stats-card">
            <h3 className="project-detail-sidebar-title">Statistiques du projet</h3>
            <div className="project-detail-stats-strip">
              <div className="project-detail-mini-stat project-detail-mini-stat--tasks">
                <CheckSquare size={18} className="project-detail-mini-stat-icon" aria-hidden />
                <span>{project._count?.tache || 0} Tâches</span>
              </div>
              <div className="project-detail-mini-stat project-detail-mini-stat--members">
                <Users size={18} className="project-detail-mini-stat-icon" aria-hidden />
                <span>{project.membre_projet?.length || 0} Membres</span>
              </div>
              <div className="project-detail-mini-stat project-detail-mini-stat--progress">
                <Clock size={18} className="project-detail-mini-stat-icon" aria-hidden />
                <span>{project.avancement || 0}% Avancement</span>
              </div>
            </div>
          </section>
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
    </motion.div>
  );
};

export default ProjectDetail;
