import * as SecureStore from "expo-secure-store";
import {
  LEGACY_ACCESS_TOKEN_KEY,
  SESSION_STORAGE_KEY,
  type SessionStorageAdapter,
} from "./storage-types";

export function createSessionStorage(): SessionStorageAdapter {
  let invalidated = false;
  return {
    async read() {
      if (invalidated) return null;
      const serialized = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
      if (serialized !== null) return serialized;
      return (await SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY)) !== null
        ? "legacy-token"
        : null;
    },
    async write(serialized) {
      invalidated = true;
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, serialized);
      await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
      invalidated = false;
    },
    async clear() {
      invalidated = true;
      const results = await Promise.allSettled([
        SecureStore.deleteItemAsync(SESSION_STORAGE_KEY),
        SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        throw new Error(
          "El acceso local terminó, pero no pudimos borrar la sesión del almacenamiento seguro.",
        );
      }
    },
  };
}
