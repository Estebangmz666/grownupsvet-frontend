import { posix, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStaticFilePath } from "./static-path.mjs";

describe("native static paths", () => {
  it.each([
    [posix, "/app/dist", "/app/dist/index.html"],
    [win32, "C:\\app\\dist", "C:\\app\\dist\\index.html"],
    [
      win32,
      "\\\\server\\share\\app\\dist",
      "\\\\server\\share\\app\\dist\\index.html",
    ],
  ])(
    "resolves URL paths inside the native root %s %s",
    (implementation, root, expected) => {
      expect(resolveStaticFilePath(root, "/index.html", implementation)).toBe(
        expected,
      );
      expect(resolveStaticFilePath(root, "/", implementation)).toBe(
        implementation.resolve(root),
      );
      expect(
        resolveStaticFilePath(root, "/_expo/static/app.js", implementation),
      ).toBe(implementation.resolve(root, "_expo/static/app.js"));
      expect(resolveStaticFilePath(root, "/a%20b.txt", implementation)).toBe(
        implementation.resolve(root, "a b.txt"),
      );
    },
  );

  it.each([posix, win32])(
    "rejects traversal, invalid encoding and separator injection with %s",
    (implementation) => {
      const root = implementation === win32 ? "C:\\app\\dist" : "/app/dist";
      for (const pathname of [
        "/../secret.txt",
        "/%2e%2e%2fsecret.txt",
        "/a/../../../secret.txt",
        "/../dist-other/secret.txt",
        "/%5c..%5csecret.txt",
        "/%5c%5cserver%5cshare%5csecret.txt",
        "/index.html%00.js",
        "/bad%encoding",
      ])
        expect(
          resolveStaticFilePath(root, pathname, implementation),
        ).toBeUndefined();
    },
  );

  it("rejects Windows drive paths and alternate streams even inside the root", () => {
    for (const pathname of [
      "/D:/secret.txt",
      "/C:secret.txt",
      "/C:/app/dist/index.html",
      "/favicon.ico:secret",
    ]) {
      expect(
        resolveStaticFilePath("C:\\app\\dist", pathname, win32),
      ).toBeUndefined();
    }
    expect(
      resolveStaticFilePath(
        "\\\\server\\share\\app\\dist",
        "/../../secret.txt",
        win32,
      ),
    ).toBeUndefined();
  });
});
