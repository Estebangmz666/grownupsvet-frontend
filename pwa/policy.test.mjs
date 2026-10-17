import { describe, expect, it } from "vitest";
import { isApiPath, isCacheableAssetRequest } from "./policy.mjs";

const ORIGIN = "https://pwa.example";

describe("política de caché del service worker", () => {
  it("reconoce rutas API y documentación OpenAPI", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/v1/users/me")).toBe(true);
    expect(isApiPath("/v3/api-docs")).toBe(true);
    expect(isApiPath("/v3/api-docs.yaml")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
  });

  it("solo permite recursos estáticos del mismo origen", () => {
    expect(
      isCacheableAssetRequest(
        new Request(`${ORIGIN}/_expo/static/js/web/index-hash.js`),
        ORIGIN,
      ),
    ).toBe(true);
    expect(
      isCacheableAssetRequest(new Request(`${ORIGIN}/api/v1/users/me`), ORIGIN),
    ).toBe(false);
    expect(
      isCacheableAssetRequest(new Request(`${ORIGIN}/v3/api-docs`), ORIGIN),
    ).toBe(false);
    expect(
      isCacheableAssetRequest(
        new Request("https://third-party.example/public.js"),
        ORIGIN,
      ),
    ).toBe(false);
  });

  it("no guarda solicitudes autenticadas, con query ni métodos de escritura", () => {
    expect(
      isCacheableAssetRequest(
        new Request(`${ORIGIN}/_expo/static/js/web/index.js`, {
          headers: { Authorization: "Bearer token" },
        }),
        ORIGIN,
      ),
    ).toBe(false);
    expect(
      isCacheableAssetRequest(
        new Request(`${ORIGIN}/_expo/static/js/web/index.js?user=private`),
        ORIGIN,
      ),
    ).toBe(false);
    expect(
      isCacheableAssetRequest(
        new Request(`${ORIGIN}/_expo/static/js/web/index.js`, {
          method: "POST",
        }),
        ORIGIN,
      ),
    ).toBe(false);
  });
});
