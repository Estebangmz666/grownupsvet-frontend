import { createContext } from "react";
import type {
  AuthenticatedUser,
  LoginInput,
  RegisterInput,
} from "@grownupsvet/api-client";

export type AuthStatus = "checking" | "signedOut" | "signedIn";

export interface AuthContextValue {
  status: AuthStatus;
  user:
    | (Pick<AuthenticatedUser, "id" | "email" | "role"> & {
        permissions?: string[];
        fullName?: string;
      })
    | null;
  initializationError: string | null;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  retrySessionCheck: () => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
