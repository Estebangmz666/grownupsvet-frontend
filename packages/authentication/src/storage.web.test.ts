import { describe, expect, it, vi } from "vitest";
import { createSessionStorage } from "./storage.web";
import { LEGACY_ACCESS_TOKEN_KEY, SESSION_STORAGE_KEY } from "./storage-types";
function fakeStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}
describe("browser session storage", () => {
  it("persists one complete snapshot per tab and removes legacy credentials", async () => {
    const storage = fakeStorage();
    storage.values.set(LEGACY_ACCESS_TOKEN_KEY, "old-token");
    const adapter = createSessionStorage(() => storage as unknown as Storage);
    expect(await adapter.read()).toBe("legacy-token");
    await adapter.write("snapshot");
    expect(await adapter.read()).toBe("snapshot");
    expect(storage.values.has(LEGACY_ACCESS_TOKEN_KEY)).toBe(false);
    await adapter.clear();
    expect(storage.values.has(SESSION_STORAGE_KEY)).toBe(false);
  });
  it("uses memory when access or writes are blocked and exposes the limitation", async () => {
    const adapter = createSessionStorage(() => {
      throw new Error("blocked");
    });
    await adapter.write("snapshot");
    expect(await adapter.read()).toBe("snapshot");
    expect(adapter.getWarning?.()).toContain("página");
    await expect(adapter.clear()).rejects.toThrow();
    expect(await adapter.read()).toBeNull();
  });
  it("never reloads an old persistent record after deletion fails in this instance", async () => {
    const storage = fakeStorage();
    storage.values.set(SESSION_STORAGE_KEY, "old-snapshot");
    storage.removeItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    const adapter = createSessionStorage(() => storage as unknown as Storage);
    await expect(adapter.clear()).rejects.toThrow();
    expect(await adapter.read()).toBeNull();
    expect(adapter.getWarning?.()).toContain("borrar");
  });
});
