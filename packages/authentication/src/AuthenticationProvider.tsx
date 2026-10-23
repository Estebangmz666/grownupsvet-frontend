import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  configureApiClient,
  login,
  logout,
  register,
} from "@grownupsvet/api-client";
import { AuthenticationContext } from "./authentication-context";
import {
  AuthenticationSessionController,
  type InitialSessionLoader,
} from "./session-controller";
import { createSessionStorage } from "./storage";
export interface AuthenticationProviderProps {
  children: React.ReactNode;
  baseUrl: string;
  loadInitialSession: InitialSessionLoader;
}
export function AuthenticationProvider({
  children,
  baseUrl,
  loadInitialSession,
}: AuthenticationProviderProps) {
  const controller = useMemo(
    () =>
      new AuthenticationSessionController({
        storage: createSessionStorage(),
        login,
        logout,
        register,
        loadInitialSession,
      }),
    [loadInitialSession],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  useEffect(() => {
    configureApiClient({
      baseUrl,
      getRequestContext: controller.getRequestContext,
      isRequestContextCurrent: controller.isRequestContextCurrent,
      onUnauthorized: controller.handleUnauthorized,
    });
    controller.start();
    return controller.stop;
  }, [baseUrl, controller]);
  const value = useMemo(
    () => ({
      ...state,
      retrySessionCheck: controller.retrySessionCheck,
      login: controller.login,
      register: controller.register,
      logout: controller.logout,
      clearSessionExpiredMessage: controller.clearSessionExpiredMessage,
    }),
    [state, controller],
  );
  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
}
