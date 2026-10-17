import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  configureApiClient,
  getProfile as apiGetProfile,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  type LoginInput,
  type RegisterInput,
} from "@grownupsvet/api-client";
import { API_BASE_URL } from "../config";
import { clearAccessToken, getAccessToken, saveAccessToken } from "./session";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "./auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<
    string | null
  >(null);

  const handleUnauthorized = useCallback(async () => {
    let message = "Tu sesión terminó. Ingresa de nuevo.";
    try {
      await clearAccessToken();
    } catch {
      message +=
        " No pudimos borrar la sesión guardada; si el problema continúa, reinicia la aplicación.";
    }
    setUser(null);
    setStatus("signedOut");
    setInitializationError(null);
    setSessionExpiredMessage(message);
  }, []);

  // Configure the client as a side effect, not during render. `handleUnauthorized`
  // is stable, so this runs once per mount; running it in the component body
  // would mutate a module-level singleton on every render (twice under
  // StrictMode). It is declared before the session check so the client is ready
  // when `checkSession` runs.
  useEffect(() => {
    configureApiClient({
      baseUrl: API_BASE_URL,
      getAccessToken: async () => (await getAccessToken()) ?? undefined,
      onUnauthorized: handleUnauthorized,
    });
  }, [handleUnauthorized]);

  const checkSession = useCallback(async () => {
    setStatus("checking");
    setInitializationError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        setStatus("signedOut");
        return;
      }

      const profile = await apiGetProfile();
      setUser(profile);
      setStatus("signedIn");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return;
      }
      setUser(null);
      setStatus("signedOut");
      setInitializationError(
        "No pudimos validar tu sesión guardada. Revisa tu conexión e intenta de nuevo.",
      );
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await apiLogin(input);
    await saveAccessToken(response.accessToken);
    setUser(response.user);
    setStatus("signedIn");
    setSessionExpiredMessage(null);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    await apiRegister(input);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      try {
        await clearAccessToken();
      } finally {
        setUser(null);
        setStatus("signedOut");
        setSessionExpiredMessage(null);
      }
    }
  }, []);

  const clearSessionMessage = useCallback(
    () => setSessionExpiredMessage(null),
    [],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      initializationError,
      sessionExpiredMessage,
      clearSessionExpiredMessage: clearSessionMessage,
      retrySessionCheck: () => void checkSession(),
      login,
      register,
      logout,
    }),
    [
      status,
      user,
      initializationError,
      sessionExpiredMessage,
      clearSessionMessage,
      checkSession,
      login,
      register,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
