import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let directory;
let server;
let baseUrl;
const html = "<!doctype html><title>Gateway static fixture</title>";

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "grownupsvet-static-"));
  const staticRoot = join(directory, "dist");
  await mkdir(join(staticRoot, "_expo/static/js/web"), { recursive: true });
  await Promise.all([
    writeFile(join(staticRoot, "index.html"), html),
    writeFile(join(staticRoot, "favicon.ico"), new Uint8Array([0, 0, 1, 0])),
    writeFile(
      join(staticRoot, "_expo/static/js/web/index-fixture.js"),
      "window.fixture = true;",
    ),
    writeFile(join(directory, "private.txt"), "outside the static root"),
  ]);
  server = spawn(
    process.execPath,
    [fileURLToPath(new URL("./server.mjs", import.meta.url))],
    {
      env: {
        ...process.env,
        PORT: "0",
        HOST: "127.0.0.1",
        STATIC_DIR: staticRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  await new Promise((accept, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error("The static test server did not start.")),
      10_000,
    );
    const fail = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
    server.once("error", fail);
    server.once("exit", (code) =>
      fail(new Error(`The static test server exited: ${code}`)),
    );
    server.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = /\[gateway\] http:\/\/localhost:(\d+)/.exec(output);
      if (!match) return;
      baseUrl = `http://127.0.0.1:${match[1]}`;
      clearTimeout(timeout);
      accept();
    });
  });
});

afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (directory && dirname(resolve(directory)) === resolve(tmpdir())) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("Node static gateway over actual HTTP", () => {
  it.each(["/", "/index.html", "/citas/123"])(
    "serves the SPA at %s",
    async (pathname) => {
      const response = await fetch(`${baseUrl}${pathname}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(await response.text()).toBe(html);
    },
  );

  it("serves favicon bytes and immutable Expo JavaScript with their MIME types", async () => {
    const icon = await fetch(`${baseUrl}/favicon.ico`);
    expect(icon.status).toBe(200);
    expect(icon.headers.get("content-type")).toBe("image/x-icon");
    expect(new Uint8Array(await icon.arrayBuffer())).toEqual(
      new Uint8Array([0, 0, 1, 0]),
    );
    const script = await fetch(
      `${baseUrl}/_expo/static/js/web/index-fixture.js`,
    );
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("text/javascript");
    expect(script.headers.get("cache-control")).toContain("immutable");
    expect(await script.text()).toBe("window.fixture = true;");
  });

  it("returns 404 for missing files instead of the SPA HTML", async () => {
    const response = await fetch(`${baseUrl}/missing.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Recurso no encontrado.");
  });

  it.each([
    "/%2e%2e%2fprivate.txt",
    "/%2e%2e%2fprivate",
    "/%5c..%5cprivate.txt",
    "/invalid%00",
  ])(
    "rejects %s without exposing files or falling back to the SPA",
    async (pathname) => {
      const response = await fetch(`${baseUrl}${pathname}`);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Ruta no válida.");
    },
  );

  it.each(["/", "/citas/123"])("supports HEAD for %s", async (pathname) => {
    const response = await fetch(`${baseUrl}${pathname}`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe("");
  });
});
