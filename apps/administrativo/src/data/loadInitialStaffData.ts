import { ApiError, type AuthenticatedUser } from "@grownupsvet/api-client";
import type { ApiRequestContext } from "@api-client/client";
import {
  listAdministrators,
  listAssignedAppointmentsForDay,
  listVeterinarians,
  STAFF_PAGE_SIZE,
} from "@api-client/staff.api";
import {
  bogotaToday,
  isStaffRole,
  staffRequiredPermissions,
} from "../staffPresentation";
import type { InitialStaffData } from "../staff.types";

export async function loadInitialStaffData(
  user: AuthenticatedUser,
  requestContext?: ApiRequestContext,
): Promise<InitialStaffData> {
  if (
    !isStaffRole(user.role) ||
    !user.permissions.includes(staffRequiredPermissions[user.role])
  ) {
    throw new ApiError({
      status: 403,
      errorCode: "ACCESS_DENIED",
      detail: "Tu cuenta no tiene permiso para consultar esta área.",
      fieldErrors: [],
    });
  }
  const params = { page: 0, size: STAFF_PAGE_SIZE };
  switch (user.role) {
    case "SUPER_ADMIN":
      return {
        role: user.role,
        page: await listAdministrators(params, {}, requestContext),
      };
    case "ADMINISTRATOR":
      return {
        role: user.role,
        page: await listVeterinarians(params, {}, requestContext),
      };
    case "VETERINARIAN": {
      const day = bogotaToday();
      return {
        role: user.role,
        day,
        page: await listAssignedAppointmentsForDay(
          { ...params, day },
          {},
          requestContext,
        ),
      };
    }
  }
}
