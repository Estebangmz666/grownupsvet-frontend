import type { ReactNode } from "react";
import { useAuthentication } from "@grownupsvet/authentication";
import { hasUserPermission } from "../navigation/roleAccess";
import { SessionAccessState } from "./SessionAccessState";

export function OwnerPermissionBoundary({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { user, logout } = useAuthentication();
  if (user?.role !== "OWNER" || !hasUserPermission(user, permission)) {
    return (
      <SessionAccessState
        message="Tu cuenta no tiene permiso para abrir esta función."
        onLogout={() => void logout()}
      />
    );
  }
  return <>{children}</>;
}
