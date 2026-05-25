import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Trash2,
  Search,
  Filter,
  Building2,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { teamService } from '../services/team.service';
import { entrepriseService } from '../services/entreprise.service';
import { usePermission } from '../hooks/usePermission';
import type { User } from '../types/auth.types';
import BackButton from '../components/BackButton';
import UserAvatar from '../components/UserAvatar';
import { displayGlobalAccountRole } from '../lib/accountRoleDisplay';
import { useAdminPageHeader } from '../context/AdminPageHeaderContext';
import './Dashboard.css';
import './Team.css';

function normalizeRoleKey(nom: string): string {
  return String(nom ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '');
}

function rawGlobalRoleNom(member: User): string {
  const raw = typeof member.role === 'object' ? member.role?.nom : member.role;
  return String(raw ?? '').trim();
}

/** Global tenant administrators only (never mixed with members table). */
function isAdminTableRow(member: User): boolean {
  const key = normalizeRoleKey(rawGlobalRoleNom(member));
  if (!key) return false;
  if (key === 'SUPERADMIN') return true;
  return key === 'ADMIN' || key === 'ADMINISTRATEUR' || key === 'ADMINENTREPRISE';
}

/** Everyone who is not a global admin (members, chefs de projet, etc.). */
function isMembreTableRow(member: User): boolean {
  return !isAdminTableRow(member);
}

function roleBadgeClass(roleLabel: string, isAdminSection: boolean): string {
  if (isAdminSection) return 'team-role-badge team-role-badge--admin';
  const key = normalizeRoleKey(roleLabel);
  if (key.includes('CHEF') || key.includes('PROJET') || key === 'PM' || key.includes('LEAD')) {
    return 'team-role-badge team-role-badge--chef';
  }
  if (key.includes('DESIGN')) return 'team-role-badge team-role-badge--designer';
  if (key.includes('ANALYST')) return 'team-role-badge team-role-badge--analyste';
  if (key.includes('DEV') || key.includes('DEVELOP')) {
    return 'team-role-badge team-role-badge--dev';
  }
  return 'team-role-badge team-role-badge--default';
}

function projectBadgeClass(roleProjet?: string): string {
  const key = normalizeRoleKey(roleProjet || '');
  if (key.includes('CHEF') || key.includes('PROJET') || key === 'PM') {
    return 'team-project-badge team-project-badge--chef';
  }
  if (key.includes('DESIGN')) return 'team-project-badge team-project-badge--designer';
  if (key.includes('ANALYST')) return 'team-project-badge team-project-badge--analyste';
  return 'team-project-badge';
}

function memberStatutUpper(member: User): string {
  return (member.statut || '').trim().toUpperCase();
}

/** Entreprise liée via id_entreprise ou responsable admin (adminOf). */
function resolveEnterpriseName(member: User): string | null {
  const fromMembership = member.entreprise?.nom?.trim();
  if (fromMembership) return fromMembership;
  const adminOf = (member as User & { adminOf?: { nom?: string | null } }).adminOf;
  const fromAdminOf = adminOf?.nom?.trim();
  return fromAdminOf || null;
}

function renderEnterpriseCell(member: User): React.ReactNode {
  const name = resolveEnterpriseName(member);
  if (name) {
    return (
      <span className="team-enterprise-name" title={name}>
        {name}
      </span>
    );
  }
  return <span className="team-project-none">Aucune entreprise</span>;
}

function isInvitationPendingRow(member: User): boolean {
  return memberStatutUpper(member) === 'INVITATION_PENDING';
}

function renderMemberStatutCell(member: User): React.ReactNode {
  if (isInvitationPendingRow(member)) {
    return (
      <span
        className="team-statut-badge team-statut-invitation"
        title="Invitation envoyée — en attente de l'activation par l'utilisateur"
      >
        Invitation envoyée
      </span>
    );
  }
  if (memberStatutUpper(member) === 'PENDING') {
    return (
      <span className="team-statut-badge team-statut-pending" title="Compte en attente de validation">
        En attente
      </span>
    );
  }
  return (
    <span
      className={`team-statut-badge ${member.isOnline === true ? 'team-statut-active' : 'team-statut-inactive'}`}
    >
      <span className="team-statut-dot" aria-hidden />
      {member.isOnline === true ? 'Actif' : 'Inactif'}
    </span>
  );
}


const TEAM_PROJECTS_VISIBLE = 2;

type TeamProjectRow = { id: number; name: string; roleProjet?: string };

function teamProjectLabel(p: TeamProjectRow): string {
  const rp = p.roleProjet?.trim();
  return rp ? `${p.name} — ${rp}` : p.name;
}

function TeamMemberProjectsCell({ projects }: { projects: TeamProjectRow[] }) {
  const visible = projects.slice(0, TEAM_PROJECTS_VISIBLE);
  const overflowCount = Math.max(0, projects.length - TEAM_PROJECTS_VISIBLE);

  return (
    <div className="team-project-badges">
      {visible.map((p) => {
        const label = teamProjectLabel(p);
        return (
          <span key={p.id} className={projectBadgeClass(p.roleProjet)} title={label}>
            {label}
          </span>
        );
      })}
      {overflowCount > 0 ? (
        <span className="team-project-more-wrap">
          <span className="team-project-badge team-project-badge--more" tabIndex={0}>
            +{overflowCount} autre{overflowCount > 1 ? 's' : ''}
          </span>
          <div className="team-project-more-popover" role="tooltip">
            {projects.map((p) => {
              const label = teamProjectLabel(p);
              return (
                <span
                  key={p.id}
                  className={projectBadgeClass(p.roleProjet)}
                  title={label}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </span>
      ) : null}
    </div>
  );
}

function formatLastLogin(value: string | undefined | null): string {
  if (!value) return 'Jamais connecté';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Jamais connecté';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

type MemberTableProps = {
  sectionTitle: string;
  users: User[];
  emptyHeading: string;
  navigate: ReturnType<typeof useNavigate>;
  onDelete: (id: string | number) => void;
  superAdminTable?: boolean;
};

function renderTeamAvatar(member: User, superAdminTable: boolean) {
  return (
    <div
      className={
        superAdminTable
          ? 'team-user-avatar-wrap team-user-avatar-wrap--super'
          : 'team-user-avatar-wrap'
      }
    >
      <UserAvatar
        user={member}
        className="team-user-avatar--initials"
        imgClassName="team-user-avatar"
      />
    </div>
  );
}

function MemberTable({
  sectionTitle,
  users,
  emptyHeading,
  navigate,
  onDelete,
  superAdminTable = false,
}: MemberTableProps) {
  const isAdminSection = sectionTitle === 'Administrateurs';

  return (
    <section
      className={[
        'card-v3 team-table-section',
        isAdminSection ? 'team-table-section--admin' : 'team-table-section--members',
        superAdminTable ? 'team-table-section--super-admin' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={sectionTitle}
    >
      <header className="team-table-section-head">
        <div className="team-table-section-head-inner">
          {superAdminTable ? (
            <>
              <h2>{sectionTitle}</h2>
              <span className="team-table-count" aria-label={`${users.length} entrées`}>
                {users.length}
              </span>
            </>
          ) : (
            <>
              <h2>{sectionTitle}</h2>
              <span className="team-table-count" aria-label={`${users.length} entrées`}>
                {users.length}
              </span>
            </>
          )}
        </div>
      </header>
      <div className="team-table-wrapper">
        <table className="team-table">
          <colgroup>
            <col className="team-col-w-user" />
            <col className="team-col-w-id" />
            <col className="team-col-w-role" />
            <col className="team-col-w-projects" />
            <col className="team-col-w-email" />
            <col className="team-col-w-login" />
            <col className="team-col-w-statut" />
            <col className="team-col-w-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th className="team-col-id">ID</th>
              <th className="team-col-role">Rôle</th>
              <th>{isAdminSection ? 'Entreprise' : 'Projet(s)'}</th>
              <th>Email</th>
              <th>Dernière connexion</th>
              <th className="team-col-statut">Statut</th>
              <th className="team-table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {users.map((member) => {
                const memberId = member.id_utilisateur || member.id;
                const roleLabel = displayGlobalAccountRole(member);
                return (
                  <motion.tr
                    key={`${sectionTitle}-${memberId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td className="team-cell-user">
                      <div className="team-user-cell">
                        {renderTeamAvatar(member, superAdminTable)}
                        <div>
                          <p className="team-user-name">
                            {member.prenom} {member.nom}
                          </p>
                          <p className="team-user-sub">
                            {member.entreprise?.nom || 'Utilisateur plateforme'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="team-cell-id">
                      <code className="team-id-code">#{memberId}</code>
                    </td>
                    <td className="team-cell-role">
                      <span className={roleBadgeClass(roleLabel, isAdminSection)}>
                        {roleLabel}
                      </span>
                    </td>
                    <td className="team-project-cell">
                      {isAdminSection ? (
                        renderEnterpriseCell(member)
                      ) : member.projects && member.projects.length > 0 ? (
                        <TeamMemberProjectsCell projects={member.projects} />
                      ) : (
                        <span className="team-project-none">Aucun projet</span>
                      )}
                    </td>
                    <td className="team-email-cell" title={member.email}>
                      {member.email}
                    </td>
                    <td
                      className="team-login-cell"
                      title={member.lastLogin ? formatLastLogin(member.lastLogin) : undefined}
                    >
                      {formatLastLogin(member.lastLogin)}
                    </td>
                    <td className="team-cell-statut">{renderMemberStatutCell(member)}</td>
                    <td className="team-table-actions">
                      <div className="team-actions" role="group" aria-label="Actions">
                        <button
                          className="team-action-btn"
                          type="button"
                          title="Voir détails"
                          onClick={() => navigate(`/team/${memberId}`)}
                        >
                          <Eye size={17} strokeWidth={2} />
                        </button>
                        <button
                          className="team-action-btn team-action-btn--danger"
                          type="button"
                          title="Supprimer"
                          onClick={() => onDelete(memberId)}
                        >
                          <Trash2 size={17} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="team-table-empty">
            <div className="icon-wrapper-circle">
              <Search size={24} />
            </div>
            <h3>{emptyHeading}</h3>
            <p>Essayez d&apos;ajuster vos filtres ou votre recherche.</p>
          </div>
        )}
      </div>
    </section>
  );
}

const STATUS_FILTER_LABELS: Record<string, string> = {
  ALL: 'Tous les statuts',
  ACTIVE: 'Actif (en ligne)',
  INACTIVE: 'Inactif (hors ligne)',
};

/** Options shown inside the dropdown (no “Tous les statuts” row). */
const STATUS_MENU_OPTIONS = [
  { value: 'ACTIVE', label: 'Actif (en ligne)' },
  { value: 'INACTIVE', label: 'Inactif (hors ligne)' },
] as const;

const FILTER_MENU_WIDTH = 240;
const FILTER_MENU_GAP = 8;

function estimateMenuHeight(
  optionCount: number,
  opts?: { compact?: boolean }
): number {
  if (opts?.compact) {
    return 12 + 8 + optionCount * 40 + Math.max(0, optionCount - 1) * 2;
  }
  return FILTER_MENU_GAP * 2 + 8 + optionCount * 40 + Math.max(0, optionCount - 1) * 4;
}

function useFilterMenuPosition(
  rootRef: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  optionCount: number,
  menuWidth = FILTER_MENU_WIDTH,
  compact = false
) {
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const menuHeight = estimateMenuHeight(optionCount, { compact });
    let top = rect.bottom + FILTER_MENU_GAP;
    let right = window.innerWidth - rect.right;

    if (top + menuHeight > window.innerHeight - FILTER_MENU_GAP) {
      top = Math.max(FILTER_MENU_GAP, rect.top - menuHeight - FILTER_MENU_GAP);
    }

    const leftEdge = window.innerWidth - right - menuWidth;
    if (leftEdge < FILTER_MENU_GAP) {
      right = Math.max(FILTER_MENU_GAP, window.innerWidth - menuWidth - FILTER_MENU_GAP);
    }

    setMenuPos({ top, right });
  }, [compact, optionCount, menuWidth, rootRef]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  return menuPos;
}

type TeamStatusSelectProps = {
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: 'premium' | 'filter-v3';
};

function TeamStatusSelect({
  value,
  onChange,
  isOpen,
  onOpenChange,
  variant = 'premium',
}: TeamStatusSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerLabel = STATUS_FILTER_LABELS[value] ?? 'Tous les statuts';
  const isFilterActive = value !== 'ALL';
  const menuPos = useFilterMenuPosition(rootRef, isOpen, STATUS_MENU_OPTIONS.length);

  const menuPortal =
    isOpen && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <motion.div
            className="team-themed-dropdown-menu team-status-select-menu team-status-select-menu--portal"
            style={{ top: menuPos.top, right: menuPos.right }}
            role="listbox"
            aria-label="Filtrer par statut"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {STATUS_MENU_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`team-status-select-option${opt.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  onOpenChange(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`team-status-select team-status-select--${variant}${isOpen ? ' is-open' : ''}${isFilterActive ? ' is-filter-active' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Filter size={16} className="team-status-select-icon" aria-hidden />
      <button
        type="button"
        className="team-status-select-trigger"
        aria-label="Filtrer par statut"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span>{triggerLabel}</span>
        <ChevronDown size={variant === 'premium' ? 16 : 14} className="team-status-select-chevron" aria-hidden />
      </button>
      {menuPortal}
    </div>
  );
}

type EnterpriseOption = { id_entreprise: string | number; nom: string };

type TeamEnterpriseSelectProps = {
  value: string;
  onChange: (value: string) => void;
  enterprises: EnterpriseOption[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

function TeamEnterpriseSelect({
  value,
  onChange,
  enterprises,
  isOpen,
  onOpenChange,
}: TeamEnterpriseSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuOptions = useMemo(
    () =>
      enterprises.map((ent) => ({
        value: String(ent.id_entreprise),
        label: ent.nom,
      })),
    [enterprises]
  );
  const triggerLabel =
    value === 'ALL'
      ? 'Toutes les entreprises'
      : menuOptions.find((opt) => opt.value === value)?.label ?? 'Toutes les entreprises';
  const isFilterActive = value !== 'ALL';
  const menuPos = useFilterMenuPosition(rootRef, isOpen, menuOptions.length, 300, true);

  const menuPortal =
    isOpen && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <motion.div
            className="team-themed-dropdown-menu team-enterprise-select-menu team-status-select-menu--portal"
            style={{ top: menuPos.top, right: menuPos.right }}
            role="listbox"
            aria-label="Filtrer par entreprise"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menuOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`team-status-select-option team-enterprise-select-option${opt.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value === value ? 'ALL' : opt.value);
                  onOpenChange(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`team-enterprise-select team-status-select team-status-select--filter-v3${isOpen ? ' is-open' : ''}${isFilterActive ? ' is-filter-active' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Building2 size={16} className="team-status-select-icon" aria-hidden />
      <button
        type="button"
        className="team-status-select-trigger"
        aria-label="Filtrer par entreprise"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span>{triggerLabel}</span>
        <ChevronDown size={14} className="team-status-select-chevron" aria-hidden />
      </button>
      {menuPortal}
    </div>
  );
}

const Team: React.FC = () => {
  const { can, isSuperAdmin } = usePermission();
  const { setHeader: setAdminPageHeader } = useAdminPageHeader();
  const navigate = useNavigate();

  const [members, setMembers] = useState<User[]>([]);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialStatus = queryParams.get('status') === 'active' ? 'ACTIVE' : 'ALL';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [entrepriseFilter, setEntrepriseFilter] = useState('ALL');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [entrepriseMenuOpen, setEntrepriseMenuOpen] = useState(false);

  useEffect(() => {
    fetchMembers();
    if (isSuperAdmin) {
      fetchEnterprises();
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      return;
    }
    setAdminPageHeader({ title: 'Équipe' });
    return () => setAdminPageHeader(null);
  }, [isSuperAdmin, setAdminPageHeader]);

  useEffect(() => {
    const closeMenus = () => {
      setStatusMenuOpen(false);
      setEntrepriseMenuOpen(false);
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teamService.getAllMembers();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Failed to fetch team members:', err);
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      setError(
        ax.response?.data?.error ||
          ax.response?.data?.message ||
          "Impossible de charger les membres de l'équipe."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchEnterprises = async () => {
    try {
      const data = await entrepriseService.getAll();
      setEnterprises(data);
    } catch (fetchErr) {
      console.error('Failed to fetch enterprises:', fetchErr);
    }
  };

  const deleteMember = async (id: string | number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        await teamService.deleteMember(id.toString());
        setMembers((prev) => prev.filter((m) => (m.id_utilisateur || m.id) !== id));
      } catch (deleteErr) {
        console.error('Failed to delete member:', deleteErr);
      }
    }
  };

  const filteredMembers = members.filter((m) => {
    const invitationPending = isInvitationPendingRow(m);
    const online = m.isOnline === true;
    const projectBlob = (m.projects || [])
      .map(
        (p) =>
          `${p.name} ${'roleProjet' in p ? (p as { roleProjet?: string }).roleProjet ?? '' : ''}`
      )
      .join(' ')
      .toLowerCase();
    const matchesSearch = `${m.prenom} ${m.nom} ${m.email} ${m.entreprise?.nom || ''} ${projectBlob}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && online && !invitationPending) ||
      (statusFilter === 'INACTIVE' && (!online || invitationPending));
    const matchesEntreprise =
      entrepriseFilter === 'ALL' || m.id_entreprise?.toString() === entrepriseFilter;

    return matchesSearch && matchesStatus && matchesEntreprise;
  });

  const filteredAdmins = filteredMembers.filter(isAdminTableRow);
  const filteredMembres = filteredMembers.filter(isMembreTableRow);

  return (
    <div
      className={`dashboard-page team-page${
        isSuperAdmin ? ' team-page--super-admin' : ' team-page--admin-equipe team-page--navbar-title'
      }`}
    >
      {isSuperAdmin ? (
        <>
          <BackButton fallback="/dashboard" />
          <header className="page-header team-page-header">
            <div className="team-page-header__main">
              <h1 className="team-page-title">Gestion des Administrateurs</h1>
            </div>
          </header>
        </>
      ) : null}

      <div
        className={
          isSuperAdmin ? 'team-filters-bar team-filters-bar--super' : 'team-filters-bar'
        }
      >
        <div
          className={`team-filters-row team-filters-row--toolbar${
            isSuperAdmin ? ' team-filters-row--super' : ''
          }`}
        >
          <label className="team-search-field search-container">
            <Search size={18} className="search-icon" aria-hidden />
            <input
              type="search"
              placeholder={
                isSuperAdmin ? 'Nom, email, entreprise…' : 'Nom, email, entreprise, projet…'
              }
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Rechercher dans l'équipe"
            />
          </label>

          {!isSuperAdmin ? (
            <div className="team-equipe-actions-group">
              {can('TEAM_INVITE') && (
                <button
                  className="team-equipe-premium-btn team-invite-btn"
                  type="button"
                  onClick={() => navigate('/invite')}
                >
                  <UserPlus size={15} aria-hidden />
                  <span>Inviter un membre</span>
                </button>
              )}
              <TeamStatusSelect
                value={statusFilter}
                onChange={setStatusFilter}
                isOpen={statusMenuOpen}
                onOpenChange={setStatusMenuOpen}
                variant="premium"
              />
            </div>
          ) : (
            <div className="team-filters-actions team-filters-actions--super">
              <TeamEnterpriseSelect
                value={entrepriseFilter}
                onChange={setEntrepriseFilter}
                enterprises={enterprises}
                isOpen={entrepriseMenuOpen}
                onOpenChange={(open) => {
                  setEntrepriseMenuOpen(open);
                  if (open) setStatusMenuOpen(false);
                }}
              />
              <TeamStatusSelect
                value={statusFilter}
                onChange={setStatusFilter}
                isOpen={statusMenuOpen}
                onOpenChange={(open) => {
                  setStatusMenuOpen(open);
                  if (open) setEntrepriseMenuOpen(false);
                }}
                variant="filter-v3"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card-v3" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="loading-state">
            <motion.div className="loader" />
            <p>{isSuperAdmin ? 'Chargement des administrateurs…' : 'Chargement des membres...'}</p>
          </div>
        </div>
      ) : error ? (
        <div className="card-v3" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="error-state">
            <div className="error-card">
              <h3>Erreur</h3>
              <p>{error}</p>
              <button type="button" onClick={fetchMembers} className="primary-btn" style={{ marginTop: '1rem' }}>
                Réessayer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="team-sections">
          <MemberTable
            sectionTitle="Administrateurs"
            users={filteredAdmins}
            emptyHeading="Aucun administrateur trouvé."
            navigate={navigate}
            onDelete={deleteMember}
            superAdminTable={isSuperAdmin}
          />
          {!isSuperAdmin && (
            <MemberTable
              sectionTitle="Membres"
              users={filteredMembres}
              emptyHeading="Aucun membre trouvé."
              navigate={navigate}
              onDelete={deleteMember}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Team;
