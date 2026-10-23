import { createContext } from "react";
import type { LoginInput, RegisterInput } from "@grownupsvet/api-client";
import type { AuthenticationState } from "./session-controller";
export interface AuthenticationContextValue extends AuthenticationState {
  retrySessionCheck: () => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  clearSessionExpiredMessage: () => void;
}
export const AuthenticationContext = createContext<
  AuthenticationContextValue | undefined
>(undefined);
