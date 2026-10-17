import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPSTREAM,
  MAX_BODY_BYTES,
  allowedDevOrigin,
  buildRequestHeaders,
  isApiPath,
  parseOriginList,
  pathHasFileExtension,
  preflightHeaders,
  responseHeaders,
  safeStaticPath,
  shouldServeIndex,
} from "./policy.mjs";

describe("enrutado", () => {
  it("envía al backend las rutas de API y el contrato", () => {
    expect(isApiPath("/api/v1/auth/sessions")).toBe(true);
    expect(isApiPath("/api/v1/appointments")).toBe(true);
    expect(isApiPath("/v3/api-docs")).toBe(true);
  });

  it("no trata como API los recursos de la PWA", () => {
    expect(isApiPath("/")).toBe(false);
    expect(isApiPath("/index.html")).toBe(false);
    expect(isApiPath("/_expo/static/js/web/index-abc.js")).toBe(false);
    expect(isApiPath("/apiary")).toBe(false);
  });

  it("resuelve la SPA solo en rutas sin extensión", () => {
    expect(shouldServeIndex("/")).toBe(true);
    expect(shouldServeIndex("/citas/123")).toBe(true);
    expect(shouldServeIndex("/index.html")).toBe(false);
    expect(shouldServeIndex("/favicon.ico")).toBe(false);
    expect(shouldServeIndex("/api/v1/pets")).toBe(false);
    expect(pathHasFileExtension("/_expo/a.js")).toBe(true);
  });
});

describe("cabeceras salientes hacia el backend", () => {
  it("elimina cualquier cabecero que revele el origen del navegador", () => {
    const headers = buildRequestHeaders(
      [
        ["Origin", "http://localhost:8081"],
        ["Referer", "http://localhost:8081/citas"],
        ["Sec-Fetch-Site", "same-origin"],
        ["Sec-Fetch-Mode", "cors"],
        ["Cookie", "analytics=1"],
        ["Authorization", "Bearer token-xyz"],
      ],
      { upstreamHost: UPSTREAM_HOST },
    );

    expect(headers.origin).toBeUndefined();
    expect(headers.referer).toBeUndefined();
    expect(headers["sec-fetch-site"]).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBe("Bearer token-xyz");
  });

  it("fuerza el Host del backend y marca el esquema como https", () => {
    const headers = buildRequestHeaders([["host", "localhost:8081"]], {
      upstreamHost: UPSTREAM_HOST,
    });
    expect(headers.host).toBe(UPSTREAM_HOST);
    expect(headers["x-forwarded-proto"]).toBe("https");
  });

  it("reconstruye X-Forwarded-For con la IP real del cliente", () => {
    const headers = buildRequestHeaders(
      [["x-forwarded-for", "1.2.3.4, 9.9.9.9"]],
      {
        upstreamHost: UPSTREAM_HOST,
        clientIp: "203.0.113.7",
        proxyIp: "10.0.0.1",
      },
    );
    expect(headers["x-forwarded-for"]).toBe("203.0.113.7, 10.0.0.1");
  });

  it("omite X-Forwarded-For cuando no hay IP conocida", () => {
    const headers = buildRequestHeaders([], { upstreamHost: UPSTREAM_HOST });
    expect(headers["x-forwarded-for"]).toBeUndefined();
  });

  it("conserva Content-Type y Accept para las peticiones de la app", () => {
    const headers = buildRequestHeaders(
      [
        ["Content-Type", "application/json"],
        ["Accept", "application/json"],
      ],
      { upstreamHost: UPSTREAM_HOST },
    );
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/json");
  });
});

describe("cabeceras de respuesta", () => {
  it("impide cachear cualquier respuesta de la API", () => {
    const headers = responseHeaders({
      isApi: true,
      csp: CSP,
      allowOrigin: undefined,
    });
    expect(headers["cache-control"]).toBe("no-store");
    expect(headers.pragma).toBe("no-cache");
    expect(headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("aplica las cabeceras de seguridad en la PWA", () => {
    const headers = responseHeaders({ isApi: false, csp: CSP });
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toBe(CSP);
    expect(headers["strict-transport-security"]).toContain("max-age=");
  });

  it("solo emite CORS cuando hay un origen admitido", () => {
    expect(
      responseHeaders({
        isApi: true,
        csp: CSP,
        allowOrigin: "http://localhost:8081",
      })["access-control-allow-origin"],
    ).toBe("http://localhost:8081");
    expect(
      preflightHeaders("http://localhost:8081")["access-control-allow-headers"],
    ).toContain("authorization");
  });
});

describe("origen admitido (CORS opt-in de desarrollo)", () => {
  it("no admite nada con la lista vacía, que es el caso de producción", () => {
    expect(allowedDevOrigin("http://localhost:8081", [])).toBeUndefined();
    expect(allowedDevOrigin("https://evil.example", [])).toBeUndefined();
  });

  it("admite únicamente los orígenes listados", () => {
    const origins = parseOriginList(
      "http://localhost:8081, http://127.0.0.1:8081/",
    );
    expect(allowedDevOrigin("http://localhost:8081", origins)).toBe(
      "http://localhost:8081",
    );
    expect(allowedDevOrigin("https://evil.example", origins)).toBeUndefined();
    expect(allowedDevOrigin(undefined, origins)).toBeUndefined();
  });

  it("normaliza el parseo de la lista", () => {
    expect(parseOriginList("  https://a.test/ , , https://b.test ")).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
    expect(parseOriginList(undefined)).toEqual([]);
  });
});

describe("rutas estáticas", () => {
  it("resuelve dentro del directorio raíz", () => {
    expect(safeStaticPath("/app/dist", "/index.html")).toBe(
      "/app/dist/index.html",
    );
    expect(safeStaticPath("/app/dist", "/_expo/static/a.js")).toBe(
      "/app/dist/_expo/static/a.js",
    );
  });

  it("no permite salir del directorio raíz", () => {
    expect(safeStaticPath("/app/dist", "/../../etc/passwd")).toBeUndefined();
    expect(
      safeStaticPath("/app/dist", "/%2e%2e/%2e%2e/etc/passwd"),
    ).toBeUndefined();
    expect(
      safeStaticPath("/app/dist", "/a/../../../../etc/passwd"),
    ).toBeUndefined();
  });

  it("rechaza rutas con bytes nulos", () => {
    expect(safeStaticPath("/app/dist", "/index.html%00.js")).toBeUndefined();
  });
});

describe("contrato con el backend desplegado", () => {
  it("usa el límite de subida que declara el backend", () => {
    expect(MAX_BODY_BYTES).toBe(6 * 1024 * 1024);
  });

  it("apunta al backend desplegado", () => {
    expect(DEFAULT_UPSTREAM).toBe(
      "https://grownupsvet-backend-w5glrcsyda-uc.a.run.app",
    );
  });
});

const UPSTREAM_HOST = "grownupsvet-backend-w5glrcsyda-uc.a.run.app";
const CSP = "frame-ancestors 'none'";
