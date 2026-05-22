import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, X, Loader2, Search, UserPlus, UserMinus, Pencil } from 'lucide-react';
import {
  messagingService,
  type Conversation,
  type MessagingTeamMember,
} from '../services/messaging.service';
import './MessagingAdminModals.css';

type MemberTab = 'all' | 'chefs';

function initialsFrom(m: MessagingTeamMember): string {
  const a = (m.prenom?.[0] ?? '').toUpperCase();
  const b = (m.nom?.[0] ?? '').toUpperCase();
  const s = `${a}${b}`.trim();
  if (s) return s;
  return (m.email?.[0] ?? '?').toUpperCase();
}

function displayName(m: MessagingTeamMember): string {
  const n = `${m.prenom ?? ''} ${m.nom ?? ''}`.trim();
  return n || m.email || 'Utilisateur';
}

/** Admin d'entreprise (rôle global), pour le mode Super Admin « Gérer les admins ». */
function isGlobalTenantAdminRole(m: MessagingTeamMember): boolean {
  const r = String(m.globalRole ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return r === 'admin' || r === 'administrateur';
}

/* ─── Create discussion ─────────────────────────────────────────────── */
export interface CreateDiscussionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
  onError: (msg: string) => void;
  /** `super` : discussion avec des administrateurs d’entreprise (sans choix d’entreprise). */
  variant?: 'tenant' | 'super';
}

export const CreateDiscussionModal: React.FC<CreateDiscussionModalProps> = ({
  open,
  onClose,
  onCreated,
  onError,
  variant = 'tenant',
}) => {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [tab, setTab] = useState<MemberTab>('all');
  const [search, setSearch] = useState('');
  const [addAllChefs, setAddAllChefs] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [team, setTeam] = useState<MessagingTeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNom('');
    setDescription('');
    setTab('all');
    setSearch('');
    setAddAllChefs(false);
    setSelected(new Set());
    setTeam([]);
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    setLoadingTeam(true);
    messagingService
      .getTeamMembers()
      .then(setTeam)
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Impossible de charger l'équipe.";
        onError(msg);
      })
      .finally(() => setLoadingTeam(false));
  }, [open, variant, onError]);

  const filteredTeam = useMemo(() => {
    if (variant === 'super') {
      const admins = team.filter((m) => isGlobalTenantAdminRole(m));
      const q = search.trim().toLowerCase();
      if (!q) return admins;
      return admins.filter((m) => {
        const blob = [
          displayName(m),
          m.email ?? '',
          m.globalRole ?? '',
          m.entrepriseNom ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    let list =
      tab === 'chefs' ? team.filter((m) => m.isChefDeProjet) : [...team];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const blob = [
          displayName(m),
          m.email ?? '',
          m.globalRole ?? '',
          ...m.projectRoles.map(
            (r) => `${r.role_projet} ${r.nom_p}`
          ),
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [team, tab, search, variant]);

  const chefIds = useMemo(
    () => new Set(team.filter((m) => m.isChefDeProjet).map((m) => m.id_utilisateur)),
    [team]
  );

  useEffect(() => {
    if (variant !== 'tenant') return;
    if (!addAllChefs) return;
    setSelected((prev) => {
      const n = new Set(prev);
      chefIds.forEach((id) => n.add(id));
      return n;
    });
  }, [addAllChefs, chefIds, variant]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nom.trim();
    if (!name) return;
    if (variant === 'super' && selected.size === 0) {
      onError('Sélectionnez au moins un administrateur.');
      return;
    }
    setSubmitting(true);
    try {
      const conv =
        variant === 'super'
          ? await messagingService.createDiscussion({
              nom: name,
              description: description.trim() || undefined,
              selectedAdminIds: [...selected],
            })
          : await messagingService.createDiscussion({
              nom: name,
              description: description.trim() || undefined,
              participantIds: [...selected],
              addAllChefs,
            });
      onCreated(conv);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Impossible de créer la discussion.';
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="messaging-light-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="messaging-light-modal messaging-light-modal--wide"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="messaging-light-modal-header">
          <div className="messaging-light-modal-title-block">
            <div className="messaging-light-modal-icon" aria-hidden>
              <UserPlus size={20} />
            </div>
            <div>
              <h3>Nouvelle discussion</h3>
              {variant === 'super' ? (
                <p className="messaging-light-modal-subtitle">
                  Créez une discussion avec des admins.
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="messaging-light-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="messaging-light-form">
          <div className="messaging-light-field">
            <label htmlFor="disc-nom">Nom de la discussion</label>
            <input
              id="disc-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex: Chefs de projet — suivi hebdo"
              required
              maxLength={100}
            />
          </div>
          <div className="messaging-light-field">
            <label htmlFor="disc-desc">Description optionnelle</label>
            <textarea
              id="disc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Objectif du groupe..."
            />
          </div>

          {variant === 'tenant' && (
            <label className="messaging-light-checkbox">
              <input
                type="checkbox"
                checked={addAllChefs}
                onChange={(e) => setAddAllChefs(e.target.checked)}
              />
              <span>Ajouter tous les Chefs de Projet</span>
            </label>
          )}

          <div>
            <p className="messaging-light-section-title">
              {variant === 'super' ? 'Admins à ajouter' : 'Membres à ajouter'}
            </p>
            {variant === 'tenant' && (
              <div className="messaging-light-tabs">
                <button
                  type="button"
                  className={tab === 'all' ? 'active' : ''}
                  onClick={() => setTab('all')}
                >
                  Tous les membres
                </button>
                <button
                  type="button"
                  className={tab === 'chefs' ? 'active' : ''}
                  onClick={() => setTab('chefs')}
                >
                  Chefs de Projet
                </button>
              </div>
            )}
          </div>

          <div className="messaging-light-search">
            <Search size={16} aria-hidden />
            <input
              type="text"
              placeholder={
                variant === 'super' ? 'Rechercher un admin…' : 'Rechercher un membre…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="messaging-light-member-list">
            {loadingTeam ? (
              <div className="messaging-light-loading">
                <Loader2 className="animate-spin" size={22} />
              </div>
            ) : filteredTeam.length === 0 ? (
              <p className="messaging-light-muted">
                {variant === 'super' ? 'Aucun admin trouvé' : 'Aucun membre dans cette vue.'}
              </p>
            ) : (
              filteredTeam.map((m) => (
                <label key={m.id_utilisateur} className="messaging-light-member-row">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id_utilisateur)}
                    onChange={() => toggle(m.id_utilisateur)}
                  />
                  <div className="messaging-light-avatar">{initialsFrom(m)}</div>
                  <div className="messaging-light-member-main">
                    <div className="messaging-light-member-name">{displayName(m)}</div>
                    <div className="messaging-light-member-email">{m.email}</div>
                    {variant === 'super' && m.entrepriseNom ? (
                      <div className="messaging-light-muted messaging-light-member-company">
                        {m.entrepriseNom}
                      </div>
                    ) : null}
                    {variant === 'tenant' ? (
                      <div className="messaging-light-member-roles">
                        <span>{m.globalRole ?? '—'}</span>
                        {m.projectRoles.map((r) => (
                          <span key={`${m.id_utilisateur}-${r.id_projet}-${r.role_projet}`}>
                            {r.role_projet} — {r.nom_p || 'Projet'}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="messaging-light-footer">
            <button type="button" className="messaging-light-btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="messaging-light-btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              Créer la discussion
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ─── Manage members ────────────────────────────────────────────────── */
export interface ManageMembersModalProps {
  open: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onUpdated: (conv: Conversation) => void;
  onError: (msg: string) => void;
  /** Appelé après retrait réussi d’un participant (ex. toast). */
  onMemberRemoved?: () => void;
  /** `admins` : libellés et périmètre « administrateurs entreprise » (messagerie Super Admin). */
  variant?: 'members' | 'admins';
}

export const ManageMembersModal: React.FC<ManageMembersModalProps> = ({
  open,
  conversation,
  onClose,
  onUpdated,
  onError,
  onMemberRemoved,
  variant = 'members',
}) => {
  const [conv, setConv] = useState<Conversation | null>(conversation);
  const [team, setTeam] = useState<MessagingTeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [addIds, setAddIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState<{
    userId: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !conversation) return;
    setConv(conversation);
    setAddIds(new Set());
    setAddSearch('');
    setRemoveConfirm(null);
    setLoading(true);
    Promise.all([
      messagingService.getConversation(conversation.id_conversation),
      conversation.id_entreprise != null
        ? messagingService.getTeamMembers(conversation.id_entreprise)
        : variant === 'admins'
          ? messagingService.getTeamMembers()
          : Promise.resolve([] as MessagingTeamMember[]),
    ])
      .then(([c, t]) => {
        setConv(c);
        setTeam(t);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Chargement impossible.';
        onError(msg);
      })
      .finally(() => setLoading(false));
  }, [open, conversation?.id_conversation, conversation?.id_entreprise, variant, onError]);

  const participantIds = useMemo(
    () => new Set((conv?.participants ?? []).map((p) => p.id_utilisateur)),
    [conv]
  );

  const teamById = useMemo(() => {
    const m = new Map<number, MessagingTeamMember>();
    team.forEach((t) => m.set(t.id_utilisateur, t));
    return m;
  }, [team]);

  const availableToAdd = useMemo(
    () => team.filter((m) => !participantIds.has(m.id_utilisateur)),
    [team, participantIds]
  );

  const adminCandidates = useMemo(() => {
    if (variant !== 'admins') return [] as MessagingTeamMember[];
    return team.filter(
      (m) => !participantIds.has(m.id_utilisateur) && isGlobalTenantAdminRole(m)
    );
  }, [variant, team, participantIds]);

  const filteredAdminCandidates = useMemo(() => {
    if (variant !== 'admins') return [] as MessagingTeamMember[];
    const q = addSearch.trim().toLowerCase();
    if (!q) return adminCandidates;
    return adminCandidates.filter((m) => {
      const blob = [
        displayName(m),
        m.email ?? '',
        m.globalRole ?? '',
        m.entrepriseNom ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [variant, adminCandidates, addSearch]);

  const addListRows =
    variant === 'admins' ? filteredAdminCandidates : availableToAdd;

  const toggleAdd = (id: number) => {
    setAddIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleRemove = async (userId: number) => {
    if (!conv) return;
    setSaving(true);
    try {
      const updated = await messagingService.removeParticipant(
        conv.id_conversation,
        userId
      );
      setConv(updated);
      setRemoveConfirm(null);
      onUpdated(updated);
      onMemberRemoved?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Retrait impossible.';
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMembers = async () => {
    if (!conv || addIds.size === 0) return;
    setSaving(true);
    try {
      const updated = await messagingService.addParticipants(conv.id_conversation, [
        ...addIds,
      ]);
      setConv(updated);
      onUpdated(updated);
      setAddIds(new Set());
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Ajout impossible.";
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !conversation) return null;

  return (
    <div className="messaging-light-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="messaging-light-modal messaging-light-modal--wide"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="messaging-light-modal-header">
          <div className="messaging-light-modal-title-block">
            <div className="messaging-light-modal-icon" aria-hidden>
              <Users size={20} />
            </div>
            <div>
              <h3>{variant === 'admins' ? 'Gérer les admins' : 'Gérer les membres'}</h3>
              <p className="messaging-light-modal-subtitle">
                {conv?.nom ?? conversation.nom}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="messaging-light-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {loading || !conv ? (
          <div className="messaging-light-loading messaging-light-manage-body">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : (
          <div className="messaging-light-manage-body">
            <h4 className="messaging-light-subheading">
              {variant === 'admins'
                ? 'Admins et participants à la discussion'
                : 'Membres actuels'}
            </h4>
            <ul className="messaging-light-current-list">
              {conv.participants.map((p) => {
                const tm = teamById.get(p.id_utilisateur);
                const showRemove =
                  variant !== 'admins' ||
                  (p.id_utilisateur !== (conv.created_by_id ?? -1) &&
                    !!(tm && isGlobalTenantAdminRole(tm)));
                return (
                  <li key={p.id_participant}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="messaging-light-avatar messaging-light-avatar--sm">
                          {tm
                            ? initialsFrom(tm)
                            : `${p.utilisateur.prenom?.[0] ?? ''}${p.utilisateur.nom?.[0] ?? ''}`.toUpperCase() || '?'}
                        </div>
                        <div>
                          <strong style={{ fontWeight: 600 }}>
                            {p.utilisateur.prenom} {p.utilisateur.nom}
                          </strong>
                          <small>{p.utilisateur.email}</small>
                          <div className="messaging-light-participant-role-line">
                            <span>Rôle : {tm?.globalRole ?? '—'}</span>
                            {p.isAdmin ? (
                              <span className="messaging-light-badge-admin">Admin discussion</span>
                            ) : null}
                          </div>
                          {variant === 'admins' && tm?.entrepriseNom ? (
                            <div className="messaging-light-muted" style={{ marginTop: 4 }}>
                              {tm.entrepriseNom}
                            </div>
                          ) : null}
                          {variant === 'members' &&
                            tm &&
                            tm.projectRoles.length > 0 && (
                              <div className="messaging-light-member-roles" style={{ marginTop: 4 }}>
                                {tm.projectRoles.map((r) => (
                                  <span key={`p-${p.id_participant}-${r.id_projet}`}>
                                    {r.role_projet} — {r.nom_p || 'Projet'}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                    {showRemove ? (
                      <button
                        type="button"
                        className="messaging-light-btn-danger"
                        disabled={saving}
                        onClick={() =>
                          setRemoveConfirm({
                            userId: p.id_utilisateur,
                            label:
                              `${p.utilisateur.prenom ?? ''} ${p.utilisateur.nom ?? ''}`.trim() ||
                              (p.utilisateur.email ?? 'Membre'),
                          })
                        }
                      >
                        <UserMinus size={14} /> Retirer
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <h4 className="messaging-light-subheading">
              {variant === 'admins' ? 'Ajouter un admin' : 'Ajouter membre'}
            </h4>
            {conversation.id_entreprise != null || variant === 'admins' ? (
              <>
                {variant === 'admins' && (
                  <div className="messaging-light-search messaging-light-search--manage">
                    <Search size={16} aria-hidden />
                    <input
                      type="search"
                      placeholder="Rechercher un admin…"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      aria-label="Rechercher un admin"
                    />
                  </div>
                )}
                <div className="messaging-light-member-list messaging-light-add-list">
                  {addListRows.length === 0 ? (
                    <p className="messaging-light-muted">
                      {variant === 'admins'
                        ? 'Aucun admin trouvé'
                        : "Tous les membres de l'équipe sont déjà dans la discussion."}
                    </p>
                  ) : (
                    addListRows.map((m) => (
                      <label key={m.id_utilisateur} className="messaging-light-member-row">
                        <input
                          type="checkbox"
                          checked={addIds.has(m.id_utilisateur)}
                          onChange={() => toggleAdd(m.id_utilisateur)}
                        />
                        <div className="messaging-light-avatar">{initialsFrom(m)}</div>
                        <div className="messaging-light-member-main">
                          <div className="messaging-light-member-name">{displayName(m)}</div>
                          <div className="messaging-light-member-email">{m.email}</div>
                          {variant === 'admins' && m.entrepriseNom ? (
                            <div className="messaging-light-muted messaging-light-member-company">
                              {m.entrepriseNom}
                            </div>
                          ) : null}
                          {variant === 'members' ? (
                            <div className="messaging-light-member-roles">
                              <span>{m.globalRole ?? '—'}</span>
                              {m.projectRoles.map((r) => (
                                <span key={`add-${m.id_utilisateur}-${r.id_projet}`}>
                                  {r.role_projet} — {r.nom_p || 'Projet'}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="messaging-light-muted">
                Cette discussion n&apos;est pas liée à une entreprise : l&apos;ajout de membres via
                l&apos;annuaire entreprise n&apos;est pas disponible.
              </p>
            )}
            <div className="messaging-light-manage-actions">
              <button
                type="button"
                className="messaging-light-btn-primary"
                disabled={saving || addIds.size === 0}
                onClick={() => void handleAddMembers()}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                {variant === 'admins' ? 'Ajouter un admin' : 'Ajouter membre'}
              </button>
              <button type="button" className="messaging-light-btn-secondary" onClick={onClose}>
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {removeConfirm && (
          <div
            className="messaging-light-nested-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
          >
            <div
              className="messaging-light-nested-dialog"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h4 id="remove-member-title" className="messaging-light-nested-title">
                {variant === 'admins'
                  ? 'Retirer cet administrateur de la discussion ?'
                  : 'Retirer ce membre de la discussion ?'}
              </h4>
              <p className="messaging-light-nested-text">
                <strong>{removeConfirm.label}</strong> n&apos;aura plus accès à cette discussion.
              </p>
              <div className="messaging-light-footer messaging-light-footer--compact">
                <button
                  type="button"
                  className="messaging-light-btn-secondary"
                  disabled={saving}
                  onClick={() => setRemoveConfirm(null)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="messaging-light-btn-danger messaging-light-btn-danger--solid"
                  disabled={saving}
                  onClick={() => void handleRemove(removeConfirm.userId)}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                  Retirer
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

/* ─── Edit discussion (nom / description) ───────────────────────────── */
export interface EditDiscussionModalProps {
  open: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onSaved: (conv: Conversation) => void;
  onError: (msg: string) => void;
}

export const EditDiscussionModal: React.FC<EditDiscussionModalProps> = ({
  open,
  conversation,
  onClose,
  onSaved,
  onError,
}) => {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !conversation) return;
    setNom((conversation.nom ?? '').trim());
    setDescription((conversation.description ?? '').trim());
    setFieldError(null);
  }, [open, conversation?.id_conversation, conversation?.nom, conversation?.description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nom.trim();
    if (!trimmed) {
      setFieldError('Le nom de la discussion est requis.');
      return;
    }
    if (!conversation) return;
    setSaving(true);
    setFieldError(null);
    try {
      const payload: { name: string; description: string } = {
        name: trimmed,
        description: description.trim(),
      };
      const updated = await messagingService.updateDiscussion(
        conversation.id_conversation,
        payload
      );
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Impossible de modifier la discussion.';
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !conversation) return null;

  return (
    <div className="messaging-light-overlay" onClick={() => !saving && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="messaging-light-modal messaging-light-modal--wide"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="messaging-light-modal-header">
          <div className="messaging-light-modal-title-block">
            <div className="messaging-light-modal-icon" aria-hidden>
              <Pencil size={20} />
            </div>
            <div>
              <h3>Modifier la discussion</h3>
            </div>
          </div>
          <button
            type="button"
            className="messaging-light-close"
            onClick={() => !saving && onClose()}
            aria-label="Fermer"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="messaging-light-form">
          <div className="messaging-light-field">
            <label htmlFor="edit-disc-nom">Nom de la discussion</label>
            <input
              id="edit-disc-nom"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="Nom du groupe"
              maxLength={100}
              required
              disabled={saving}
              autoFocus
            />
            {fieldError ? <p className="messaging-light-field-error">{fieldError}</p> : null}
          </div>

          <div className="messaging-light-field">
            <label htmlFor="edit-disc-desc">Description optionnelle</label>
            <textarea
              id="edit-disc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Objectif du groupe..."
              disabled={saving}
            />
          </div>

          <div className="messaging-light-footer">
            <button
              type="button"
              className="messaging-light-btn-secondary"
              disabled={saving}
              onClick={onClose}
            >
              Annuler
            </button>
            <button type="submit" className="messaging-light-btn-primary" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : null}
              Enregistrer
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
