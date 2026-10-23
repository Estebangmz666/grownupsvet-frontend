/// <reference types="node" />
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ApiError,
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import { uploadProfilePhoto } from "./profile.api";

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

const photo = {
  uri: "data:image/jpeg;base64,/9j/2Q==",
  name: "profile-photo.jpg",
  type: "image/jpeg",
  blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
    type: "image/jpeg",
  }),
};

describe("profile photo multipart over real local HTTP", () => {
  it("sends a binary file part with its filename, MIME type and captured session", async () => {
    let received!: {
      method: string;
      path: string;
      authorization: string;
      file: File;
    };
    handler = (request, response) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const form = await new Response(Buffer.concat(chunks), {
          headers: { "content-type": request.headers["content-type"]! },
        }).formData();
        received = {
          method: request.method!,
          path: request.url!,
          authorization: request.headers.authorization!,
          file: (form as unknown as { get(name: string): File }).get("file"),
        };
        response.writeHead(204);
        response.end();
      })().catch(() => {
        response.writeHead(500);
        response.end();
      });
    };
    const context = { token: "fictional-photo-A", generation: 1 };
    configureApiClient({
      baseUrl,
      getRequestContext: () => context,
      isRequestContextCurrent: () => true,
    });

    await uploadProfilePhoto(photo, context);

    expect(received.method).toBe("PUT");
    expect(received.path).toBe("/api/v1/users/me/profile/photo");
    expect(received.authorization).toBe("Bearer fictional-photo-A");
    expect(received.file).toBeInstanceOf(File);
    expect(received.file.name).toBe("profile-photo.jpg");
    expect(received.file.type).toBe("image/jpeg");
    expect(new Uint8Array(await received.file.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );
  });

  it.each([
    [413, "PROFILE_PHOTO_TOO_LARGE"],
    [415, "UNSUPPORTED_PROFILE_PHOTO_TYPE"],
  ])("preserves a %s photo error for the UI", async (status, errorCode) => {
    handler = (_request, response) => {
      response.writeHead(status, {
        "content-type": "application/problem+json",
      });
      response.end(JSON.stringify({ status, errorCode, fieldErrors: [] }));
    };
    configureApiClient({ baseUrl, getAccessToken: () => "fictional-photo" });
    await expect(uploadProfilePhoto(photo)).rejects.toMatchObject({
      status,
      errorCode,
    } satisfies Partial<ApiError>);
  });

  it("blocks an upload prepared for A after switching to B before the HTTP request", async () => {
    let requests = 0;
    handler = (_request, response) => {
      requests += 1;
      response.writeHead(204);
      response.end();
    };
    let current: ApiRequestContext = { token: "fictional-A", generation: 1 };
    configureApiClient({
      baseUrl,
      getRequestContext: () => current,
      isRequestContextCurrent: (context) =>
        context.generation === current.generation,
    });
    const beforePicker = current;
    current = { token: "fictional-B", generation: 2 };
    await expect(
      uploadProfilePhoto(photo, beforePicker),
    ).rejects.toBeInstanceOf(StaleSessionRequestError);
    expect(requests).toBe(0);
  });
});
