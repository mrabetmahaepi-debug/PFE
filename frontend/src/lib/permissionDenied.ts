import { PERMISSION_DENIED_MESSAGE } from './workspaceEvents';

export { PERMISSION_DENIED_MESSAGE };

/** Extract a user-facing denial message from an API error. */
export function permissionDeniedFromError(err: unknown): string {
  const ax = err as {
    response?: { status?: number; data?: { message?: string } };
  };
  if (ax?.response?.status === 403) {
    return ax.response.data?.message || PERMISSION_DENIED_MESSAGE;
  }
  return PERMISSION_DENIED_MESSAGE;
}
