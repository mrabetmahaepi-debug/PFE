import { getPermissionDeniedMessage } from './workspaceEvents';

export { getPermissionDeniedMessage };

/** Extract a user-facing denial message from an API error. */
export function permissionDeniedFromError(err: unknown): string {
  const ax = err as {
    response?: { status?: number; data?: { message?: string } };
  };
  if (ax?.response?.status === 403) {
    return ax.response.data?.message || getPermissionDeniedMessage();
  }
  return getPermissionDeniedMessage();
}
