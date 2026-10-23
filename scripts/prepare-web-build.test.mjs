import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectPrecacheUrls,
  createPwaCacheVersion,
  prepareWebBuild,
  validateWebBuildArtifacts,
} from "./prepare-web-build.mjs";

const temporaryDirectories = [];

async function createPreparedExport() {
  const directory = await mkdtemp(join(tmpdir(), "grownupsvet-pwa-"));
  temporaryDirectories.push(directory);
  await writeFile(
    join(directory, "index.html"),
    '<!doctype html><html lang="en"><head><title>App</title></head><body><script src="/_expo/static/js/web/main.js"></script></body></html>',
  );
  await mkdir(join(directory, "_expo/static/js/web"), { recursive: true });
  await writeFile(join(directory, "_expo/static/js/web/main.js"), "void 0;");
  await writeFile(join(directory, "favicon.ico"), "favicon");
  await prepareWebBuild(directory);
  return {
    directory,
    urls: JSON.parse(
      await readFile(join(directory, "pwa-precache.json"), "utf8"),
    ),
    workerTemplate: await readFile(
      new URL("../pwa/sw.js", import.meta.url),
      "utf8",
    ),
  };
}

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
      <script src="/_expo/static/js/web/private.js?token=private-fixture"></script>
      <link href="/activate-account?token=private-fixture">
      <script src="https://third-party.example/tracker.js"></script>
    `);

    expect(urls).toContain("/index.html");
    expect(urls).toContain("/_expo/static/css/site.css");
    expect(urls).toContain("/_expo/static/js/web/index-hash.js");
    expect(urls.some((url) => url.startsWith("/api/"))).toBe(false);
    expect(urls.some((url) => url.includes("third-party"))).toBe(false);
    expect(
      urls.some((url) => url.includes("token") || url.includes("private")),
    ).toBe(false);
  });

  it("inyecta metadatos PWA y prepara el worker y los iconos", async () => {
    const { directory, urls, workerTemplate } = await createPreparedExport();

    const html = await readFile(join(directory, "index.html"), "utf8");
    const manifest = JSON.parse(
      await readFile(join(directory, "manifest.webmanifest"), "utf8"),
    );
    const worker = await readFile(join(directory, "sw.js"), "utf8");
    const precache = JSON.parse(
      await readFile(join(directory, "pwa-precache.json"), "utf8"),
    );

    expect(html).toContain('lang="es"');
    expect(html).toContain("<title>GrownupsVet</title>");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('src="/pwa-register.js"');
    expect(manifest.start_url).toBe("/");
    expect(manifest.name).toBe("GrownupsVet");
    expect(manifest.description).toContain("personal");
    expect(manifest.icons.map(({ sizes }) => sizes)).toEqual([
      "192x192",
      "512x512",
    ]);
    expect(worker).not.toContain("__PWA_CACHE_VERSION__");
    expect(worker).toContain(
      await createPwaCacheVersion(directory, urls, workerTemplate),
    );
    expect(precache).toContain("/_expo/static/js/web/main.js");
    expect(precache.some((url) => url.startsWith("/api/"))).toBe(false);
    expect(await readFile(join(directory, "_worker.js"), "utf8")).toContain(
      "env.ASSETS.fetch",
    );
    expect(await readFile(join(directory, "policy.mjs"), "utf8")).toContain(
      "DEFAULT_UPSTREAM",
    );
    await expect(validateWebBuildArtifacts(directory, precache)).resolves.toBe(
      undefined,
    );
  });

  it("rechaza una exportación cuyo JavaScript referenciado no existe", async () => {
    const directory = await mkdtemp(join(tmpdir(), "grownupsvet-pwa-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, "index.html"),
      '<html><head><title>App</title></head><body><script src="/_expo/static/js/web/missing.js"></script></body></html>',
    );
    await writeFile(join(directory, "favicon.ico"), "favicon");

    await expect(prepareWebBuild(directory)).rejects.toThrow(
      "/_expo/static/js/web/missing.js",
    );
  });

  it("rechaza archivos vacíos y un Worker ausente antes de publicar", async () => {
    const directory = await mkdtemp(join(tmpdir(), "grownupsvet-pwa-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "index.html"), "");
    await writeFile(join(directory, "sw.js"), "self.addEventListener;");
    await writeFile(join(directory, "policy.mjs"), "export {};");

    await expect(validateWebBuildArtifacts(directory, [])).rejects.toThrow(
      "/_worker.js, /index.html",
    );
  });

  it("mantiene la misma versión al preparar otra vez los mismos recursos", async () => {
    const { directory } = await createPreparedExport();
    const initialWorker = await readFile(join(directory, "sw.js"), "utf8");
    const initialHtml = await readFile(join(directory, "index.html"), "utf8");

    await prepareWebBuild(directory);

    expect(await readFile(join(directory, "sw.js"), "utf8")).toBe(
      initialWorker,
    );
    expect(await readFile(join(directory, "index.html"), "utf8")).toBe(
      initialHtml,
    );
    expect(initialHtml.match(/GROWNUPSVET_PWA_HEAD/g)).toHaveLength(1);
  });

  it("actualiza el título de una exportación anterior sin duplicar metadatos PWA", async () => {
    const { directory } = await createPreparedExport();
    const htmlPath = join(directory, "index.html");
    const html = await readFile(htmlPath, "utf8");
    await writeFile(
      htmlPath,
      html.replace(
        "<title>GrownupsVet</title>",
        "<title>GrownupsVet - Propietarios</title>",
      ),
    );

    await prepareWebBuild(directory);

    const updatedHtml = await readFile(htmlPath, "utf8");
    expect(updatedHtml).toContain("<title>GrownupsVet</title>");
    expect(updatedHtml).not.toContain("Propietarios");
    expect(updatedHtml.match(/GROWNUPSVET_PWA_HEAD/g)).toHaveLength(1);
  });

  it.each([
    "/index.html",
    "/manifest.webmanifest",
    "/pwa-register.js",
    "/favicon.ico",
    "/pwa-icon-192.png",
    "/pwa-icon-512.png",
    "/apple-touch-icon.png",
    "/pwa/policy.mjs",
    "/_expo/static/js/web/main.js",
    "/_worker.js",
    "/policy.mjs",
    "/404.html",
  ])(
    "invalida la caché si cambia solo el contenido de %s, conservando su URL",
    async (resourceUrl) => {
      const { directory, urls, workerTemplate } = await createPreparedExport();
      const before = await createPwaCacheVersion(
        directory,
        urls,
        workerTemplate,
      );

      await appendFile(
        join(directory, resourceUrl.slice(1)),
        "\npublic static update\n",
      );

      expect(
        await createPwaCacheVersion(directory, urls, workerTemplate),
      ).not.toBe(before);
      expect(
        JSON.parse(
          await readFile(join(directory, "pwa-precache.json"), "utf8"),
        ),
      ).toEqual(urls);
    },
  );

  it("invalida la caché si cambia la plantilla del service worker", async () => {
    const { directory, urls, workerTemplate } = await createPreparedExport();
    const before = await createPwaCacheVersion(directory, urls, workerTemplate);
    expect(
      await createPwaCacheVersion(
        directory,
        urls,
        `${workerTemplate}\n// updated worker\n`,
      ),
    ).not.toBe(before);
  });

  it("produce la misma versión para la misma lista pública en otro orden", async () => {
    const { directory, urls, workerTemplate } = await createPreparedExport();
    expect(
      await createPwaCacheVersion(
        directory,
        [...urls].reverse(),
        workerTemplate,
      ),
    ).toBe(
      await createPwaCacheVersion(
        directory,
        [...urls, ...urls],
        workerTemplate,
      ),
    );
  });

  it("no inspecciona ni versiona datos privados ajenos a la precarga", async () => {
    const { directory, urls, workerTemplate } = await createPreparedExport();
    const before = await createPwaCacheVersion(directory, urls, workerTemplate);
    await mkdir(join(directory, "api/v1"), { recursive: true });
    await writeFile(
      join(directory, "api/v1/private.json"),
      '{"fixture":"changed private data"}',
    );
    expect(await createPwaCacheVersion(directory, urls, workerTemplate)).toBe(
      before,
    );
    expect(
      urls.some((url) => url.includes("private") || url.includes("/api/")),
    ).toBe(false);
  });

  it.each([
    "/api/v1/users/me",
    "/activate-account?token=private-fixture",
    "/_expo/static/js/web/main.js?token=private-fixture",
    "https://third-party.example/asset.js",
  ])(
    "rechaza incluir recursos privados o externos en el hash: %s",
    async (resourceUrl) => {
      const { directory, urls, workerTemplate } = await createPreparedExport();
      await expect(
        createPwaCacheVersion(
          directory,
          [...urls, resourceUrl],
          workerTemplate,
        ),
      ).rejects.toThrow("solo admite recursos estáticos públicos");
    },
  );
});
