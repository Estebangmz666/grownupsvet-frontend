/**
 * Política del gateway de mismo origen, compartida por el servidor Node
 * (preview/desarrollo) y por el worker de Cloudflare Pages.
 *
 * Por qué existe: el backend rechaza con 403 toda petición de navegador cuyo
 * cabecero `Origin` no esté en la lista permitida. Servir la PWA y el proxy
 * desde un mismo origen hace que el navegador nunca realice una petición
 * cross-origin, por lo que el navegador no envía `Origin` cross-site, no hay
 * preflight y las reglas CORS del backend jamás se evalúan. `CORS_ALLOWED_ORIGINS`
 * puede quedarse vacío.
 *
 * Este módulo no tiene dependencias ni API de Node ni de Cloudflare para que
 * sea testeable puro y utilizable en ambos runtimes.
 */

/** Origen del backend desplegado (solo lectura: el backend no se modifica). */
export const DEFAULT_UPSTREAM =
  "https://grownupsvet-backend-w5glrcsyda-uc.a.run.app";

/** Límites del backend: multipart 5MB por archivo y 6MB por petición. */
export const MAX_BODY_BYTES = 6 * 1024 * 1024;

const API_PREFIXES = ["/api/", "/v3/api-docs"];

/** Rutas que deben reenviarse al backend en lugar de servirse como estáticos. */
export function isApiPath(pathname) {
  return API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Cabeceros que revelan el origen del navegador o que no deben llegar al
 * backend. Quitar `origin`/`referer`/`sec-*` es lo que evita las reglas CORS;
 * quitar `cookie` evita filtrar cookies propias hacia una API que solo usa
 * Bearer; `x-forwarded-for` se reconstruye desde la conexión real para que
 * nadie pueda suplantar su IP (el backend usa `forward-headers-strategy: native`).
 */
export const STRIPPED_REQUEST_HEADERS = new Set([
  "origin",
  "referer",
  "host",
  "cookie",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "sec-fetch-user",
  "upgrade-insecure-requests",
  "x-forwarded-for",
  "x-real-ip",
]);

/**
 * Cabeceros salientes hacia el backend.
 *
 * @param {Iterable<[string, string | string[]]>} entries cabeceros de entrada.
 * @param {{upstreamHost: string, clientIp?: string, proxyIp?: string}} options
 * @returns {Record<string, string>} cabeceros planos listos para `fetch`.
 */
export function buildRequestHeaders(entries, options) {
  const { upstreamHost, clientIp, proxyIp } = options;
  const headers = {};

  for (const [rawName, rawValue] of entries) {
    const name = String(rawName).toLowerCase();
    if (STRIPPED_REQUEST_HEADERS.has(name)) continue;
    const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
    if (typeof value !== "string" || value.length === 0) continue;
    headers[name] = value;
  }

  headers.host = upstreamHost;
  headers["x-forwarded-proto"] = "https";

  const chain = [clientIp, proxyIp].filter(Boolean);
  if (chain.length > 0) {
    headers["x-forwarded-for"] = chain.join(", ");
  }

  return headers;
}

/**
 * Cabeceros de respuesta. En la API se fuerza `no-store` para que ningún
 * navegador ni proxy guarde datos clínicos.
 */
export function responseHeaders({ isApi, csp, allowOrigin }) {
  const headers = {};

  if (isApi) {
    headers["cache-control"] = "no-store";
    headers.pragma = "no-cache";
  }

  headers["x-content-type-options"] = "nosniff";
  headers["referrer-policy"] = "no-referrer";
  headers["x-frame-options"] = "DENY";
  headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()";
  headers["content-security-policy"] = csp;

  if (allowOrigin) {
    headers["access-control-allow-origin"] = allowOrigin;
  }

  return headers;
}

/**
 * Preflight. Solo se responde si el origen está en la lista opt-in de
 * desarrollo; en producción esa lista está vacía y no se emiten cabeceras CORS.
 */
export function preflightHeaders(allowOrigin) {
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, accept",
    "access-control-allow-credentials": "false",
    "access-control-max-age": "600",
  };
}

/** Último segmento de la ruta; se usa para distinguir archivos de rutas SPA. */
export function pathHasFileExtension(pathname) {
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return lastSegment.includes(".");
}

/** Fallback SPA: rutas sin extensión se resuelven con `index.html`. */
export function shouldServeIndex(pathname) {
  return !isApiPath(pathname) && !pathHasFileExtension(pathname);
}

/**
 * Resuelve un archivo estático sin salir del directorio raíz. Devuelve
 * `undefined` cuando la ruta escapa del root o no es decodificable.
 */
export function safeStaticPath(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split("?")[0]);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0")) return undefined;

  const normalized = decoded.replace(/^\/+/, "");
  const rootResolved = root.replace(/\/+$/, "");
  const candidate = resolvePortable(rootResolved, normalized);

  if (candidate !== rootResolved && !candidate.startsWith(`${rootResolved}/`)) {
    return undefined;
  }
  return candidate;
}

/** `path.resolve` sin importar `node:path`, para mantener el módulo puro. */
function resolvePortable(root, relativePath) {
  const segments = [];
  for (const segment of `${root}/${relativePath}`.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

/**
 * Origen admitido para el CORS opt-in de desarrollo. En producción la lista
 * llega vacía y la función devuelve `undefined`, es decir, cero cabeceras CORS.
 */
export function allowedDevOrigin(origin, devOrigins) {
  if (!origin || !Array.isArray(devOrigins) || devOrigins.length === 0) {
    return undefined;
  }
  return devOrigins.includes(origin) ? origin : undefined;
}

/** Convierte una lista separada por comas en orígenes normalizados. */
export function parseOriginList(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter((item) => item.length > 0);
}
