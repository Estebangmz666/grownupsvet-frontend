import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
  if (html.includes(HEAD_MARKER)) return html;
  if (!/<\/head>/i.test(html)) {
    throw new Error("La exportación web no contiene el cierre de <head>.");
  }

  const additions = `    ${HEAD_MARKER}
    <meta name="theme-color" content="#0878D1" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <script src="/pwa-register.js" defer></script>
`;

  return html
    .replace(/<html\b([^>]*)>/i, (_tag, attributes) => {
      const withoutLang = attributes.replace(/\s+lang=(["']).*?\1/i, "");
      return `<html${withoutLang} lang="es">`;
    })
    .replace(
      /<title>.*?<\/title>/i,
      "<title>GrownupsVet - Propietarios</title>",
    )
    .replace(/<\/head>/i, `${additions}  </head>`);
}

async function copyPwaAssets(outputDirectory) {
  await mkdir(join(outputDirectory, "pwa"), { recursive: true });
  const files = [
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

export async function prepareWebBuild(outputDirectory = join(ROOT, "dist")) {
  const destination = resolve(outputDirectory);
  const htmlPath = join(destination, "index.html");
  const workerPath = join(destination, "sw.js");
  const html = await readFile(htmlPath, "utf8");
  const urls = collectPrecacheUrls(html);
  const workerTemplate = await readFile(join(ROOT, "pwa/sw.js"), "utf8");
  const policy = await readFile(join(ROOT, "pwa/policy.mjs"));
  const version = createHash("sha256")
    .update(html)
    .update(urls.join("\n"))
    .update(workerTemplate)
    .update(policy)
    .digest("hex")
    .slice(0, 16);

  await copyPwaAssets(destination);
  await writeFile(htmlPath, addPwaHead(html));
  await writeFile(
    join(destination, "pwa-precache.json"),
    `${JSON.stringify(urls, null, 2)}\n`,
  );
  await writeFile(
    workerPath,
    workerTemplate.replace("__PWA_CACHE_VERSION__", version),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await prepareWebBuild();
}
