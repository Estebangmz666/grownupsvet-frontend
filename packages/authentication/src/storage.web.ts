import {
  LEGACY_ACCESS_TOKEN_KEY,
  SESSION_STORAGE_KEY,
  type SessionStorageAdapter,
} from "./storage-types";

/** Never reads a record again in this instance after a failed deletion or write. */
export function createSessionStorage(
  getStorage: () => Storage | null = () =>
    typeof window === "undefined" ? null : window.sessionStorage,
): SessionStorageAdapter {
  let memory: string | null = null;
  let memoryOnly = false;
  let invalidated = false;
  let warning: string | null = null;
  const accessStorage = () => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };
  return {
    async read() {
      if (invalidated || memoryOnly) return memory;
      const storage = accessStorage();
      if (!storage) {
        memoryOnly = true;
        return memory;
      }
      try {
        const serialized = storage.getItem(SESSION_STORAGE_KEY);
        if (serialized !== null) return serialized;
        return storage.getItem(LEGACY_ACCESS_TOKEN_KEY) !== null
          ? "legacy-token"
          : memory;
      } catch {
        memoryOnly = true;
        warning =
          "El navegador no permite recuperar la sesión guardada. La sesión solo durará en esta página.";
        return memory;
      }
    },
    async write(serialized) {
      memory = serialized;
      invalidated = false;
      const storage = accessStorage();
      if (!storage) {
        memoryOnly = true;
        warning =
          "La sesión solo durará en esta página porque el navegador impide guardarla.";
        return;
      }
      try {
        storage.setItem(SESSION_STORAGE_KEY, serialized);
        storage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
        memoryOnly = false;
        warning = null;
      } catch {
        memoryOnly = true;
        warning =
          "La sesión solo durará en esta página; no pudimos actualizar el almacenamiento del navegador.";
      }
    },
    async clear() {
      memory = null;
      invalidated = true;
      const storage = accessStorage();
      if (!storage) {
        warning =
          "El acceso local terminó, pero el navegador no permite confirmar el borrado de la sesión guardada.";
        throw new Error(warning);
      }
      const failures: unknown[] = [];
      for (const key of [SESSION_STORAGE_KEY, LEGACY_ACCESS_TOKEN_KEY]) {
        try {
          storage.removeItem(key);
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length > 0) {
        warning =
          "El acceso local terminó, pero no pudimos borrar toda la sesión guardada del navegador.";
        throw new Error(warning);
      }
      warning = null;
    },
    getWarning: () => warning,
  };
}
