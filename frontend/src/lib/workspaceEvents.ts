/** Dispatched after sidebar hierarchy changes that should refresh the workspace view. */
export const WORKSPACE_REFRESH_EVENT = 'virtide:workspace-refresh';

export function dispatchWorkspaceRefresh(): void {
  window.dispatchEvent(new CustomEvent(WORKSPACE_REFRESH_EVENT));
}
