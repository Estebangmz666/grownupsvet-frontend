const API_PATHS = ["/api", "/v3/api-docs"];
const CACHEABLE_ASSET_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/pwa-register.js",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/apple-touch-icon.png",
  "/pwa/policy.mjs",
]);

export function isApiPath(pathname) {
  return API_PATHS.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`) ||
      pathname.startsWith(`${prefix}.`),
  );
}

export function isCacheableAssetRequest(request, origin) {
  if (request.method !== "GET") return false;
  if (request.headers.has("authorization") || request.headers.has("cookie")) {
    return false;
  }

  const url = new URL(request.url, origin);
  if (url.origin !== origin || url.search || isApiPath(url.pathname)) {
    return false;
  }

  return (
    url.pathname.startsWith("/_expo/static/") ||
    CACHEABLE_ASSET_PATHS.has(url.pathname)
  );
}
