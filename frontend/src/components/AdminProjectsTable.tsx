import React from 'react';
import { ArrowRight, MoreVertical, Search } from 'lucide-react';
import { ProjectStatus } from '../types/project';
import {
  formatProjectStatus,
  getProjectStatusColor,
  normalizeProjectStatus,
} from '../lib/projectStatus';
import { canManageProject, type ProjectManageContext } from '../lib/projectManageAccess';
import type { User } from '../types/auth.types';

export type AdminProjectTableRow = ProjectManageContext & {
  id_projet: number;
  nom_p?: string;
  description_p?: string;
  date_debut?: string | null;
  date_fin?: string | null;
  createdAt?: string | null;
  statut_p?: unknown;
  status?: unknown;
  avancement?: number;
  progressPercent?: number;
  membresCount?: number;
  tachesCount?: number;
  responsable?: string;
  responsable_role?: string;
  chef_id?: number | null;
};

function formatProjectShortDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function projectProgressPercent(project: AdminProjectTableRow): number {
  const raw = project.avancement ?? project.progressPercent ?? 0;
  return Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
}

function projectStatusBadgeClass(status: unknown): string {
  const norm = normalizeProjectStatus(status);
  switch (norm) {
    case ProjectStatus.IN_PROGRESS:
      return 'projects-table-status--en-cours';
    case ProjectStatus.COMPLETED:
      return 'projects-table-status--terminee';
    case ProjectStatus.DELAYED:
      return 'projects-table-status--en-retard';
    case ProjectStatus.ON_HOLD:
      return 'projects-table-status--attente';
    default:
      return 'projects-table-status--planning';
  }
}

export interface AdminProjectsTableProps {
  projects: AdminProjectTableRow[];
  loading: boolean;
  user: User | null;
  eligibleMembers: User[];
  memberSearch: string;
  onMemberSearchChange: (value: string) => void;
  dropdownOpenId: number | null;
  onDropdownOpenIdChange: (id: number | null) => void;
  onAssignResponsable: (project: AdminProjectTableRow, userId: number) => void;
  cardMenuAnchor: { projectId: number; top: number; right: number } | null;
  onToggleCardMenu: (e: React.MouseEvent<HTMLButtonElement>, projectId: number) => void;
  archivingProjectId: number | null;
  onNavigateDetails: (projectId: number) => void;
}

const AdminProjectsTable: React.FC<AdminProjectsTableProps> = ({
  projects,
  loading,
  user,
  eligibleMembers,
  memberSearch,
  onMemberSearchChange,
  dropdownOpenId,
  onDropdownOpenIdChange,
  onAssignResponsable,
  cardMenuAnchor,
  onToggleCardMenu,
  archivingProjectId,
  onNavigateDetails,
}) => {
  if (loading) {
    return (
      <div className="projects-table-wrap" aria-busy="true" aria-label="Chargement des projets">
        <table className="projects-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nom du projet</th>
              <th>Description</th>
              <th>Chef de projet</th>
              <th>Membres</th>
              <th>Tâches</th>
              <th>Date début</th>
              <th>Date fin</th>
              <th>Progression</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="projects-table-row--skeleton">
                {Array.from({ length: 11 }).map((__, j) => (
                  <td key={j}>
                    <span className="projects-table-skeleton-bar" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="projects-table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th className="projects-table-col-num" scope="col">
              #
            </th>
            <th className="projects-table-col-name" scope="col">
              Nom du projet
            </th>
            <th className="projects-table-col-desc" scope="col">
              Description
            </th>
            <th className="projects-table-col-chef" scope="col">
              Chef de projet
            </th>
            <th className="projects-table-col-count" scope="col">
              Membres
            </th>
            <th className="projects-table-col-count" scope="col">
              Tâches
            </th>
            <th className="projects-table-col-date" scope="col">
              Date début
            </th>
            <th className="projects-table-col-date" scope="col">
              Date fin
            </th>
            <th className="projects-table-col-progress" scope="col">
              Progression
            </th>
            <th className="projects-table-col-status" scope="col">
              Statut
            </th>
            <th className="projects-table-col-actions" scope="col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => {
            const progress = projectProgressPercent(project);
            const statusColor = getProjectStatusColor(project.statut_p ?? project.status);
            const canEditChef = canManageProject(user, project);

            return (
              <tr key={project.id_projet} className="projects-table-row">
                <td className="projects-table-col-num">{index + 1}</td>
                <td className="projects-table-col-name">
                  <button
                    type="button"
                    className="projects-table-name-btn"
                    onClick={() => onNavigateDetails(project.id_projet)}
                  >
                    {project.nom_p || '—'}
                  </button>
                </td>
                <td className="projects-table-col-desc">
                  <span
                    className={`projects-table-desc${!project.description_p ? ' is-empty' : ''}`}
                    title={project.description_p || undefined}
                  >
                    {project.description_p?.trim() || 'Aucune description'}
                  </span>
                </td>
                <td className="projects-table-col-chef">
                  <div className="projects-table-chef-cell">
                    {canEditChef ? (
                      <div className="projects-table-chef-picker-wrap">
                        <button
                          type="button"
                          className="projects-table-chef-picker"
                          onClick={() =>
                            onDropdownOpenIdChange(
                              dropdownOpenId === project.id_projet ? null : project.id_projet
                            )
                          }
                          aria-expanded={dropdownOpenId === project.id_projet}
                        >
                          <span className="projects-table-chef-avatar">
                            {(project.responsable && project.responsable !== 'Non assigné'
                              ? project.responsable
                              : '?'
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                          <span className="projects-table-chef-name">
                            {project.responsable && project.responsable !== 'Non assigné'
                              ? project.responsable
                              : 'Choisir…'}
                          </span>
                        </button>
                        {dropdownOpenId === project.id_projet && (
                          <div
                            className="projects-table-chef-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="projects-table-chef-menu-search">
                              <Search size={14} aria-hidden />
                              <input
                                type="text"
                                placeholder="Chercher un membre…"
                                value={memberSearch}
                                onChange={(e) => onMemberSearchChange(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div className="projects-table-chef-menu-list">
                              {eligibleMembers.length === 0 ? (
                                <p className="projects-table-chef-menu-empty">
                                  Aucun responsable éligible
                                </p>
                              ) : (
                                eligibleMembers.map((m) => (
                                  <button
                                    key={m.id_utilisateur}
                                    type="button"
                                    className={`projects-table-chef-menu-item${
                                      project.chef_id === m.id_utilisateur ? ' is-active' : ''
                                    }`}
                                    onClick={() => {
                                      onAssignResponsable(project, Number(m.id_utilisateur));
                                      onDropdownOpenIdChange(null);
                                      onMemberSearchChange('');
                                    }}
                                  >
                                    <span className="projects-table-chef-avatar">
                                      {String(m.prenom?.[0] || m.email?.[0] || '?').toUpperCase()}
                                    </span>
                                    <span>
                                      {m.prenom} {m.nom}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="projects-table-chef-static">
                        {project.responsable && project.responsable !== 'Non assigné'
                          ? project.responsable
                          : 'Non assigné'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="projects-table-col-count projects-table-col-count--num">
                  {project.membresCount ?? 0}
                </td>
                <td className="projects-table-col-count projects-table-col-count--num">
                  {project.tachesCount ?? 0}
                </td>
                <td className="projects-table-col-date">
                  {formatProjectShortDate(project.date_debut || project.createdAt)}
                </td>
                <td className="projects-table-col-date">
                  {formatProjectShortDate(project.date_fin)}
                </td>
                <td className="projects-table-col-progress">
                  <div className="projects-table-progress">
                    <span className="projects-table-progress-pct">{progress}%</span>
                    <div className="projects-table-progress-bar" aria-hidden>
                      <span
                        className="projects-table-progress-fill"
                        style={{ width: `${progress}%`, backgroundColor: statusColor }}
                      />
                    </div>
                  </div>
                </td>
                <td className="projects-table-col-status">
                  <span
                    className={`projects-table-status ${projectStatusBadgeClass(
                      project.statut_p ?? project.status
                    )}`}
                  >
                    {formatProjectStatus(project.statut_p ?? project.status)}
                  </span>
                </td>
                <td className="projects-table-col-actions">
                  <div className="projects-table-actions">
                    <button
                      type="button"
                      className="projects-table-details-btn"
                      onClick={() => onNavigateDetails(project.id_projet)}
                    >
                      Détails
                      <ArrowRight size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`projects-table-menu-btn${
                        cardMenuAnchor?.projectId === project.id_projet ? ' is-active' : ''
                      }`}
                      aria-label="Actions du projet"
                      aria-expanded={cardMenuAnchor?.projectId === project.id_projet}
                      disabled={archivingProjectId === project.id_projet}
                      onClick={(e) => onToggleCardMenu(e, project.id_projet)}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AdminProjectsTable;
