/** Exercise the actual frontend HTTP client against the local Postman simulation.
 * Run after verify_roles_http.py and before browser checks. Fictitious data only.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const runtime = resolve(repositoryRoot, "postman/.runtime");
await mkdir(runtime, { recursive: true });
const bundlePath = resolve(runtime, "frontend-client.mjs");
await build({
  entryPoints: [resolve(repositoryRoot, "packages/api-client/src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
});
const client = await import(pathToFileURL(bundlePath).href);
const baseUrl = "http://127.0.0.1:4900/api/v1";
const checks = [];
let context = { token: undefined, generation: 0 };
client.configureApiClient({
  baseUrl,
  getRequestContext: () => context,
  isRequestContextCurrent: (captured) =>
    captured.generation === context.generation,
});
const control = async (path, body) => {
  const response = await fetch(
    `http://127.0.0.1:4900/api/__simulation/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  assert.equal(response.status, 204);
};
await control("reset");
try {
  const session = await client.login({
    email: "owner@roles.test",
    password: "SimulationOnly!2026",
  });
  context = { token: session.accessToken, generation: 1 };
  await control("fixture", {
    action: "expand-pets",
    email: "owner@roles.test",
  });
  const first = await client.listPets(
    { active: true, page: 0, size: 20 },
    context,
  );
  const second = await client.listPets(
    { active: true, page: 1, size: 20 },
    context,
  );
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 5);
  assert.equal(
    new Set([...first.items, ...second.items].map((pet) => pet.id)).size,
    25,
  );
  checks.push("Actual client retrieves distinct pets from both pages");
  await client.requestPasswordRecovery("owner@roles.test");
  const verified = await client.verifyPasswordRecovery(
    "owner@roles.test",
    "012345",
  );
  const newPassword = "  Una frase ficticia para verificar 2026  ";
  await client.resetPassword({
    resetToken: verified.resetToken,
    newPassword,
    confirmNewPassword: newPassword,
  });
  await assert.rejects(
    client.getProfile(context),
    (error) => error.status === 401,
  );
  await assert.rejects(
    client.login({
      email: "owner@roles.test",
      password: "SimulationOnly!2026",
    }),
    (error) => error.status === 401,
  );
  await client.login({ email: "owner@roles.test", password: newPassword });
  checks.push(
    "Actual recovery client preserves password spaces and previous session is revoked by stand-in",
  );
  const report = {
    simulationOnly: true,
    checkedAtUtc: new Date().toISOString(),
    checks,
  };
  await writeFile(
    resolve(runtime, "frontend-client-http.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${checks.length} comprobaciones del cliente real por HTTP correctas; sin tokens en informe.`,
  );
} finally {
  await control("reset");
}
