import React from "react";
import { usePermission } from "../hooks/usePermission";

interface BaseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PermissionProps extends BaseProps {
  permission: string;
  any?: never;
  all?: never;
}

interface AnyProps extends BaseProps {
  any: string[];
  permission?: never;
  all?: never;
}

interface AllProps extends BaseProps {
  all: string[];
  permission?: never;
  any?: never;
}

export type CanProps = PermissionProps | AnyProps | AllProps;

/**
 * Conditional rendering helper driven by the centralized permission system.
 *
 *   <Can permission="PROJECT_CREATE">
 *     <button>New project</button>
 *   </Can>
 *
 *   <Can any={["PROJECT_EDIT", "PROJECT_DELETE"]} fallback={<ReadOnlyHint />}>
 *     <ProjectActions />
 *   </Can>
 */
const Can: React.FC<CanProps> = (props) => {
  const { can, canAny, canAll } = usePermission();

  let allowed = false;
  if ("permission" in props && props.permission) {
    allowed = can(props.permission);
  } else if ("any" in props && props.any) {
    allowed = canAny(props.any);
  } else if ("all" in props && props.all) {
    allowed = canAll(props.all);
  }

  if (!allowed) return <>{props.fallback ?? null}</>;
  return <>{props.children}</>;
};

export default Can;
