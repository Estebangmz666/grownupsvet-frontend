export const SESSION_STORAGE_KEY = "grownupsvet.authenticatedSession.v1";
export const LEGACY_ACCESS_TOKEN_KEY = "grownupsvet.accessToken";

export interface SessionStorageAdapter {
  read: () => Promise<string | null>;
  write: (serialized: string) => Promise<void>;
  clear: () => Promise<void>;
  getWarning?: () => string | null;
}
