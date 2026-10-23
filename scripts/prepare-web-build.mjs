import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-register.js",
  "/favicon.ico",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/apple-touch-icon.png",
  "/pwa/policy.mjs",
];
const HEAD_MARKER = "<!-- GROWNUPSVET_PWA_HEAD -->";
const VERSIONED_SUPPORT_URLS = ["/404.html", "/_worker.js", "/policy.mjs"];

export function collectPrecacheUrls(html) {
  const urls = new Set(PRECACHE_URLS);
  const localAssetPattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(localAssetPattern)) {
    const url = new URL(match[1], "https://grownupsvet.invalid");
    if (
      url.origin === "https://grownupsvet.invalid" &&
      url.pathname.startsWith("/_expo/static/") &&
      !url.search
    ) {
      urls.add(url.pathname);
    }
  }

  return [...urls].sort();
}

function addPwaHead(html) {
  if (!/<\/head>/i.test(html)) {
    throw new Error("La exportación web no contiene el cierre de <head>.");
  }
  const normalizedHtml = html
    .replace(/<html\b([^>]*)>/i, (_tag, attributes) => {
      const withoutLang = attributes.replace(/\s+lang=(["']).*?\1/i, "");
      return `<html${withoutLang} lang="es">`;
    })
    .replace(/<title>.*?<\/title>/i, "<title>GrownupsVet</title>");
  if (normalizedHtml.includes(HEAD_MARKER)) return normalizedHtml;

  const additions = `    ${HEAD_MARKER}
    <meta name="theme-color" content="#0878D1" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <script src="/pwa-register.js" defer></script>
`;

  return normalizedHtml.replace(/<\/head>/i, `${additions}  </head>`);
}

async function copyPwaAssets(outputDirectory) {
  await mkdir(join(outputDirectory, "pwa"), { recursive: true });
  const files = [
    ["pwa/404.html", "404.html"],
    ["pwa/manifest.webmanifest", "manifest.webmanifest"],
    ["pwa/register.js", "pwa-register.js"],
    ["pwa/policy.mjs", "pwa/policy.mjs"],
    ["assets/pwa-icon-192.png", "pwa-icon-192.png"],
    ["assets/pwa-icon-512.png", "pwa-icon-512.png"],
    ["assets/apple-touch-icon.png", "apple-touch-icon.png"],
    ["proxy/policy.mjs", "policy.mjs"],
    ["proxy/worker.mjs", "_worker.js"],
  ];

  await Promise.all(
    files.map(([source, destination]) =>
      copyFile(join(ROOT, source), join(outputDirectory, destination)),
    ),
  );
}

export async function validateWebBuildArtifacts(outputDirectory, precacheUrls) {
  const requiredUrls = new Set([
    ...precacheUrls,
    "/index.html",
    "/404.html",
    "/sw.js",
    "/_worker.js",
    "/policy.mjs",
  ]);
  const invalidArtifacts = [];

  await Promise.all(
    [...requiredUrls].map(async (resourceUrl) => {
      const relativePath =
        resourceUrl === "/" ? "index.html" : resourceUrl.slice(1);
      try {
        const artifact = await stat(join(outputDirectory, relativePath));
        if (!artifact.isFile() || artifact.size === 0) {
          invalidArtifacts.push(resourceUrl);
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        invalidArtifacts.push(resourceUrl);
      }
    }),
  );

  if (invalidArtifacts.length > 0) {
    throw new Error(
      `La compilación web está incompleta. Faltan archivos o están vacíos: ${invalidArtifacts.sort().join(", ")}`,
    );
  }
}

/** Hash final public bytes, never generated sw.js itself or private responses. */
export async function createPwaCacheVersion(
  outputDirectory,
  precacheUrls,
  workerTemplate,
) {
  const urls = [
    ...new Set([...precacheUrls, ...VERSIONED_SUPPORT_URLS]),
  ].sort();
  const publicPaths = new Set([...PRECACHE_URLS, ...VERSIONED_SUPPORT_URLS]);
  const resources = await Promise.all(
    urls.map(async (resourceUrl) => {
      const url = new URL(resourceUrl, "https://grownupsvet.invalid");
      if (
        url.origin !== "https://grownupsvet.invalid" ||
        url.search ||
        url.hash ||
        (!publicPaths.has(url.pathname) &&
          !url.pathname.startsWith("/_expo/static/"))
      ) {
        throw new Error(
          "El versionado PWA solo admite recursos estáticos públicos.",
        );
      }
      const relativePath =
        url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      let bytes;
      try {
        bytes = await readFile(join(outputDirectory, relativePath));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        throw new Error(`Falta el recurso público requerido: ${url.pathname}`, {
          cause: error,
        });
      }
      return [resourceUrl, createHash("sha256").update(bytes).digest("hex")];
    }),
  );
  return createHash("sha256")
    .update(JSON.stringify({ workerTemplate, resources }))
    .digest("hex")
    .slice(0, 16);
}

export async function prepareWebBuild(outputDirectory = join(ROOT, "dist")) {
  const destination = resolve(outputDirectory);
  const htmlPath = join(destination, "index.html");
  const workerPath = join(destination, "sw.js");
  const html = await readFile(htmlPath, "utf8");
  const urls = collectPrecacheUrls(html);
  const workerTemplate = await readFile(join(ROOT, "pwa/sw.js"), "utf8");
  await copyPwaAssets(destination);
  await writeFile(htmlPath, addPwaHead(html));
  const version = await createPwaCacheVersion(
    destination,
    urls,
    workerTemplate,
  );
  await writeFile(
    join(destination, "pwa-precache.json"),
    `${JSON.stringify(urls, null, 2)}\n`,
  );
  await writeFile(
    workerPath,
    workerTemplate.replace("__PWA_CACHE_VERSION__", version),
  );
  await validateWebBuildArtifacts(destination, urls);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await prepareWebBuild();
}
