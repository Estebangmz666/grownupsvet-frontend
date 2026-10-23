import path from "node:path";

/** Native filesystem resolution for Node, including Windows drives and UNC roots. */
export function resolveStaticFilePath(
  root,
  pathname,
  pathImplementation = path,
) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split("?")[0]);
  } catch {
    return undefined;
  }
  // URL paths use forward slashes. Backslashes would become separators on Windows.
  if (decoded.includes("\0") || decoded.includes("\\")) return undefined;
  // Prevent Windows drive-relative paths and alternate data streams.
  if (pathImplementation.sep === "\\" && decoded.includes(":"))
    return undefined;

  const rootResolved = pathImplementation.resolve(root);
  const candidate = pathImplementation.resolve(
    rootResolved,
    decoded.replace(/^\/+/, ""),
  );
  const relative = pathImplementation.relative(rootResolved, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${pathImplementation.sep}`) ||
    pathImplementation.isAbsolute(relative)
  )
    return undefined;
  return candidate;
}
