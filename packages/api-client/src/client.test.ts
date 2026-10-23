/// <reference types="node" />
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  ApiError,
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import { login, logout } from "./auth.api";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
let handler: (request: IncomingMessage, response: ServerResponse) => void;
const server = createServer((request, response) => handler(request, response));
let baseUrl: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("API client over actual local HTTP", () => {
  it.each([200, 401])(
    "discards an old %s response before it can affect the new account",
    async (status) => {
      const arrived = deferred<ServerResponse>();
      handler = (_request, response) => arrived.resolve(response);
      let current: ApiRequestContext = { token: "fictional-A", generation: 1 };
      const unauthorized = vi.fn();
      configureApiClient({
        baseUrl,
        getRequestContext: () => current,
        isRequestContextCurrent: (context) =>
          context.generation === current.generation &&
          context.token === current.token,
        onUnauthorized: unauthorized,
      });
      const result = apiRequest("/pets").catch((error: unknown) => error);
      const response = await arrived.promise;
      current = { token: "fictional-B", generation: 2 };
      response.writeHead(status, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ items: ["private-A"], errorCode: "INVALID_TOKEN" }),
      );
      expect(await result).toBeInstanceOf(StaleSessionRequestError);
      expect(unauthorized).not.toHaveBeenCalled();
    },
  );
  it("discards a response whose headers arrived before switching but whose body arrived after", async () => {
    const arrived = deferred<ServerResponse>();
    handler = (_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.flushHeaders();
      arrived.resolve(response);
    };
    let generation = 1;
    configureApiClient({
      baseUrl,
      getRequestContext: () => ({ token: "fictional", generation }),
      isRequestContextCurrent: (context) => context.generation === generation,
    });
    const result = apiRequest("/pets").catch((error: unknown) => error);
    const response = await arrived.promise;
    await new Promise((resolve) => setTimeout(resolve, 20));
    generation++;
    response.end(JSON.stringify({ items: ["previous-account"] }));
    expect(await result).toBeInstanceOf(StaleSessionRequestError);
  });
  it("deduplicates simultaneous current 401 handling without swallowing the API failure", async () => {
    handler = (_request, response) => {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ errorCode: "INVALID_TOKEN" }));
    };
    const release = deferred<void>();
    const unauthorized = vi.fn(() => release.promise);
    configureApiClient({
      baseUrl,
      getRequestContext: () => ({ token: "fictional", generation: 1 }),
      isRequestContextCurrent: () => true,
      onUnauthorized: unauthorized,
    });
    const requests = [apiRequest("/pets"), apiRequest("/appointments")].map(
      (request) => request.catch((error: unknown) => error),
    );
    await vi.waitFor(() => expect(unauthorized).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 30));
    release.resolve();
    const failures = await Promise.all(requests);
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(
      failures.every(
        (error) => error instanceof ApiError && error.status === 401,
      ),
    ).toBe(true);
  });
  it("revokes the explicit previous token even when the new session is already active", async () => {
    const requests: { path: string; authorization: string | undefined }[] = [];
    handler = (request, response) => {
      requests.push({
        path: request.url!,
        authorization: request.headers.authorization,
      });
      response.writeHead(204);
      response.end();
    };
    const current = { token: "fictional-B", generation: 2 };
    configureApiClient({
      baseUrl,
      getRequestContext: () => current,
      isRequestContextCurrent: (context) =>
        context.generation === current.generation,
    });
    const previous = new AbortController();
    previous.abort();
    await logout({
      token: "fictional-A",
      generation: 1,
      signal: previous.signal,
    });
    expect(requests).toEqual([
      {
        path: "/api/v1/auth/sessions/current",
        authorization: "Bearer fictional-A",
      },
    ]);
  });
  it("does not attach a previous token to the public login", async () => {
    let authorization: string | undefined;
    handler = (request, response) => {
      authorization = request.headers.authorization;
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ errorCode: "INVALID_CREDENTIALS" }));
    };
    const unauthorized = vi.fn();
    configureApiClient({
      baseUrl,
      getRequestContext: () => ({ token: "fictional-old", generation: 1 }),
      isRequestContextCurrent: () => true,
      onUnauthorized: unauthorized,
    });
    await expect(
      login({ email: "test@example.test", password: "fictional" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(authorization).toBeUndefined();
    expect(unauthorized).not.toHaveBeenCalled();
  });
  it("combines module cancellation with generation cancellation", async () => {
    const arrived = deferred<void>();
    handler = () => arrived.resolve();
    const session = new AbortController();
    const screen = new AbortController();
    let generation = 1;
    configureApiClient({
      baseUrl,
      getRequestContext: () => ({
        token: "fictional",
        generation,
        signal: session.signal,
      }),
      isRequestContextCurrent: (context) => context.generation === generation,
    });
    const result = apiRequest("/pets", { signal: screen.signal }).catch(
      (error: unknown) => error,
    );
    await arrived.promise;
    generation++;
    session.abort();
    expect(await result).toBeInstanceOf(StaleSessionRequestError);
  });
});
