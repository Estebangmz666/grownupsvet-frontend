import type { AuthenticatedUser } from "@grownupsvet/api-client";

export type ApplicationArea =
  "owner" | "administrators" | "veterinarians" | "assignedAppointments";
export function hasUserPermission(
  user: Pick<AuthenticatedUser, "permissions"> | null,
  permission: string,
): boolean {
  return (
    Array.isArray(user?.permissions) && user.permissions.includes(permission)
  );
}
export function resolveApplicationArea(
  user: AuthenticatedUser | null,
): ApplicationArea | null {
  if (!user) return null;
  switch (user.role) {
    case "OWNER":
      return [
        "PET_READ_SELF",
        "APPOINTMENT_READ_SELF",
        "PROFILE_READ_SELF",
      ].some((permission) => hasUserPermission(user, permission))
        ? "owner"
        : null;
    case "SUPER_ADMIN":
      return hasUserPermission(user, "ADMINISTRATOR_MANAGE")
        ? "administrators"
        : null;
    case "ADMINISTRATOR":
      return hasUserPermission(user, "VETERINARIAN_MANAGE")
        ? "veterinarians"
        : null;
    case "VETERINARIAN":
      return hasUserPermission(user, "APPOINTMENT_READ_ASSIGNED")
        ? "assignedAppointments"
        : null;
    default:
      return null;
  }
}
