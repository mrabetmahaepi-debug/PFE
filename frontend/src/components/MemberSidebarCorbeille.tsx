import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import {
  workspaceTrashService,
  type MemberTrashItemType,
  type MemberWorkspaceTrashItem,
} from '../services/workspaceTrash.service';
import { formatTrashDeletedAt } from '../lib/formatTrashDate';
import { TRASH_REFRESH_EVENT } from '../lib/workspaceEvents';
import HierarchyItemConfirmModal from './HierarchyItemConfirmModal';
import './SidebarCorbeille.css';

interface MemberSidebarCorbeilleProps {
  onRefreshTree: () => void | Promise<void>;
}

const GROUP_ORDER: { type: MemberTrashItemType; label: string }[] = [
  { type: 'task', label: 'Tâches' },
  { type: 'subtask', label: 'Sous-tâches' },
  { type: 'list', label: 'Listes' },
  { type: 'sprint', label: 'Sprints' },
];

const TYPE_LABEL: Record<MemberTrashItemType, string> = {
  task: 'Tâche',
  subtask: 'Sous-tâche',
  list: 'Liste',
  sprint: 'Sprint',
};

const MemberSidebarCorbeille: React.FC<MemberSidebarCorbeilleProps> = ({
  onRefreshTree,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MemberWorkspaceTrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<MemberWorkspaceTrashItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await workspaceTrashService.listMember();
      setItems(loaded);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  useEffect(() => {
    const onRefresh = () => void loadTrash();
    window.addEventListener(TRASH_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(TRASH_REFRESH_EVENT, onRefresh);
  }, [loadTrash]);

  useEffect(() => {
    if (open) void loadTrash();
  }, [open, loadTrash]);

  const grouped = useMemo(() => {
    const map = new Map<MemberTrashItemType, MemberWorkspaceTrashItem[]>();
    for (const g of GROUP_ORDER) map.set(g.type, []);
    for (const item of items) {
      const bucket = map.get(item.type);
      if (bucket) bucket.push(item);
    }
    return GROUP_ORDER.map((g) => ({
      ...g,
      items: map.get(g.type) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [items]);

  const handleRestore = async (item: MemberWorkspaceTrashItem) => {
    try {
      if (item.type === 'task' || item.type === 'subtask') {
        await workspaceTrashService.restoreTask(item.id);
      } else if (item.type === 'list') {
        await workspaceTrashService.restoreList(item.id);
      } else {
        await workspaceTrashService.restoreSprint(item.id);
      }
      await loadTrash();
      await onRefreshTree();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      window.alert(ax?.response?.data?.message || 'Restauration impossible.');
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'task' || deleteTarget.type === 'subtask') {
        await workspaceTrashService.deleteTaskPermanent(deleteTarget.id);
      } else if (deleteTarget.type === 'list') {
        await workspaceTrashService.deleteListPermanent(deleteTarget.id);
      } else {
        await workspaceTrashService.deleteSprintPermanent(deleteTarget.id);
      }
      setDeleteTarget(null);
      await loadTrash();
      await onRefreshTree();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      window.alert(ax?.response?.data?.message || 'Suppression impossible.');
    } finally {
      setDeleting(false);
    }
  };

  const entityKindForModal = (item: MemberWorkspaceTrashItem) => {
    if (item.type === 'subtask') return 'subtask' as const;
    if (item.type === 'list') return 'list' as const;
    if (item.type === 'sprint') return 'sprint' as const;
    return 'task' as const;
  };

  return (
    <>
      <div className="cu-corbeille-section">
        <button
          type="button"
          className="cu-corbeille-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Archive size={14} className="cu-corbeille-toggle-icon" />
          <span className="cu-corbeille-toggle-label">Corbeille</span>
          {items.length > 0 && (
            <span className="cu-corbeille-count">{items.length}</span>
          )}
          {open ? (
            <ChevronDown size={14} className="cu-corbeille-chevron" />
          ) : (
            <ChevronRight size={14} className="cu-corbeille-chevron" />
          )}
        </button>
        {open && (
          <div className="cu-corbeille-list">
            {loading && (
              <p className="cu-corbeille-empty">Chargement…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="cu-corbeille-empty">La corbeille est vide.</p>
            )}
            {!loading &&
              grouped.map((group) => (
                <div key={group.type} className="cu-corbeille-group">
                  <p className="cu-corbeille-group-title">{group.label}</p>
                  {group.items.map((item) => (
                    <div
                      key={`${item.type}:${item.id}`}
                      className="cu-corbeille-row cu-corbeille-row--member"
                    >
                      <div className="cu-corbeille-row-main">
                        <span className="cu-corbeille-row-type">
                          {TYPE_LABEL[item.type]}
                        </span>
                        <span className="cu-corbeille-row-name">{item.name}</span>
                        <span className="cu-corbeille-row-meta">
                          {formatTrashDeletedAt(item.deleted_at)}
                          {item.deleted_by_name
                            ? ` · ${item.deleted_by_name}`
                            : ''}
                        </span>
                      </div>
                      <div className="cu-corbeille-row-actions">
                        <button
                          type="button"
                          className="cu-corbeille-action"
                          title="Restaurer"
                          onClick={() => void handleRestore(item)}
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          type="button"
                          className="cu-corbeille-action cu-corbeille-action--danger"
                          title="Supprimer définitivement"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      <HierarchyItemConfirmModal
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        entityKind={
          deleteTarget ? entityKindForModal(deleteTarget) : 'task'
        }
        descriptionLine="Cet élément sera supprimé définitivement. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        loading={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void handlePermanentDelete()}
      />
    </>
  );
};

export default MemberSidebarCorbeille;
