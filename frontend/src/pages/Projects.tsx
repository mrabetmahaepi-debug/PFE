import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Users,
  CheckCircle2,
  Check,
  Briefcase,
  ShieldAlert,
  Building2,
  AlertTriangle,
  X,
  Calendar,
  Flag,
  Trash2,
  Pencil,
  Archive,
  ChevronDown,
  ArrowUpDown,
  ArrowRight,
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { usePermission } from '../hooks/usePermission';
import { getRoleKey, isEnterpriseAdmin } from '../lib/permissions';
import {
  canManageProject,
  normalizeProjectManageContext,
  type ProjectManageContext,
} from '../lib/projectManageAccess';
import { ProjectStatus } from '../types/project';
import {
  STATUS_FILTER_OPTIONS,
  formatProjectStatus,
  getProjectStatusColor,
  normalizeProjectStatus,
  isArchivedProject,
  projectMatchesStatusFilter,
} from '../lib/projectStatus';
import { dispatchProjectsUpdated } from '../lib/workspaceEvents';
import type { User } from '../types/auth.types';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal';
import ProjectProgress from '../components/ProjectProgress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { teamService } from '../services/team.service';
import { useAuth } from '../hooks/useAuth';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import './Projects.css';

const LOW_PROGRESS_THRESHOLD = 35;

function safeLower(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

function formatProjectShortDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatMemberCount(count: number): string {
  const n = count || 0;
  return n <= 1 ? `${n} membre` : `${n} membres`;
}

function formatTaskCount(count: number): string {
  const n = count || 0;
  return n <= 1 ? `${n} tâche` : `${n} tâches`;
}

function getProjectDateValue(project: {
  createdAt?: string | null;
  date_debut?: string | null;
  id_projet?: number;
}): number {
  const raw = project.createdAt || project.date_debut;
  if (raw) {
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return typeof project.id_projet === 'number' ? project.id_projet : 0;
}

type ToolbarMenuId = 'status' | 'sort' | 'enterprise';

type ToolbarSelectOption = { value: string; label: string };

function ToolbarSelect({
  menuId,
  value,
  options,
  onChange,
  openMenu,
  setOpenMenu,
  icon: Icon,
  ariaLabel,
  showActiveState = false,
}: {
  menuId: ToolbarMenuId;
  value: string;
  options: ToolbarSelectOption[];
  onChange: (value: string) => void;
  openMenu: ToolbarMenuId | null;
  setOpenMenu: (id: ToolbarMenuId | null) => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  ariaLabel: string;
  showActiveState?: boolean;
}) {
  const isOpen = openMenu === menuId;
  const selected = options.find((o) => o.value === value);
  const isFilterActive = showActiveState && value !== 'ALL';

  return (
    <motion.div
      className={`filter-group projects-toolbar-select${isOpen ? ' is-open' : ''}${isFilterActive ? ' is-filter-active' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {Icon ? <Icon size={16} className="projects-toolbar-select-icon" aria-hidden /> : null}
      <button
        type="button"
        className={`projects-toolbar-select-trigger${isFilterActive ? ' is-filter-active' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpenMenu(isOpen ? null : menuId)}
      >
        <span>{selected?.label ?? '—'}</span>
        <ChevronDown size={14} className="projects-toolbar-select-chevron" aria-hidden />
      </button>
      {isOpen ? (
        <div className="projects-toolbar-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`projects-toolbar-select-option${opt.value === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpenMenu(null);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

const SORT_OPTIONS: ToolbarSelectOption[] = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'oldest', label: 'Plus anciens' },
  { value: 'name_asc', label: 'Nom A-Z' },
  { value: 'name_desc', label: 'Nom Z-A' },
  { value: 'prog_high', label: 'Progression ↑' },
  { value: 'prog_low', label: 'Progression ↓' },
];

const Projects: React.FC = () => {
  const { t } = useTranslation();
  const { can, isSuperAdmin } = usePermission();
  const { user } = useAuth();
  const roleKey = getRoleKey(user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const riskFilter = searchParams.get('risk');
  const isLowProgress = riskFilter === 'low-progress';

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [enterpriseFilter, setEnterpriseFilter] = useState<string>('ALL');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [cardMenuAnchor, setCardMenuAnchor] = useState<{
    projectId: number;
    top: number;
    right: number;
  } | null>(null);
  const [dropdownOpenId, setDropdownOpenId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [sortOption, setSortOption] = useState<string>(
    isLowProgress ? 'prog_low' : 'newest'
  );
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState<ToolbarMenuId | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<{
    id_projet: number;
    nom_p?: string;
    project: ProjectManageContext;
  } | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [archivingProjectId, setArchivingProjectId] = useState<number | null>(null);
  const isTenantAdmin = isEnterpriseAdmin(user);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    setIsModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  /** Filtre statut depuis la carte « KPI » admin (ex. ?status=DELAYED). */
  useEffect(() => {
    const raw = searchParams.get('status');
    if (!raw) return;
    const norm = normalizeProjectStatus(raw);
    if (!norm) return;
    setFilter(norm);
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearRiskFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('risk');
    setSearchParams(next);
  };

  useEffect(() => {
    fetchProjects();
    if (can('PROJECT_EDIT') || isSuperAdmin || isEnterpriseAdmin(user)) {
      teamService.getAllMembers({ type: 'all' }).then(setTeamMembers).catch(console.error);
    }

    const handleClickOutside = () => {
      setCardMenuAnchor(null);
      setDropdownOpenId(null);
      setToolbarMenuOpen(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleProjectsUpdated = () => {
      void fetchProjects();
    };
    window.addEventListener('projects:updated', handleProjectsUpdated);
    return () => window.removeEventListener('projects:updated', handleProjectsUpdated);
  }, []);

  useEffect(() => {
    if (!cardMenuAnchor) return;
    const close = () => setCardMenuAnchor(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [cardMenuAnchor]);

  useEffect(() => {
    if (!saveSuccessMessage) return;
    const t = window.setTimeout(() => setSaveSuccessMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [saveSuccessMessage]);

  const eligibleMembers = teamMembers.filter(m => {
    const roleName = typeof m.role === 'string' ? m.role : m.role?.nom;
    if (!roleName) return false;
    const r = roleName.toLowerCase();
    
    // Exclure strictement les Admins et SuperAdmins
    if (r.includes('admin')) return false;
    
    // Autoriser Chef de projet, Team Lead ou permissions explicites
    const isLead = r.includes('chef') || r.includes('lead') || r.includes('responsable');
    const hasPerms = m.permissions?.some(p => p.includes('PROJECT_EDIT') || p.includes('PROJECT_MANAGE'));
    
    return isLead || hasPerms;
  }).filter(m => {
    if (!memberSearch) return true;
    const fullName = `${m.prenom ?? ''} ${m.nom ?? ''}`.toLowerCase();
    const emailLower = safeLower(m.email);
    return (
      fullName.includes(memberSearch.toLowerCase()) ||
      emailLower.includes(memberSearch.toLowerCase())
    );
  });

  const handleAssignResponsable = async (
    project: ProjectManageContext & { id_projet: number },
    userId: number
  ) => {
    if (!canManageProject(user, project)) return;
    try {
      await projectService.assignChef(project.id_projet, userId, {
        project: toProjectCtx(project),
      });
      fetchProjects();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async () => {
    setFetchError(null);
    try {
      const data = await projectService.getAll();
      const list = Array.isArray(data) ? data : [];
      setProjects(list);
    } catch (error: unknown) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFetchError(
        typeof msg === 'string'
          ? msg
          : 'Impossible de charger les projets. Vérifiez que le serveur est démarré et reconnectez-vous si besoin.'
      );
    } finally {
      setLoading(false);
    }
  };

  const hasActiveListFilters =
    filter !== 'ALL' ||
    searchQuery.trim() !== '' ||
    enterpriseFilter !== 'ALL' ||
    isLowProgress;

  const filteredProjects = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();
    return projects
      .filter((p) => !isArchivedProject(p))
      .filter((p) => {
        const matchesSearch =
          !searchLower ||
          safeLower(p.nom_p).includes(searchLower) ||
          safeLower(p.responsable).includes(searchLower) ||
          safeLower(p.entreprise?.nom).includes(searchLower) ||
          formatProjectStatus(p.statut_p ?? p.status).toLowerCase().includes(searchLower);
        const matchesFilter = projectMatchesStatusFilter(p, filter);
        const matchesEnterprise =
          enterpriseFilter === 'ALL' || p.id_entreprise?.toString() === enterpriseFilter;
        const matchesRisk =
          !isLowProgress ||
          ((p.tachesCount ?? 0) > 0 && (p.avancement ?? 0) < LOW_PROGRESS_THRESHOLD);
        return matchesSearch && matchesFilter && matchesEnterprise && matchesRisk;
      })
      .sort((a, b) => {
        if (sortOption === 'newest') return getProjectDateValue(b) - getProjectDateValue(a);
        if (sortOption === 'oldest') return getProjectDateValue(a) - getProjectDateValue(b);
        if (sortOption === 'name_asc') {
          return safeLower(a.nom_p).localeCompare(safeLower(b.nom_p), 'fr', { sensitivity: 'base' });
        }
        if (sortOption === 'name_desc') {
          return safeLower(b.nom_p).localeCompare(safeLower(a.nom_p), 'fr', { sensitivity: 'base' });
        }
        if (sortOption === 'prog_high') return (b.avancement || 0) - (a.avancement || 0);
        if (sortOption === 'prog_low') return (a.avancement || 0) - (b.avancement || 0);
        return getProjectDateValue(b) - getProjectDateValue(a);
      });
  }, [projects, searchQuery, filter, enterpriseFilter, isLowProgress, sortOption]);

  const cardMenuProject = useMemo(
    () => filteredProjects.find((p) => p.id_projet === cardMenuAnchor?.projectId),
    [filteredProjects, cardMenuAnchor?.projectId],
  );

  const CARD_MENU_WIDTH = 220;
  const CARD_MENU_EST_HEIGHT = 188;

  const toggleCardMenu = (e: React.MouseEvent<HTMLButtonElement>, projectId: number) => {
    e.stopPropagation();
    if (cardMenuAnchor?.projectId === projectId) {
      setCardMenuAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + CARD_MENU_EST_HEIGHT > window.innerHeight - 12) {
      top = Math.max(12, rect.top - CARD_MENU_EST_HEIGHT - 8);
    }
    let right = window.innerWidth - rect.right;
    const maxRight = window.innerWidth - CARD_MENU_WIDTH - 8;
    right = Math.max(8, Math.min(right, maxRight));
    setCardMenuAnchor({ projectId, top, right });
  };

  const closeCardMenu = () => setCardMenuAnchor(null);

  const uniqueEnterprises = Array.from(new Set(projects.filter(p => p.entreprise).map(p => p.entreprise.id_entreprise)))
    .map(id => projects.find(p => p.entreprise?.id_entreprise === id)?.entreprise);

  const toProjectCtx = (p: ProjectManageContext & { id_projet?: number }) =>
    normalizeProjectManageContext(p);

  const handleArchiveProject = async (
    project: ProjectManageContext & { id_projet: number; nom_p?: string }
  ) => {
    if (!isTenantAdmin) return;
    setCardMenuAnchor(null);
    setArchivingProjectId(project.id_projet);
    try {
      await projectService.archive(project.id_projet);
      setSaveSuccessMessage(
        `« ${project.nom_p || 'Projet'} » a été archivé et retiré de la liste active.`
      );
      await fetchProjects();
      dispatchProjectsUpdated();
    } catch (err) {
      console.error(err);
      setFetchError('Impossible d\'archiver ce projet.');
    } finally {
      setArchivingProjectId(null);
    }
  };

  const handleDeleteProject = (
    e: React.MouseEvent,
    project: ProjectManageContext & { id_projet: number; nom_p?: string }
  ) => {
    e.stopPropagation();
    if (!isTenantAdmin) return;
    setCardMenuAnchor(null);
    setPendingDeleteProject({
      id_projet: project.id_projet,
      nom_p: project.nom_p,
      project: toProjectCtx(project),
    });
  };

  const executeDeleteProject = async () => {
    if (!pendingDeleteProject) return;
    setDeletingProject(true);
    try {
      await projectService.delete(pendingDeleteProject.id_projet, {
        project: pendingDeleteProject.project,
      });
      setPendingDeleteProject(null);
      await fetchProjects();
      dispatchProjectsUpdated();
    } catch (err) {
      console.error(err);
      setFetchError(t('projects.deleteError'));
    } finally {
      setDeletingProject(false);
    }
  };

  return (
    <div className="projects-page projects-page--admin">
      <header className="projects-admin-header">
        <div className="projects-admin-header-main">
          <div className="projects-admin-title-row">
            <h1 className="projects-admin-title">Projets</h1>
            {!loading && (
              <span className="projects-admin-count-badge">
                {filteredProjects.length} projet{filteredProjects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="projects-admin-subtitle">
            Gérez les projets de votre entreprise et suivez leur avancement.
          </p>
        </div>
        {(can('PROJECT_CREATE') || isEnterpriseAdmin(user)) && (
          <button
            type="button"
            className="projects-admin-create-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} aria-hidden />
            <span>Créer un projet</span>
          </button>
        )}
      </header>

      {isSuperAdmin && (
        <div className="superadmin-banner">
          <ShieldAlert size={20} />
          <span>{t('projects.supervisionBanner')}</span>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="filter-banner tone-success" role="status">
          <Check size={18} className="filter-banner-icon" aria-hidden />
          <p className="filter-banner-text">{saveSuccessMessage}</p>
        </div>
      )}

      {fetchError && (
        <div className="filter-banner tone-danger" role="alert">
          <span className="filter-banner-text">{fetchError}</span>
          <button type="button" className="filter-banner-reset" onClick={() => {
            setLoading(true);
            void fetchProjects();
          }}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {isLowProgress && (
        <div className="filter-banner tone-warning">
          <span className="filter-banner-icon">
            <AlertTriangle size={16} />
          </span>
          <div className="filter-banner-text">
            <strong>{t('projects.lowProgressTitle')}</strong>
            <span>
              {t('projects.lowProgressHint', {
                count: filteredProjects.length,
                threshold: LOW_PROGRESS_THRESHOLD,
              })}
            </span>
          </div>
          <button
            type="button"
            className="filter-banner-reset"
            onClick={clearRiskFilter}
            aria-label={t('projects.resetFilterAria')}
          >
            <X size={14} />
            {t('projects.resetFilter')}
          </button>
        </div>
      )}

      <div className="projects-toolbar projects-toolbar--admin">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un projet…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isSuperAdmin && (
            <ToolbarSelect
              menuId="enterprise"
              value={enterpriseFilter}
              options={[
                { value: 'ALL', label: 'Toutes Entreprises' },
                ...uniqueEnterprises
                  .filter((e): e is NonNullable<typeof e> => Boolean(e))
                  .map((e) => ({
                    value: String(e.id_entreprise),
                    label: e.nom || `Entreprise #${e.id_entreprise}`,
                  })),
              ]}
              onChange={setEnterpriseFilter}
              openMenu={toolbarMenuOpen}
              setOpenMenu={setToolbarMenuOpen}
              icon={Building2}
              ariaLabel="Filtrer par entreprise"
            />
          )}

          <ToolbarSelect
            menuId="status"
            value={filter}
            options={STATUS_FILTER_OPTIONS}
            onChange={(v) => setFilter(v as ProjectStatus | 'ALL')}
            openMenu={toolbarMenuOpen}
            setOpenMenu={setToolbarMenuOpen}
            icon={Filter}
            ariaLabel="Filtrer par statut"
            showActiveState
          />

          <ToolbarSelect
            menuId="sort"
            value={sortOption}
            options={SORT_OPTIONS}
            onChange={setSortOption}
            openMenu={toolbarMenuOpen}
            setOpenMenu={setToolbarMenuOpen}
            icon={ArrowUpDown}
            ariaLabel="Trier les projets"
          />
      </div>

      {loading ? (
        <div
          className="projects-skeleton-grid"
          aria-busy="true"
          aria-label="Chargement des projets en cours"
        >
          {Array.from({ length: 6 }).map((_, sk) => (
            <div key={sk} className="project-skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="projects-grid">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id_projet}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                className="project-super-card project-card-cu project-card-cu--admin"
                onClick={() => navigate(`/projects/${project.id_projet}`)}
              >
                <div className="project-card-header">
                  <div className="project-card-head-main">
                    <div className="project-card-title-row">
                      <span
                        className="project-status-badge"
                        style={{
                          backgroundColor: `${getProjectStatusColor(project.statut_p)}18`,
                          color: getProjectStatusColor(project.statut_p),
                          borderColor: `${getProjectStatusColor(project.statut_p)}40`,
                        }}
                      >
                        {formatProjectStatus(project.statut_p ?? project.status)}
                      </span>
                    </div>
                    <h3 className="project-title">{project.nom_p}</h3>
                    <p className={`project-desc ${!project.description_p ? 'empty-desc' : ''}`}>
                      {project.description_p || 'Aucune description fournie.'}
                    </p>
                  </div>
                  {isTenantAdmin && (
                    <div className="project-card-menu-wrap">
                      <button
                        type="button"
                        className={`card-action-btn${cardMenuAnchor?.projectId === project.id_projet ? ' is-active' : ''}`}
                        aria-label="Actions du projet"
                        aria-expanded={cardMenuAnchor?.projectId === project.id_projet}
                        aria-haspopup="menu"
                        disabled={archivingProjectId === project.id_projet}
                        onClick={(e) => toggleCardMenu(e, project.id_projet)}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  )}
                </div>
                
                <hr className="project-card-divider" aria-hidden />

                <div
                  className="project-card-chips"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <div className="project-card-chips-row">
                    <div className="project-info-chip" title="Date de création">
                      <Calendar size={14} aria-hidden className="project-info-chip-icon" />
                      <span className="project-info-chip-value">
                        {formatProjectShortDate(project.createdAt || project.date_debut)}
                      </span>
                    </div>
                    <div className="project-info-chip" title="Échéance">
                      <Flag size={14} aria-hidden className="project-info-chip-icon" />
                      <span className="project-info-chip-value">
                        {formatProjectShortDate(project.date_fin)}
                      </span>
                    </div>
                  </div>
                  <div className="project-card-chips-row project-card-chips-row--stats">
                    <div className="project-info-chip" title="Membres">
                      <Users size={14} aria-hidden className="project-info-chip-icon" />
                      <span className="project-info-chip-value">
                        {formatMemberCount(project.membresCount || 0)}
                      </span>
                    </div>
                    <div className="project-info-chip project-info-chip--tasks" title="Tâches">
                      <CheckCircle2 size={14} aria-hidden className="project-info-chip-icon" />
                      <span className="project-info-chip-value">
                        {formatTaskCount(project.tachesCount || 0)}
                      </span>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className="project-info-chip project-info-chip--wide project-info-chip--link"
                      title="Entreprise"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (project.entreprise) {
                          navigate(`/enterprises/${project.entreprise.id_entreprise}`);
                        }
                      }}
                    >
                      <Building2 size={14} aria-hidden className="project-info-chip-icon" />
                      <span className="project-info-chip-value">
                        {project.entreprise?.nom || 'Plateforme'}
                      </span>
                    </button>
                  )}
                </div>

                <hr className="project-card-divider" aria-hidden />

                <div className="project-card-progress">
                  <ProjectProgress
                    projectId={project.id_projet}
                    statusColor={getProjectStatusColor(project.statut_p)}
                  />
                </div>

                <hr className="project-card-divider" aria-hidden />

                <div className="project-card-footer-cu">
                  <div className="project-card-chef" onClick={(e) => e.stopPropagation()}>
                    <div className="project-card-chef-row">
                    <div className="responsable-avatar project-card-chef-avatar">
                      {(() => {
                        const label =
                          project.responsable && project.responsable !== 'Non assigné'
                            ? String(project.responsable)
                            : '?';
                        const ch = label.charAt(0);
                        return ch ? ch.toUpperCase() : '?';
                      })()}
                    </div>
                    <div className="responsable-info" style={{ flex: 1 }}>
                      <span className="responsable-label">Chef de projet</span>
                      {canManageProject(user, project) ? (
                        <div style={{ position: 'relative' }}>
                          <div
                            className="project-chef-picker"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownOpenId(dropdownOpenId === project.id_projet ? null : project.id_projet);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setDropdownOpenId(dropdownOpenId === project.id_projet ? null : project.id_projet);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="project-chef-picker-text">
                              <span className="project-card-meta-value project-chef-picker-name">
                                {project.responsable && project.responsable !== 'Non assigné'
                                  ? project.responsable
                                  : 'Choisir un chef de projet'}
                              </span>
                              {project.responsable_role && project.responsable !== 'Non assigné' && (
                                <span className="project-chef-picker-role">
                                  {project.responsable_role}
                                </span>
                              )}
                            </div>
                            <span className="project-chef-picker-chevron" aria-hidden>
                              ▼
                            </span>
                          </div>

                          {dropdownOpenId === project.id_projet && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute', bottom: '110%', left: 0, minWidth: '260px',
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
                                    Aucun responsable éligible trouvé
                                  </div>
                                ) : (
                                  eligibleMembers.map(m => {
                                    const roleName = typeof m.role === 'string' ? m.role : m.role?.nom;
                                    return (
                                      <div 
                                        key={m.id_utilisateur}
                                        onClick={() => {
                                          handleAssignResponsable(project, Number(m.id_utilisateur));
                                          setDropdownOpenId(null);
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
                                          {String(m.prenom?.[0] || m.email?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{m.prenom} {m.nom}</span>
                                            {project.chef_id === m.id_utilisateur && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></div>}
                                          </div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                                            {roleName}
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
                        <span className="responsable-name">{project.responsable || 'Non assigné'}</span>
                      )}
                    </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="project-details-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id_projet}`);
                    }}
                  >
                    Détails
                    <ArrowRight size={14} aria-hidden />
                  </button>
                </div>
              </motion.div>
            ))}
        </div>
      )}

      {!loading && filteredProjects.length === 0 && (
        <div className="empty-super-state">
          <div className="empty-icon-box">
            <Briefcase size={48} />
          </div>
          <h3>
            {projects.length === 0 && roleKey === 'MEMBRE'
              ? 'Aucun projet assigné'
              : projects.length === 0 && !fetchError
                ? 'Aucun projet pour le moment'
                : hasActiveListFilters
                  ? 'Aucun projet trouvé'
                  : 'Aucun résultat'}
          </h3>
          <p>
            {fetchError
              ? 'Corrigez l’erreur ci-dessus ou rechargez la page.'
              : projects.length === 0 && roleKey === 'MEMBRE'
                ? 'Aucun projet ne vous a encore été assigné.'
                : projects.length === 0
                  ? isSuperAdmin
                    ? "Aucun projet n'a été créé sur la plateforme."
                    : "Créez un premier projet pour votre entreprise ou affinez les filtres."
                  : hasActiveListFilters
                    ? filter !== 'ALL'
                      ? `Aucun projet avec le statut « ${formatProjectStatus(filter)} ». Essayez « Tous Statuts » ou un autre filtre.`
                      : 'Aucun projet ne correspond à votre recherche ou à vos filtres. Réinitialisez les filtres ou la recherche.'
                    : 'Aucun projet ne correspond à votre recherche ou à vos filtres. Réinitialisez les filtres ou la recherche.'}
          </p>
          {hasActiveListFilters && projects.length > 0 && (
            <button
              type="button"
              className="secondary-btn empty-state-cta"
              onClick={() => {
                setFilter('ALL');
                setSearchQuery('');
                setEnterpriseFilter('ALL');
                clearRiskFilter();
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
          {!fetchError && projects.length === 0 && !isSuperAdmin && (can('PROJECT_CREATE') || isEnterpriseAdmin(user)) && (
            <button type="button" className="primary-btn empty-state-cta" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              Créer un projet
            </button>
          )}
        </div>
      )}

      {!isSuperAdmin && (
        <CreateProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            void fetchProjects();
            dispatchProjectsUpdated();
          }}
        />
      )}
      {isTenantAdmin && (
        <EditProjectModal
          isOpen={editProjectId != null}
          projectId={editProjectId}
          onClose={() => setEditProjectId(null)}
          onSuccess={() => {
            void fetchProjects();
            setSaveSuccessMessage('Projet modifié avec succès.');
            dispatchProjectsUpdated();
          }}
        />
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isTenantAdmin && cardMenuAnchor && cardMenuProject && (
              <>
                <motion.button
                  type="button"
                  className="project-action-menu-backdrop"
                  aria-label="Fermer le menu"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={closeCardMenu}
                />
                <motion.div
                  role="menu"
                  className="project-action-menu project-action-menu--portal"
                  style={{
                    top: cardMenuAnchor.top,
                    right: cardMenuAnchor.right,
                  }}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="project-menu-item"
                    onClick={() => {
                      closeCardMenu();
                      setEditProjectId(cardMenuProject.id_projet);
                    }}
                  >
                    <Pencil size={14} aria-hidden />
                    Modifier le projet
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="project-menu-item project-menu-item--archive"
                    disabled={archivingProjectId === cardMenuProject.id_projet}
                    onClick={() => void handleArchiveProject(cardMenuProject)}
                  >
                    <Archive size={14} aria-hidden />
                    {archivingProjectId === cardMenuProject.id_projet
                      ? 'Archivage…'
                      : 'Archiver projet'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="project-menu-item project-menu-item--danger"
                    onClick={(ev) => handleDeleteProject(ev, cardMenuProject)}
                  >
                    <Trash2 size={14} aria-hidden />
                    Supprimer projet
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <DeleteConfirmModal
        open={!!pendingDeleteProject}
        itemName={pendingDeleteProject?.nom_p ?? `Projet #${pendingDeleteProject?.id_projet ?? ''}`}
        title="Voulez-vous supprimer ce projet ?"
        descriptionLine="Le projet, ses sprints, listes et associations de tâches seront supprimés. Les comptes utilisateurs de l'entreprise ne seront pas supprimés."
        showIrreversibleNote
        loading={deletingProject}
        onCancel={() => !deletingProject && setPendingDeleteProject(null)}
        onConfirm={() => void executeDeleteProject()}
      />
    </div>
  );
};

export default Projects;
