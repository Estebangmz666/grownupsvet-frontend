import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, StaleSessionRequestError } from "@grownupsvet/api-client";
import {
  AuthenticationSessionController,
  type AuthenticationControllerDependencies,
} from "./session-controller";
import { createAuthenticatedSessionSnapshot } from "./session-snapshot";
import {
  deferred,
  loginResponse,
  TEST_NOW,
} from "./test-support/session-fixtures";

const controllers: AuthenticationSessionController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
});
function setup(
  overrides: Partial<AuthenticationControllerDependencies> = {},
  initial: string | null = null,
) {
  let stored = initial;
  const storage = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (value: string) => {
      stored = value;
    }),
    clear: vi.fn(async () => {
      stored = null;
    }),
  };
  const dependencies: AuthenticationControllerDependencies = {
    storage,
    login: vi.fn(async () => loginResponse()),
    register: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    loadInitialSession: vi.fn(async () => ({ items: [] })),
    now: () => TEST_NOW,
    ...overrides,
  };
  const controller = new AuthenticationSessionController(dependencies);
  controllers.push(controller);
  controller.start();
  return { controller, dependencies, storage, stored: () => stored };
}
async function signedOut(controller: AuthenticationSessionController) {
  await vi.waitFor(() =>
    expect(controller.getState().status).toBe("signedOut"),
  );
}

describe("session transitions and isolation", () => {
  it("restores staff with its login permissions and reuses the initial response", async () => {
    const snapshot = createAuthenticatedSessionSnapshot(
      loginResponse("SUPER_ADMIN"),
      TEST_NOW,
    );
    const { controller, dependencies } = setup({}, JSON.stringify(snapshot));
    await vi.waitFor(() =>
      expect(controller.getState().status).toBe("signedIn"),
    );
    expect(controller.getState().user).toEqual(snapshot.user);
    expect(controller.getState().initialSessionData).toEqual({ items: [] });
    expect(dependencies.loadInitialSession).toHaveBeenCalledOnce();
  });
  it("clears legacy storage and requests login without inferring owner permissions", async () => {
    const { controller, storage, dependencies } = setup({}, "legacy-token");
    await signedOut(controller);
    expect(storage.clear).toHaveBeenCalledOnce();
    expect(dependencies.loadInitialSession).not.toHaveBeenCalled();
  });
  it("keeps denied or unavailable restoration unconfirmed and retries without extending expiry", async () => {
    const snapshot = createAuthenticatedSessionSnapshot(
      loginResponse("ADMINISTRATOR"),
      TEST_NOW,
    );
    const loadInitialSession = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ status: 403, errorCode: "FORBIDDEN", fieldErrors: [] }),
      )
      .mockResolvedValue({ items: [] });
    const { controller } = setup(
      { loadInitialSession },
      JSON.stringify(snapshot),
    );
    await vi.waitFor(() =>
      expect(controller.getState().status).toBe("verificationFailed"),
    );
    expect(controller.getState().initialSessionData).toBeNull();
    expect(controller.getState().initializationError).toContain("permiso");
    controller.retrySessionCheck();
    await vi.waitFor(() =>
      expect(controller.getState().status).toBe("signedIn"),
    );
    expect(controller.getState().session?.expiresAt).toBe(snapshot.expiresAt);
  });
  it("an old restore cannot replace a newer login", async () => {
    const pending = deferred<unknown>();
    const snapshot = createAuthenticatedSessionSnapshot(
      loginResponse(),
      TEST_NOW,
    );
    const newer = loginResponse("SUPER_ADMIN", "2");
    const { controller, dependencies } = setup(
      {
        loadInitialSession: vi.fn(() => pending.promise),
        login: vi.fn(async () => newer),
      },
      JSON.stringify(snapshot),
    );
    await vi.waitFor(() =>
      expect(dependencies.loadInitialSession).toHaveBeenCalledOnce(),
    );
    await controller.login({ email: newer.user.email, password: "fictional" });
    pending.resolve({ privateData: "previous-account" });
    await Promise.resolve();
    expect(controller.getState().user).toEqual(newer.user);
    expect(controller.getState().initialSessionData).toBeNull();
  });
  it("a slower login cannot persist after a newer login", async () => {
    const pending = deferred<ReturnType<typeof loginResponse>>();
    const newer = loginResponse("SUPER_ADMIN", "2");
    const login = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce(newer);
    const { controller, stored } = setup({ login });
    await signedOut(controller);
    const oldLogin = controller
      .login({ email: "first@example.test", password: "fictional" })
      .catch((error: unknown) => error);
    await controller.login({ email: newer.user.email, password: "fictional" });
    pending.resolve(loginResponse());
    expect(await oldLogin).toBeInstanceOf(StaleSessionRequestError);
    expect(JSON.parse(stored()!).user).toEqual(newer.user);
  });
  it("serializes old deletion before saving B and revokes only the captured token of A", async () => {
    const clearGate = deferred<void>();
    const revokeGate = deferred<void>();
    const newer = loginResponse("SUPER_ADMIN", "2");
    const { controller, storage, stored, dependencies } = setup({
      logout: vi.fn(() => revokeGate.promise),
      login: vi
        .fn()
        .mockResolvedValueOnce(loginResponse())
        .mockResolvedValueOnce(newer),
    });
    await signedOut(controller);
    await controller.login({
      email: "first@example.test",
      password: "fictional",
    });
    const oldToken = controller.getState().session!.accessToken;
    const originalClear = storage.clear.getMockImplementation()!;
    storage.clear.mockImplementationOnce(async () => {
      await clearGate.promise;
      await originalClear();
    });
    const closing = controller.logout();
    expect(controller.getState().status).toBe("signedOut");
    await vi.waitFor(() => expect(storage.clear).toHaveBeenCalledOnce());
    const newLogin = controller.login({
      email: newer.user.email,
      password: "fictional",
    });
    await Promise.resolve();
    expect(storage.write).toHaveBeenCalledOnce();
    clearGate.resolve();
    await newLogin;
    revokeGate.reject(new Error("offline"));
    await closing;
    expect(dependencies.logout).toHaveBeenCalledWith(
      expect.objectContaining({ token: oldToken }),
    );
    expect(controller.getState().user).toEqual(newer.user);
    expect(controller.getState().logoutWarning).toBeNull();
    expect(JSON.parse(stored()!).user).toEqual(newer.user);
  });
  it("deduplicates current rejection and ignores the previous session rejection", async () => {
    const { controller, storage } = setup();
    await signedOut(controller);
    await controller.login({
      email: "first@example.test",
      password: "fictional",
    });
    const context = controller.getRequestContext();
    await Promise.all([
      controller.handleUnauthorized(context),
      controller.handleUnauthorized(context),
    ]);
    expect(storage.clear).toHaveBeenCalledOnce();
    await controller.login({
      email: "second@example.test",
      password: "fictional",
    });
    await controller.handleUnauthorized(context);
    expect(controller.getState().status).toBe("signedIn");
  });
  it("a failed newer login still clears the old session when it supersedes queued logout cleanup", async () => {
    const { controller, stored, dependencies } = setup();
    await signedOut(controller);
    await controller.login({
      email: "first@example.test",
      password: "fictional",
    });
    vi.mocked(dependencies.login).mockRejectedValueOnce(
      new ApiError({
        status: 401,
        errorCode: "INVALID_CREDENTIALS",
        fieldErrors: [],
      }),
    );
    const closing = controller.logout();
    await expect(
      controller.login({
        email: "second@example.test",
        password: "wrong-fictional",
      }),
    ).rejects.toBeInstanceOf(ApiError);
    await closing;
    expect(stored()).toBeNull();
    expect(controller.getState().status).toBe("signedOut");
  });
  it("a pending old write finishes before the newer account is persisted", async () => {
    const gate = deferred<void>();
    const newer = loginResponse("SUPER_ADMIN", "2");
    const { controller, storage, stored } = setup({
      login: vi
        .fn()
        .mockResolvedValueOnce(loginResponse())
        .mockResolvedValueOnce(newer),
    });
    await signedOut(controller);
    const originalWrite = storage.write.getMockImplementation()!;
    storage.write.mockImplementationOnce(async (serialized) => {
      await gate.promise;
      await originalWrite(serialized);
    });
    const oldLogin = controller
      .login({ email: "first@example.test", password: "fictional" })
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalledOnce());
    const newLogin = controller.login({
      email: newer.user.email,
      password: "fictional",
    });
    gate.resolve();
    expect(await oldLogin).toBeInstanceOf(StaleSessionRequestError);
    await newLogin;
    expect(JSON.parse(stored()!).user).toEqual(newer.user);
  });
  it("survives StrictMode effect cleanup and a new start", async () => {
    const { controller } = setup();
    await signedOut(controller);
    controller.stop();
    controller.start();
    await signedOut(controller);
    await controller.login({
      email: "first@example.test",
      password: "fictional",
    });
    expect(controller.getState().status).toBe("signedIn");
  });
  it("reports failed persistent cleanup and remote revocation honestly", async () => {
    const { controller, storage } = setup({
      logout: vi.fn().mockRejectedValue(new Error("offline")),
    });
    await signedOut(controller);
    await controller.login({
      email: "first@example.test",
      password: "fictional",
    });
    storage.clear.mockRejectedValueOnce(new Error("storage blocked"));
    await controller.logout();
    expect(controller.getState().session).toBeNull();
    expect(controller.getState().storageWarning).toContain("borrado");
    expect(controller.getState().logoutWarning).toContain("servidor");
  });
  it("reports failed local deletion before slow revocation and never changes B when A later finishes", async () => {
    const revocation = deferred<void>();
    const newer = loginResponse("SUPER_ADMIN", "2");
    const { controller, storage } = setup({
      logout: vi.fn(() => revocation.promise),
      login: vi
        .fn()
        .mockResolvedValueOnce(loginResponse())
        .mockResolvedValueOnce(newer),
    });
    await signedOut(controller);
    await controller.login({
      email: "first@example.test",
      password: "fictional",
    });
    storage.clear.mockRejectedValueOnce(new Error("storage blocked"));
    let finished = false;
    const closing = controller.logout().then(() => {
      finished = true;
    });
    await vi.waitFor(() =>
      expect(controller.getState().storageWarning).toContain("borrado"),
    );
    expect(finished).toBe(false);
    expect(controller.getState().status).toBe("signedOut");
    expect(controller.getState().logoutWarning).toBeNull();
    await controller.login({ email: newer.user.email, password: "fictional" });
    const currentState = controller.getState();
    expect(currentState.user).toEqual(newer.user);
    expect(currentState.storageWarning).toBeNull();
    revocation.reject(new Error("remote timed out"));
    await closing;
    expect(controller.getState()).toBe(currentState);
    expect(controller.getState().logoutWarning).toBeNull();
  });
});
