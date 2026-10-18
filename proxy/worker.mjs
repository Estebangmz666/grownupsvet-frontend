/**
 * Gateway de mismo origen para Cloudflare Pages (opción de hosting
 * recomendada). Se despliega como `dist/_worker.js`; Pages enruta todas las
 * peticiones al worker y `env.ASSETS` sirve los estáticos de `dist/`.
 *
 * Despliegue:
 *   npm run web:build
 *   cp proxy/policy.mjs dist/policy.mjs
 *   cp proxy/worker.mjs dist/_worker.js
 *   npx wrangler pages deploy dist --project-name=grownupsvet-pwa
 *
 * Variables (Settings → Variables en Pages):
 *   UPSTREAM         origen del backend (opcional)
 *   PWA_CSP          CSP completo (por defecto solo frame-ancestors)
 *   PWA_DEV_ORIGINS  lista opt-in de orígenes con CORS, vacía en producción
 */
import {
  DEFAULT_UPSTREAM,
  MAX_BODY_BYTES,
  allowedDevOrigin,
  buildRequestHeaders,
  isApiPath,
  parseOriginList,
  preflightHeaders,
  responseHeaders,
  shouldServeIndex,
} from "./policy.mjs";

const TIMEOUT_MS = 30_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const upstream = new URL(env.UPSTREAM ?? DEFAULT_UPSTREAM);
    const csp = env.PWA_CSP ?? "frame-ancestors 'none'";
    const devOrigins = parseOriginList(env.PWA_DEV_ORIGINS);
    const allowOrigin = allowedDevOrigin(
      request.headers.get("origin"),
      devOrigins,
    );

    if (!isApiPath(url.pathname)) {
      let response = await env.ASSETS.fetch(request);
      if (response.status === 404 && shouldServeIndex(url.pathname)) {
        response = await env.ASSETS.fetch(
          new Request(new URL("/index.html", url.origin)),
        );
      }
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(
        responseHeaders({ isApi: false, csp, allowOrigin }),
      )) {
        headers.set(name, value);
      }
      if (
        url.pathname === "/" ||
        [
          "/index.html",
          "/sw.js",
          "/manifest.webmanifest",
          "/pwa-register.js",
          "/pwa-precache.json",
          "/pwa/policy.mjs",
        ].includes(url.pathname)
      ) {
        headers.set("cache-control", "no-cache, max-age=0, must-revalidate");
      }
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    if (request.method === "OPTIONS") {
      if (!allowOrigin) {
        return new Response(null, {
          status: 204,
          headers: responseHeaders({ isApi: true, csp }),
        });
      }
      return new Response(null, {
        status: 204,
        headers: preflightHeaders(allowOrigin),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (declared > MAX_BODY_BYTES) {
        return jsonResponse(
          413,
          { title: "Cuerpo demasiado grande", detail: "Máximo 6 MB." },
          csp,
          allowOrigin,
        );
      }
    }

    const headers = buildRequestHeaders(request.headers.entries(), {
      upstreamHost: upstream.host,
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
    });

    try {
      const upstreamResponse = await fetch(
        new URL(url.pathname + url.search, upstream),
        {
          method: request.method,
          headers,
          body: request.body ?? undefined,
          redirect: "manual",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );

      const responseHeaderEntries = {};
      upstreamResponse.headers.forEach((value, name) => {
        const header = name.toLowerCase();
        if (header === "set-cookie") return;
        // El cuerpo llega descomprimido: no se reenvía la cabecera de codificación.
        if (header === "content-encoding" || header === "content-length")
          return;
        responseHeaderEntries[name] = value;
      });

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          ...responseHeaderEntries,
          ...responseHeaders({ isApi: true, csp, allowOrigin }),
        },
      });
    } catch (error) {
      const timedOut =
        error?.name === "TimeoutError" || error?.name === "AbortError";
      return jsonResponse(
        timedOut ? 504 : 502,
        {
          title: timedOut
            ? "El servicio no respondió a tiempo"
            : "Servicio no disponible",
          detail: "Intenta de nuevo en unos segundos.",
        },
        csp,
        allowOrigin,
      );
    }
  },
};

function jsonResponse(status, payload, csp, allowOrigin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...responseHeaders({ isApi: true, csp, allowOrigin }),
      "content-type": "application/json; charset=utf-8",
    },
  });
}
