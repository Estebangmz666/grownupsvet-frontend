import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACCESS_TOKEN_KEY = "grownupsvet.accessToken";

function createStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      const value = entries.get(key);
      return value === undefined ? null : value;
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value));
    },
  };
}

function loadSession() {
  return import("./session.web");
}

describe("web session with sessionStorage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves the token to sessionStorage", async () => {
    const session = await loadSession();
    await session.saveAccessToken("token-1");
    expect(storage.getItem(ACCESS_TOKEN_KEY)).toBe("token-1");
  });

  it("reads a token persisted by a previous page load", async () => {
    storage.setItem(ACCESS_TOKEN_KEY, "persisted");
    const session = await loadSession();
    expect(await session.getAccessToken()).toBe("persisted");
  });

  it("clears the token from sessionStorage", async () => {
    storage.setItem(ACCESS_TOKEN_KEY, "token-1");
    const session = await loadSession();
    await session.clearAccessToken();
    expect(storage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await session.getAccessToken()).toBeNull();
  });
});

describe("web session without sessionStorage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to memory when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    const session = await loadSession();
    await session.saveAccessToken("memory-1");
    expect(await session.getAccessToken()).toBe("memory-1");
    await session.clearAccessToken();
    expect(await session.getAccessToken()).toBeNull();
  });

  it("falls back to memory when reading storage throws", async () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new Error("storage blocked");
      },
    });
    const session = await loadSession();
    await session.saveAccessToken("memory-2");
    expect(await session.getAccessToken()).toBe("memory-2");
  });
});
