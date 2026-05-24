import React from 'react';
import type { SpaceTreeNode } from '../types/hierarchy';
import ClickUpSidebarTree from './ClickUpSidebarTree';

interface MemberSpaceSidebarTreeProps {
  spaces: SpaceTreeNode[];
  spacesLoading?: boolean;
  activeSpaceId?: number | null;
  activeProjectId?: number | null;
  activeSprintId?: number | null;
  activeListId?: number | null;
  activeTaskId?: number | null;
  onRefresh: () => void | Promise<void>;
}

/**
 * Member « Mon espace » sidebar — ClickUp controls + Project → Sprint → List → Task.
 * Create/menu actions respect project-scoped permissions (handlers in ClickUpSidebarTree).
 */
const MemberSpaceSidebarTree: React.FC<MemberSpaceSidebarTreeProps> = (props) => (
  <ClickUpSidebarTree
    {...props}
    layout="sprint"
    monEspaceRoot
    useProjectScopedCreate
    canCreateProject={false}
    canCreateList={false}
    canCreateTask={false}
  />
);

export default MemberSpaceSidebarTree;
