import {
  ApiError,
  StaleSessionRequestError,
  type ApiRequestContext,
  type AuthenticatedUser,
  type LoginInput,
  type LoginResponse,
  type RegisterInput,
} from "@grownupsvet/api-client";
import {
  createAuthenticatedSessionSnapshot,
  parseAuthenticatedSessionSnapshot,
  SessionValidationError,
  type AuthenticatedSessionSnapshot,
} from "./session-snapshot";
import type { SessionStorageAdapter } from "./storage-types";

export type AuthenticationStatus =
  "checking" | "signedOut" | "signedIn" | "verificationFailed";
export interface AuthenticationState {
  status: AuthenticationStatus;
  session: AuthenticatedSessionSnapshot | null;
  user: AuthenticatedUser | null;
  generation: number;
  initialSessionData: unknown | null;
  initializationError: string | null;
  sessionExpiredMessage: string | null;
  storageWarning: string | null;
  logoutWarning: string | null;
}
export type InitialSessionLoader = (
  snapshot: AuthenticatedSessionSnapshot,
  context: ApiRequestContext,
) => Promise<unknown>;
export interface AuthenticationControllerDependencies {
  storage: SessionStorageAdapter;
  login: (
    input: LoginInput,
    context: ApiRequestContext,
  ) => Promise<LoginResponse>;
  register: (
    input: RegisterInput,
    context: ApiRequestContext,
  ) => Promise<unknown>;
  logout: (context: ApiRequestContext) => Promise<void>;
  loadInitialSession: InitialSessionLoader;
  now?: () => number;
}

/** Owns session transitions independently from React so races can be tested directly. */
export class AuthenticationSessionController {
  private state: AuthenticationState = {
    status: "checking",
    session: null,
    user: null,
    generation: 0,
    initialSessionData: null,
    initializationError: null,
    sessionExpiredMessage: null,
    storageWarning: null,
    logoutWarning: null,
  };
  private active = false;
  private generation = 0;
  private operation = new AbortController();
  private storageQueue: Promise<void> = Promise.resolve();
  private storageNeedsClearing = false;
  private listeners = new Set<() => void>();
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly now: () => number;

  constructor(
    private readonly dependencies: AuthenticationControllerDependencies,
  ) {
    this.now = dependencies.now ?? Date.now;
  }
  getState = (): AuthenticationState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getRequestContext = (): ApiRequestContext => ({
    token: this.state.session?.accessToken,
    generation: this.generation,
    signal: this.operation.signal,
  });
  isRequestContextCurrent = (context: ApiRequestContext): boolean =>
    this.active &&
    context.generation === this.generation &&
    context.token === this.state.session?.accessToken;
  start = (): void => {
    this.active = true;
    void this.restore();
  };
  stop = (): void => {
    this.active = false;
    this.generation++;
    this.operation.abort();
    clearTimeout(this.expiryTimer);
  };
  private publish(updates: Partial<AuthenticationState>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...updates, generation: this.generation };
    for (const listener of this.listeners) listener();
    this.scheduleExpiry();
  }
  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    if (!this.active || !this.state.session) return;
    const context = this.getRequestContext();
    const remaining = this.state.session.expiresAt - this.now();
    this.expiryTimer = setTimeout(
      () => {
        if (!this.isRequestContextCurrent(context)) return;
        if ((this.state.session?.expiresAt ?? 0) <= this.now())
          void this.handleUnauthorized(context);
        else this.scheduleExpiry();
      },
      Math.max(0, Math.min(remaining, 2_147_483_647)),
    );
  }
  private begin(status: AuthenticationStatus): number {
    this.operation.abort();
    this.operation = new AbortController();
    this.generation++;
    this.publish({
      status,
      session: null,
      user: null,
      initialSessionData: null,
      initializationError: null,
      sessionExpiredMessage: null,
      storageWarning: null,
      logoutWarning: null,
    });
    return this.generation;
  }
  private isCurrent(generation: number): boolean {
    return this.active && generation === this.generation;
  }
  /** An in-flight deletion always finishes before a later session can be saved. */
  private mutateStorage(
    generation: number,
    action: () => Promise<void>,
  ): Promise<boolean> {
    const result = this.storageQueue.then(async () => {
      if (!this.isCurrent(generation)) return false;
      await action();
      return this.isCurrent(generation);
    });
    this.storageQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  private async clearStorage(generation: number): Promise<string | null> {
    this.storageNeedsClearing = true;
    try {
      const cleared = await this.mutateStorage(generation, () =>
        this.dependencies.storage.clear(),
      );
      if (cleared) this.storageNeedsClearing = false;
      return null;
    } catch {
      return (
        this.dependencies.storage.getWarning?.() ??
        "El acceso local terminó, pero no pudimos confirmar el borrado de la sesión guardada."
      );
    }
  }
  private async restore(): Promise<void> {
    const generation = this.begin("checking");
    let snapshot: AuthenticatedSessionSnapshot;
    try {
      await this.storageQueue;
      if (!this.isCurrent(generation)) return;
      const serialized = await this.dependencies.storage.read();
      if (!this.isCurrent(generation)) return;
      if (!serialized) {
        this.publish({
          status: "signedOut",
          storageWarning: this.dependencies.storage.getWarning?.() ?? null,
        });
        return;
      }
      snapshot = parseAuthenticatedSessionSnapshot(serialized, this.now());
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      if (error instanceof SessionValidationError) {
        const warning = await this.clearStorage(generation);
        if (this.isCurrent(generation))
          this.publish({
            status: "signedOut",
            sessionExpiredMessage: error.message,
            storageWarning: warning,
          });
      } else
        this.publish({
          status: "verificationFailed",
          initializationError:
            "No pudimos leer tu sesión guardada. Intenta de nuevo o sal para ingresar otra vez.",
        });
      return;
    }
    if (!this.isCurrent(generation)) return;
    this.publish({ session: snapshot, user: snapshot.user });
    const context = this.getRequestContext();
    try {
      const initialSessionData = await this.dependencies.loadInitialSession(
        snapshot,
        context,
      );
      if (!this.isRequestContextCurrent(context)) return;
      this.publish({
        status: "signedIn",
        initialSessionData,
        storageWarning: this.dependencies.storage.getWarning?.() ?? null,
      });
    } catch (error) {
      if (!this.isRequestContextCurrent(context)) return;
      if (error instanceof ApiError && error.status === 401) {
        await this.handleUnauthorized(context);
        return;
      }
      this.publish({
        status: "verificationFailed",
        initializationError:
          error instanceof ApiError && error.status === 403
            ? "Esta cuenta no tiene permiso para abrir su área. Puedes reintentar o cerrar la sesión."
            : "No pudimos comprobar tu sesión con el servidor. Revisa tu conexión e intenta de nuevo.",
      });
    }
  }
  retrySessionCheck = (): void => {
    void this.restore();
  };
  login = async (input: LoginInput): Promise<void> => {
    const generation = this.begin("signedOut");
    const context = this.getRequestContext();
    try {
      // A newer login must finish an invalidation skipped by an older generation,
      // even if its own credential request later fails.
      if (this.storageNeedsClearing) {
        const storageWarning = await this.clearStorage(generation);
        if (!this.isCurrent(generation)) throw new StaleSessionRequestError();
        this.publish({ storageWarning });
      }
      const response = await this.dependencies.login(input, context);
      if (!this.isCurrent(generation)) throw new StaleSessionRequestError();
      const snapshot = createAuthenticatedSessionSnapshot(response, this.now());
      const saved = await this.mutateStorage(generation, () =>
        this.dependencies.storage.write(JSON.stringify(snapshot)),
      );
      if (!saved || !this.isCurrent(generation))
        throw new StaleSessionRequestError();
      this.publish({
        status: "signedIn",
        session: snapshot,
        user: snapshot.user,
        storageWarning: this.dependencies.storage.getWarning?.() ?? null,
      });
    } catch (error) {
      if (!this.isCurrent(generation)) throw new StaleSessionRequestError();
      throw error;
    }
  };
  register = async (input: RegisterInput): Promise<void> => {
    const context = this.getRequestContext();
    await this.dependencies.register(input, context);
    if (!this.isRequestContextCurrent(context))
      throw new StaleSessionRequestError();
  };
  handleUnauthorized = async (context: ApiRequestContext): Promise<void> => {
    if (!this.isRequestContextCurrent(context)) return;
    const generation = this.begin("signedOut");
    this.publish({
      sessionExpiredMessage: "Tu sesión terminó. Ingresa de nuevo.",
    });
    const warning = await this.clearStorage(generation);
    if (this.isCurrent(generation)) this.publish({ storageWarning: warning });
  };
  logout = async (): Promise<void> => {
    const previousContext = this.getRequestContext();
    const generation = this.begin("signedOut");
    const clearPromise = this.clearStorage(generation).then(
      (storageWarning) => {
        if (this.isCurrent(generation)) this.publish({ storageWarning });
      },
    );
    const revokePromise = (
      previousContext.token
        ? this.dependencies.logout(previousContext).then(
            () => null,
            () =>
              "El acceso local terminó, pero no pudimos confirmar el cierre de esta sesión en el servidor.",
          )
        : Promise.resolve(null)
    ).then((logoutWarning) => {
      if (this.isCurrent(generation)) this.publish({ logoutWarning });
    });
    await Promise.all([clearPromise, revokePromise]);
  };
  clearSessionExpiredMessage = (): void => {
    this.publish({ sessionExpiredMessage: null });
  };
}
