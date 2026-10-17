// Web-only replacement for `expo-secure-store`, which does not support the web
// platform (only android, ios, tvos and expo-go).
//
// The access token is kept in `sessionStorage`: it survives page reloads within
// the same tab (so a refresh no longer signs the user out) but is dropped when
// the tab closes, which limits how long the unencrypted token lingers. Any
// script running on the page could still read it, so this remains less
// protected than the native keychain/keystore path. If browser storage is
// unavailable (for example, blocked by the browser or a quota error), the token
// falls back to a module-level variable and only lasts for the current page.
const ACCESS_TOKEN_KEY = "grownupsvet.accessToken";

let memoryToken: string | null = null;

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export async function saveAccessToken(token: string): Promise<void> {
  memoryToken = token;
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // The in-memory copy still serves the current page.
  }
}

export async function getAccessToken(): Promise<string | null> {
  const storage = getSessionStorage();
  if (storage) {
    try {
      const stored = storage.getItem(ACCESS_TOKEN_KEY);
      if (stored !== null) return stored;
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return memoryToken;
}

export async function clearAccessToken(): Promise<void> {
  memoryToken = null;
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // The in-memory copy is already cleared.
  }
}
