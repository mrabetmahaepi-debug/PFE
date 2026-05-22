/**
 * URLs des pièces jointes messagerie : stockées en `/uploads/messages/...` côté API.
 */
export function resolveMessageAttachmentUrl(
  path: string | null | undefined
): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim()) {
    const base = raw.trim().replace(/\/+$/, '');
    const origin = base.replace(/\/api\/?$/, '') || base;
    return `${origin}${path}`;
  }
  return path;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
