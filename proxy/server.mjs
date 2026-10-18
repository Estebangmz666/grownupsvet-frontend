#!/usr/bin/env node
/**
 * Gateway de mismo origen (preview y autoalojado).
 *
 *   npm run web:build   # genera dist/
 *   npm run web:serve   # sirve dist/ y hace de proxy de /api/*
 *
 * Variables:
 *   PORT             puerto de escucha (8081)
 *   UPSTREAM         origen del backend (DEFAULT_UPSTREAM de policy.mjs)
 *   STATIC_DIR       carpeta con la exportación web (dist)
 *   PROXY_IP         IP de salida del proxy, opcional, para X-Forwarded-For
 *   PWA_CSP          CSP completo (por defecto solo frame-ancestors)
 *   PWA_DEV_ORIGINS  lista opt-in, p. ej. http://localhost:8081
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_UPSTREAM,
  MAX_BODY_BYTES,
  allowedDevOrigin,
  buildRequestHeaders,
  isApiPath,
  parseOriginList,
  preflightHeaders,
  responseHeaders,
  safeStaticPath,
  shouldServeIndex,
} from "./policy.mjs";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const PORT = Number(process.env.PORT ?? 8081);
const HOST = process.env.HOST ?? "0.0.0.0";
const UPSTREAM = new URL(process.env.UPSTREAM ?? DEFAULT_UPSTREAM);
const STATIC_DIR = resolve(
  process.env.STATIC_DIR ?? join(REPOSITORY_ROOT, "dist"),
);
const PROXY_IP = process.env.PROXY_IP ?? "";
const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 30_000);
const DEV_ORIGINS = parseOriginList(process.env.PWA_DEV_ORIGINS);
const CSP = process.env.PWA_CSP ?? "frame-ancestors 'none'";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  // `fetch` ya descomprime: si se reenviara `content-encoding` el cliente
  // recibiría 0 bytes interpretando datos descomprimidos como comprimidos.
  "content-encoding",
  "content-length",
]);

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload, allowOrigin) {
  send(
    res,
    status,
    {
      ...responseHeaders({ isApi: true, csp: CSP, allowOrigin }),
      "content-type": "application/json; charset=utf-8",
    },
    JSON.stringify(payload),
  );
}

/** Lee el cuerpo aplicando el límite del backend. */
function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", rejectPromise);
  });
}

function clientAddress(req) {
  const remote = req.socket?.remoteAddress ?? "";
  return remote.startsWith("::ffff:") ? remote.slice(7) : remote;
}

async function proxyApi(req, res, allowOrigin) {
  const target = new URL(req.url ?? "/", UPSTREAM);
  const started = Date.now();

  // Se rechaza antes de leer el cuerpo para no subir gigabytes a la memoria.
  const declaredLength = Number(req.headers["content-length"] ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    sendJson(
      res,
      413,
      { title: "Cuerpo demasiado grande", detail: "Máximo 6 MB." },
      allowOrigin,
    );
    return;
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const buffer = await readBody(req);
      body = buffer.length > 0 ? buffer : undefined;
    } catch (error) {
      if (error?.message === "PAYLOAD_TOO_LARGE") {
        sendJson(
          res,
          413,
          { title: "Cuerpo demasiado grande", detail: "Máximo 6 MB." },
          allowOrigin,
        );
        return;
      }
      throw error;
    }
  }

  const headers = buildRequestHeaders(Object.entries(req.headers), {
    upstreamHost: UPSTREAM.host,
    clientIp: clientAddress(req),
    proxyIp: PROXY_IP,
  });

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const responseHeaderEntries = {};
  upstream.headers.forEach((value, name) => {
    if (HOP_BY_HOP.has(name.toLowerCase())) return;
    responseHeaderEntries[name] = value;
  });

  const payload = Buffer.from(await upstream.arrayBuffer());
  send(
    res,
    upstream.status,
    {
      ...responseHeaderEntries,
      ...responseHeaders({
        isApi: true,
        csp: CSP,
        allowOrigin,
      }),
    },
    payload,
  );
  console.log(
    `${req.method} ${req.url} -> ${upstream.status} (${Date.now() - started}ms)`,
  );
}

function serveStatic(req, res, pathname, allowOrigin) {
  let filePath = safeStaticPath(STATIC_DIR, pathname);

  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    const headers = {
      ...responseHeaders({ isApi: false, csp: CSP, allowOrigin }),
      "content-type":
        MIME_TYPES[extname(filePath).toLowerCase()] ??
        "application/octet-stream",
    };
    if (
      pathname === "/" ||
      [
        "/index.html",
        "/sw.js",
        "/manifest.webmanifest",
        "/pwa-register.js",
        "/pwa-precache.json",
        "/pwa/policy.mjs",
      ].includes(pathname)
    ) {
      headers["cache-control"] = "no-cache";
    } else if (pathname.startsWith("/_expo/static/")) {
      // Los assets de Expo llevan hash en el nombre: se pueden cachear mucho.
      headers["cache-control"] = "public, max-age=31536000, immutable";
    } else {
      headers["cache-control"] = "public, max-age=86400";
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
    return;
  }

  if (shouldServeIndex(pathname)) {
    const index = safeStaticPath(STATIC_DIR, "/index.html");
    if (index && existsSync(index)) {
      res.writeHead(200, {
        ...responseHeaders({ isApi: false, csp: CSP, allowOrigin }),
        "content-type": MIME_TYPES[".html"],
        "cache-control": "no-cache",
      });
      createReadStream(index).pipe(res);
      return;
    }
  }

  send(
    res,
    404,
    {
      ...responseHeaders({ isApi: false, csp: CSP, allowOrigin }),
      "content-type": "text/plain; charset=utf-8",
    },
    filePath ? "Recurso no encontrado." : "Ruta no válida.",
  );
}

function handler(req, res) {
  const allowOrigin = allowedDevOrigin(req.headers.origin, DEV_ORIGINS);
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (isApiPath(url.pathname)) {
    if (req.method === "OPTIONS") {
      if (!allowOrigin) {
        send(res, 204, responseHeaders({ isApi: true, csp: CSP }), "");
        return;
      }
      send(res, 204, preflightHeaders(allowOrigin), "");
      return;
    }

    proxyApi(req, res, allowOrigin).catch((error) => {
      const timedOut =
        error?.name === "TimeoutError" || error?.name === "AbortError";
      console.error(`proxy error: ${error?.message ?? error}`);
      if (!res.headersSent) {
        sendJson(
          res,
          timedOut ? 504 : 502,
          {
            title: timedOut
              ? "El servicio no respondió a tiempo"
              : "Servicio no disponible",
            detail: "Intenta de nuevo en unos segundos.",
          },
          allowOrigin,
        );
      }
    });
    return;
  }

  if (!existsSync(STATIC_DIR)) {
    send(
      res,
      500,
      { "content-type": "text/plain; charset=utf-8" },
      `No se encontró "${STATIC_DIR}". Ejecuta: npm run web:build`,
    );
    return;
  }

  serveStatic(req, res, url.pathname, allowOrigin);
}

// Con `Expect: 100-continue` Node responde 100 automáticamente y el cuerpo ya
// empieza a viajar; capturando `checkContinue` se puede rechazar 413 antes.
function onRequest(req, res) {
  const expect = String(req.headers.expect ?? "").toLowerCase();
  if (expect === "100-continue") {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const declaredLength = Number(req.headers["content-length"] ?? "0");
    if (isApiPath(url.pathname) && declaredLength > MAX_BODY_BYTES) {
      sendJson(res, 413, {
        title: "Cuerpo demasiado grande",
        detail: "Máximo 6 MB.",
      });
      return;
    }
    req.emit("continue");
  }
  handler(req, res);
}

if (!existsSync(STATIC_DIR)) {
  console.warn(
    `[gateway] Aviso: no existe ${STATIC_DIR}. Ejecuta "npm run web:build" antes de servir.`,
  );
}

const server = createServer();
server.on("request", handler);
server.on("checkContinue", onRequest);
server.listen(PORT, HOST, () => {
  console.log(`[gateway] http://localhost:${PORT}`);
  console.log(`[gateway] estáticos: ${STATIC_DIR}`);
  console.log(`[gateway] API -> ${UPSTREAM.origin}${UPSTREAM.pathname}`);
  console.log(
    `[gateway] CORS opt-in (dev): ${DEV_ORIGINS.join(", ") || "ninguno"}`,
  );
});
