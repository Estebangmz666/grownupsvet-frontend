import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectPrecacheUrls, prepareWebBuild } from "./prepare-web-build.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("preparación de la exportación PWA", () => {
  it("solo precarga el shell y recursos estáticos del bundle", () => {
    const urls = collectPrecacheUrls(`
      <link rel="stylesheet" href="/_expo/static/css/site.css">
      <script src="/_expo/static/js/web/index-hash.js"></script>
      <script src="/api/v1/private.js"></script>
      <script src="https://third-party.example/tracker.js"></script>
    `);

    expect(urls).toContain("/index.html");
    expect(urls).toContain("/_expo/static/css/site.css");
    expect(urls).toContain("/_expo/static/js/web/index-hash.js");
    expect(urls.some((url) => url.startsWith("/api/"))).toBe(false);
    expect(urls.some((url) => url.includes("third-party"))).toBe(false);
  });

  it("inyecta metadatos PWA y prepara el worker y los iconos", async () => {
    const directory = await mkdtemp(join(tmpdir(), "grownupsvet-pwa-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, "index.html"),
      '<!doctype html><html lang="en"><head><title>App</title></head><body><script src="/_expo/static/js/web/main.js"></script></body></html>',
    );

    await prepareWebBuild(directory);

    const html = await readFile(join(directory, "index.html"), "utf8");
    const manifest = JSON.parse(
      await readFile(join(directory, "manifest.webmanifest"), "utf8"),
    );
    const worker = await readFile(join(directory, "sw.js"), "utf8");
    const precache = JSON.parse(
      await readFile(join(directory, "pwa-precache.json"), "utf8"),
    );

    expect(html).toContain('lang="es"');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('src="/pwa-register.js"');
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.map(({ sizes }) => sizes)).toEqual([
      "192x192",
      "512x512",
    ]);
    expect(worker).not.toContain("__PWA_CACHE_VERSION__");
    expect(precache).toContain("/_expo/static/js/web/main.js");
    expect(precache.some((url) => url.startsWith("/api/"))).toBe(false);
  });
});
