/** Execute the current TypeScript client against local fictitious notification data. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const runtimeDirectory = resolve(repositoryRoot, "postman/.runtime");
await mkdir(runtimeDirectory, { recursive: true });
const bundlePath = resolve(
  runtimeDirectory,
  "administrative-notifications-client.mjs",
);
await build({
  entryPoints: [resolve(repositoryRoot, "packages/api-client/src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
});
const client = await import(pathToFileURL(bundlePath).href);
const origin = "http://127.0.0.1:4900";
const originalFetch = globalThis.fetch;
const requests = [];
const checks = [];
let unauthorizedCallbacks = 0;
let context = { token: undefined, generation: 0 };
client.configureApiClient({
  baseUrl: `${origin}/api/v1`,
  getRequestContext: () => context,
  isRequestContextCurrent: (captured) =>
    captured.generation === context.generation,
  onUnauthorized: () => {
    unauthorizedCallbacks += 1;
  },
});

// A delegating observer records metadata only; it never changes an HTTP response.
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.origin, origin);
  assert.ok(url.pathname.startsWith("/api/v1/"));
  const record = {
    method:
      options?.method ?? (typeof input === "string" ? "GET" : input.method),
    path: url.pathname + url.search,
    status: null,
  };
  requests.push(record);
  try {
    const response = await originalFetch(input, options);
    record.status = response.status;
    return response;
  } catch (error) {
    record.transportError = error.name;
    throw error;
  }
};
async function control(path, body) {
  const response = await originalFetch(`${origin}/api/__simulation/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, 204, `Simulation control ${path}`);
}
const fixture = (body) => control("fixture", body);
const appointmentId = "d1000000-0000-4000-8000-000000000003";
const otherAppointmentId = "d1000000-0000-4000-8000-000000000004";
const read = (page = 0, size = 20, id = appointmentId, captured = context) =>
  client.listAdministrativeAppointmentNotifications(
    id,
    { page, size },
    captured,
  );
const expectedError = (status, errorCode) => (error) =>
  error.status === status && error.errorCode === errorCode;
async function login(email) {
  const session = await client.login({
    email,
    password: "SimulationOnly!2026",
  });
  context = { token: session.accessToken, generation: context.generation + 1 };
  return session.user;
}
const businessWrites = () =>
  requests.filter(
    (request) =>
      request.method !== "GET" && !request.path.startsWith("/api/v1/auth/"),
  );

try {
  await control("reset");
  await fixture({
    action: "prepare-appointment-notifications",
    appointmentId,
    count: 26,
  });
  await login("administrator@roles.test");
  const first = await read(0);
  const second = await read(1);
  assert.equal(first.totalElements, 26);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 6);
  const notifications = [...first.items, ...second.items];
  assert.equal(new Set(notifications.map((item) => item.id)).size, 26);
  assert.ok(
    notifications.every(
      (item) =>
        item.appointmentId === appointmentId && Object.keys(item).length === 9,
    ),
  );
  assert.ok(
    notifications.some(
      (item) => item.notificationType === "ADMIN_REASSIGNMENT",
    ),
  );
  assert.deepEqual(
    new Set(notifications.map((item) => item.status)),
    new Set(["PENDING", "SENDING", "SENT", "FAILED", "SUPERSEDED"]),
  );
  checks.push(
    "El cliente real lee 26 avisos administrativos en páginas20+6, conserva los nueve campos del DTO autorizado y reconoce tipos/estados contratados.",
  );

  const pending = notifications.find((item) => item.status === "PENDING");
  assert.equal(pending.errorCode, "SMTP_DELIVERY_FAILED");
  assert.ok(pending.nextAttemptAt !== null);
  assert.ok(
    notifications
      .filter((item) => item.status !== "PENDING")
      .every((item) => item.nextAttemptAt === null),
  );
  const earliest = first.items[0];
  const bogotaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(earliest.scheduledAt));
  assert.equal(
    bogotaDate,
    client.addDaysToIsoDate(earliest.scheduledAt.slice(0, 10), -1),
  );
  assert.notEqual(earliest.scheduledAt, earliest.sentAt);
  checks.push(
    "PENDING conserva último fallo y próximo intento; fecha prevista y envío son distintos, y04:30Z corresponde a la víspera en Bogotá.",
  );

  const empty = await read(0, 20, otherAppointmentId);
  assert.equal(empty.totalElements, 0);
  assert.equal(empty.totalPages, 0);
  assert.deepEqual(empty.items, []);
  checks.push(
    "Una cita autorizada sin avisos devuelve una página vacía válida.",
  );

  const readOnlyUser = await login("read-only-administrator@roles.test");
  assert.ok(readOnlyUser.permissions.includes("APPOINTMENT_READ_ALL"));
  assert.ok(!readOnlyUser.permissions.includes("APPOINTMENT_MANAGE"));
  assert.equal((await read()).totalElements, 26);
  checks.push(
    "Un administrador con permiso exclusivo de consulta accede a avisos sin APPOINTMENT_MANAGE.",
  );

  const beforeInvalid = requests.length;
  for (const params of [
    { page: -1 },
    { page: 1.5 },
    { size: 101 },
    { page: Number.MAX_SAFE_INTEGER },
  ]) {
    await assert.rejects(
      client.listAdministrativeAppointmentNotifications(
        appointmentId,
        params,
        context,
      ),
      RangeError,
    );
  }
  await assert.rejects(
    client.listAdministrativeAppointmentNotifications("bad/id", {}, context),
    RangeError,
  );
  assert.equal(requests.length, beforeInvalid);
  checks.push(
    "UUID y paginaciones inválidas se rechazan antes de emitir HTTP.",
  );

  for (const [mode, status, errorCode] of [
    ["unavailable", 503, "SIMULATION_TEMPORARY_UNAVAILABLE"],
    ["forbidden", 403, "ACCESS_DENIED"],
    ["missing", 404, "APPOINTMENT_NOT_FOUND"],
  ]) {
    await fixture({ action: "next-notification-read", appointmentId, mode });
    const tokenBefore = context.token;
    const start = requests.length;
    await assert.rejects(read(), expectedError(status, errorCode));
    assert.equal(requests.length - start, 1);
    assert.equal(context.token, tokenBefore);
    assert.equal(unauthorizedCallbacks, 0);
    assert.equal((await read()).totalElements, 26);
    checks.push(
      `El fallo inyectado ${status} (${mode}) se propaga sin reintento ni cierre de sesión; una nueva consulta explícita se recupera.`,
    );
  }

  for (const mode of ["invalid-json", "extra-field", "foreign"]) {
    await fixture({ action: "next-notification-read", appointmentId, mode });
    const start = requests.length;
    const predicate =
      mode === "invalid-json"
        ? expectedError(200, "INVALID_JSON_RESPONSE")
        : (error) =>
            error.name === "Error" &&
            error.message ===
              "Los avisos no corresponden a la cita solicitada o a su contrato privado.";
    await assert.rejects(read(), predicate);
    assert.equal(requests.length - start, 1);
    assert.equal((await read()).totalElements, 26);
    checks.push(
      `El recibo inválido ${mode} se rechaza antes de exponer datos y no modifica la colección; la siguiente consulta normal vuelve a funcionar.`,
    );
  }

  await fixture({
    action: "next-notification-read",
    appointmentId,
    mode: "normal",
    delayMs: 350,
  });
  const captured = context;
  const late = read(0, 20, appointmentId, captured);
  await new Promise((resolve) => setTimeout(resolve, 75));
  context = { token: captured.token, generation: captured.generation + 1 };
  await assert.rejects(
    late,
    (error) => error.name === "StaleSessionRequestError",
  );
  assert.equal((await read()).totalElements, 26);
  assert.equal(unauthorizedCallbacks, 0);
  checks.push(
    "Una respuesta HTTP demorada de una generación anterior se descarta; la sesión actual conserva su consulta autorizada.",
  );

  await login("owner@roles.test");
  const ownerFirst = await read();
  const ownerSecond = await read(1);
  assert.equal(ownerFirst.totalElements, 25);
  assert.equal(ownerFirst.items.length, 20);
  assert.equal(ownerSecond.items.length, 5);
  assert.ok(
    [...ownerFirst.items, ...ownerSecond.items].every(
      (item) => item.notificationType !== "ADMIN_REASSIGNMENT",
    ),
  );
  checks.push(
    "El alcance de propietario filtra al destinatario antes de paginar:25avisos20+5, sin el aviso interno del administrador.",
  );
  await login("other-owner@roles.test");
  await assert.rejects(read(), expectedError(404, "APPOINTMENT_NOT_FOUND"));
  checks.push(
    "Un propietario ajeno recibe404 sin acceso a los avisos de otra cita.",
  );
  for (const email of ["veterinarian@roles.test", "superadmin@roles.test"]) {
    await login(email);
    await assert.rejects(read(), expectedError(403, "ACCESS_DENIED"));
  }
  checks.push(
    "Veterinario y superadministrador reciben403; los permisos no se heredan entre roles.",
  );
  context = { token: undefined, generation: context.generation + 1 };
  await assert.rejects(read(), (error) => error.status === 401);
  assert.equal(businessWrites().length, 0);
  assert.equal(unauthorizedCallbacks, 0);
  checks.push(
    "Sin sesión la API responde401; el recorrido no emite escrituras de citas ni reenvíos de avisos.",
  );

  const report = {
    simulationOnly: true,
    checkedAtUtc: new Date().toISOString(),
    clientEntryPoint: "packages/api-client/src/index.ts",
    transport:
      "Original fetch over loopback HTTP; observer records only method/path/status. No response stubs.",
    fixtureControlsExcludedFromProductRequestCount: true,
    delayedResponseScope:
      "The server fixture delays before headers; this HTTP scenario checks a late response. Unit tests separately cover session changes during response.text consumption.",
    businessWrites: businessWrites().length,
    unauthorizedCallbacks,
    checks,
    requestCount: requests.length,
    requests,
  };
  await writeFile(
    resolve(runtimeDirectory, "administrative-notifications-client-http.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    `${checks.length} comprobaciones del cliente real aprobadas mediante ${requests.length} peticiones de producto, solo HTTP local.\n`,
  );
} finally {
  context = { token: undefined, generation: context.generation + 1 };
  try {
    await control("reset");
  } finally {
    globalThis.fetch = originalFetch;
  }
}
