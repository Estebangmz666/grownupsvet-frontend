import {
  ApiError,
  apiRequest,
  type ApiRequestContext,
  type UserProfile,
} from "@grownupsvet/api-client";
import type { AuthenticatedSessionSnapshot } from "@grownupsvet/authentication";
import { loadInitialStaffData } from "@administrativo/data/loadInitialStaffData";
import {
  hasUserPermission,
  resolveApplicationArea,
} from "../navigation/roleAccess";

export async function loadInitialSession(
  snapshot: AuthenticatedSessionSnapshot,
  requestContext: ApiRequestContext,
): Promise<unknown> {
  if (!resolveApplicationArea(snapshot.user)) throw accessDenied();
  if (snapshot.user.role === "OWNER") {
    if (!hasUserPermission(snapshot.user, "PROFILE_READ_SELF"))
      throw accessDenied();
    const profile = await apiRequest<UserProfile>(
      "/users/me",
      {},
      requestContext,
    );
    if (
      profile.id !== snapshot.user.id ||
      profile.email !== snapshot.user.email ||
      profile.role !== "OWNER" ||
      profile.active !== true
    ) {
      throw new ApiError({
        status: 401,
        errorCode: "SESSION_IDENTITY_MISMATCH",
        detail:
          "La sesión guardada no coincide con tu cuenta. Inicia sesión de nuevo.",
        fieldErrors: [],
      });
    }
    return { role: "OWNER", profile };
  }
  return loadInitialStaffData(snapshot.user, requestContext);
}
function accessDenied() {
  return new ApiError({
    status: 403,
    errorCode: "ACCESS_DENIED",
    detail: "Tu cuenta no tiene permiso para abrir esta área.",
    fieldErrors: [],
  });
}
