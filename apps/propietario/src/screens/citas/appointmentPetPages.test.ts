/// <reference types="node" />
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  configureApiClient,
  type ApiRequestContext,
  type Pet,
} from "@grownupsvet/api-client";
import {
  createAppointmentPetPager,
  emptyAppointmentPetPage,
  type AppointmentPetPageState,
} from "./appointmentPetPages";

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

function pet(id: number): Pet {
  return {
    id: `pet-${id}`,
    name: `Mascota ${id}`,
    species: "DOG",
    breed: null,
    sex: null,
    dateOfBirth: null,
    dateOfBirthEstimated: false,
    active: true,
    createdAt: "2026-10-23T00:00:00Z",
    updatedAt: "2026-10-23T00:00:00Z",
  };
}

function sendPage(response: ServerResponse, page: number, items?: Pet[]) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      items:
        items ??
        Array.from({ length: page === 0 ? 20 : 5 }, (_, index) =>
          pet(page * 20 + index),
        ),
      page,
      size: 20,
      totalElements: 25,
      totalPages: 2,
    }),
  );
}

function setup() {
  let current: ApiRequestContext = { token: "fictional-A", generation: 1 };
  configureApiClient({
    baseUrl,
    getRequestContext: () => current,
    isRequestContextCurrent: (context) =>
      context.generation === current.generation,
  });
  let state = emptyAppointmentPetPage();
  const changes: AppointmentPetPageState[] = [];
  const pager = createAppointmentPetPager((next) => {
    state = next;
    changes.push(next);
  });
  return {
    pager,
    context: current,
    get state() {
      return state;
    },
    changes,
    switchAccount() {
      current = { token: "fictional-B", generation: 2 };
      return current;
    },
  };
}

describe("progressive appointment pet selector over real local HTTP", () => {
  it("loads later pets only when requested and never duplicates the same page", async () => {
    const requests: URL[] = [];
    handler = (request, response) => {
      const url = new URL(request.url!, baseUrl);
      requests.push(url);
      sendPage(response, Number(url.searchParams.get("page")));
    };
    const subject = setup();
    await subject.pager.reset(subject.context);
    expect(subject.state.items).toHaveLength(20);
    expect(subject.state.hasMore).toBe(true);
    await Promise.all([subject.pager.loadMore(), subject.pager.loadMore()]);
    expect(subject.state.items.at(-1)?.id).toBe("pet-24");
    expect(subject.state.items).toHaveLength(25);
    expect(subject.state.hasMore).toBe(false);
    await subject.pager.loadMore();
    expect(requests.map((url) => url.search)).toEqual([
      "?active=true&page=0&size=20",
      "?active=true&page=1&size=20",
    ]);
  });

  it("keeps loaded options after a later-page failure and retries that same page", async () => {
    let fail = true;
    const pages: number[] = [];
    handler = (request, response) => {
      const page = Number(
        new URL(request.url!, baseUrl).searchParams.get("page"),
      );
      pages.push(page);
      if (page === 1 && fail) {
        fail = false;
        response.writeHead(503, { "content-type": "application/problem+json" });
        response.end(
          JSON.stringify({
            errorCode: "TEMPORARILY_UNAVAILABLE",
            fieldErrors: [],
          }),
        );
      } else sendPage(response, page);
    };
    const subject = setup();
    await subject.pager.reset(subject.context);
    await subject.pager.loadMore();
    expect(subject.state.items).toHaveLength(20);
    expect(subject.state.error).toBeTruthy();
    await subject.pager.loadMore();
    expect(subject.state.error).toBeNull();
    expect(subject.state.items).toHaveLength(25);
    expect(pages).toEqual([0, 1, 1]);
  });

  it("does not append a late page after leaving the screen", async () => {
    let release!: ServerResponse;
    let arrived!: () => void;
    const requestArrived = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    handler = (request, response) => {
      const page = Number(
        new URL(request.url!, baseUrl).searchParams.get("page"),
      );
      if (page === 0) sendPage(response, 0);
      else {
        release = response;
        arrived();
      }
    };
    const subject = setup();
    await subject.pager.reset(subject.context);
    const pending = subject.pager.loadMore();
    await requestArrived;
    subject.pager.cancel();
    const count = subject.changes.length;
    sendPage(release, 1);
    await pending;
    expect(subject.changes).toHaveLength(count);
    expect(subject.state.items).toHaveLength(20);
  });

  it("never continues pagination with B's token after opening the selector for A", async () => {
    const tokens: string[] = [];
    handler = (request, response) => {
      tokens.push(request.headers.authorization!);
      sendPage(
        response,
        Number(new URL(request.url!, baseUrl).searchParams.get("page")),
      );
    };
    const subject = setup();
    await subject.pager.reset(subject.context);
    subject.switchAccount();
    await subject.pager.loadMore();
    expect(tokens).toEqual(["Bearer fictional-A"]);
    expect(subject.state.items).toHaveLength(20);
  });
});
