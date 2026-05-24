import React, { useCallback, useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import {
  workspaceTrashService,
  type WorkspaceTrashItem,
} from '../services/workspaceTrash.service';
import HierarchyItemConfirmModal from './HierarchyItemConfirmModal';
import './SidebarCorbeille.css';

interface SidebarCorbeilleProps {
  onRefreshTree: () => void | Promise<void>;
}

const TYPE_LABEL: Record<WorkspaceTrashItem['type'], string> = {
  space: 'Espace',
  project: 'Dossier',
  list: 'Liste',
};

const SidebarCorbeille: React.FC<SidebarCorbeilleProps> = ({ onRefreshTree }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WorkspaceTrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceTrashItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await workspaceTrashService.list();
      setItems(loaded);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadTrash();
  }, [open, loadTrash]);

  const handleRestore = async (item: WorkspaceTrashItem) => {
    try {
      if (item.type === 'space') await workspaceTrashService.restoreSpace(item.id);
      else if (item.type === 'project')
        await workspaceTrashService.restoreProject(item.id);
      else await workspaceTrashService.restoreList(item.id);
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
      if (deleteTarget.type === 'space')
        await workspaceTrashService.deleteSpacePermanent(deleteTarget.id);
      else if (deleteTarget.type === 'project')
        await workspaceTrashService.deleteProjectPermanent(deleteTarget.id);
      else await workspaceTrashService.deleteListPermanent(deleteTarget.id);
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
              items.map((item) => (
                <div key={`${item.type}:${item.id}`} className="cu-corbeille-row">
                  <div className="cu-corbeille-row-main">
                    <span className="cu-corbeille-row-type">
                      {TYPE_LABEL[item.type]}
                    </span>
                    <span className="cu-corbeille-row-name">{item.name}</span>
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
        )}
      </div>

      <HierarchyItemConfirmModal
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        entityKind={
          deleteTarget?.type === 'space'
            ? 'space'
            : deleteTarget?.type === 'project'
              ? 'folder'
              : 'list'
        }
        confirmLabel="Supprimer"
        loading={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void handlePermanentDelete()}
      />
    </>
  );
};

export default SidebarCorbeille;
