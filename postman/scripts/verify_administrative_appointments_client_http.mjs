/** Run the production TypeScript client against the local contract stand-in. */
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
  "administrative-appointments-client.mjs",
);
await build({
  entryPoints: [resolve(repositoryRoot, "packages/api-client/src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
});
const client = await import(pathToFileURL(bundlePath).href);
const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" ? input : (input.url ?? input));
  if (url.pathname.startsWith("/api/v1/"))
    requests.push({
      method: options?.method ?? "GET",
      path: url.pathname + url.search,
    });
  return originalFetch(input, options);
};
let context = { token: undefined, generation: 0 };
client.configureApiClient({
  baseUrl: "http://127.0.0.1:4900/api/v1",
  getRequestContext: () => context,
  isRequestContextCurrent: (captured) =>
    captured.generation === context.generation,
});
async function control(path, body) {
  const response = await originalFetch(
    `http://127.0.0.1:4900/api/__simulation/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  assert.equal(response.status, 204);
}
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const tomorrow = client.addDaysToIsoDate(today, 1);
const checks = [];
await control("reset");
try {
  const session = await client.login({
    email: "administrator@roles.test",
    password: "SimulationOnly!2026",
  });
  context = { token: session.accessToken, generation: 1 };
  const query = { from: tomorrow, to: tomorrow, size: 20 };
  const first = await client.listAdministrativeAppointments(
    { ...query, page: 0 },
    context,
  );
  const second = await client.listAdministrativeAppointments(
    { ...query, page: 1 },
    context,
  );
  assert.equal(first.totalElements, 25);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 5);
  const requested = [...first.items, ...second.items].filter(
    (item) => item.status === "REQUESTED",
  );
  assert.equal(requested.length, 20);
  assert.ok(
    requested.some((item) => item.assignmentStatus === "NEEDS_REASSIGNMENT"),
  );
  checks.push(
    "El cliente real valida y recorre una agenda de 25 citas en dos páginas, manteniendo estado y asignación independientes.",
  );

  const source = requested.shift();
  const confirmed = await client.updateAdministrativeAppointmentStatus(
    source.id,
    {
      status: "CONFIRMED",
      expectedVersion: source.version,
    },
    context,
  );
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.version, source.version + 1);
  const event0 = await client.listAdministrativeAppointmentEvents(
    source.id,
    { page: 0, size: 1 },
    context,
  );
  const event1 = await client.listAdministrativeAppointmentEvents(
    source.id,
    { page: 1, size: 1 },
    context,
  );
  assert.equal(event0.totalElements, 2);
  assert.equal(event1.totalElements, 2);
  assert.notEqual(event0.items[0].id, event1.items[0].id);
  checks.push(
    "Confirmar conserva el UUID, incrementa la versión y permite recorrer el historial paginado.",
  );

  const rejectedSource = requested.shift();
  const beforeInvalid = requests.length;
  await assert.rejects(
    client.updateAdministrativeAppointmentStatus(
      rejectedSource.id,
      {
        status: "REJECTED",
        expectedVersion: rejectedSource.version,
        reason: "  ",
      },
      context,
    ),
    RangeError,
  );
  assert.equal(requests.length, beforeInvalid);
  await control("fixture", {
    action: "appointment-state",
    appointmentId: rejectedSource.id,
    cutoffPassed: true,
  });
  const rejected = await client.updateAdministrativeAppointmentStatus(
    rejectedSource.id,
    {
      status: "REJECTED",
      expectedVersion: rejectedSource.version,
      reason: " Agenda no disponible ",
    },
    context,
  );
  assert.equal(rejected.status, "REJECTED");
  const rejectedEvents = await client.listAdministrativeAppointmentEvents(
    rejected.id,
    {},
    context,
  );
  assert.ok(
    rejectedEvents.items.some((item) => item.reason === "Agenda no disponible"),
  );
  checks.push(
    "El motivo vacío se rechaza antes de HTTP; un rechazo con motivo válido sigue permitido tras el corte de confirmación.",
  );

  const concurrent = requested.shift();
  await control("fixture", {
    action: "appointment-state",
    appointmentId: concurrent.id,
    advanceVersion: true,
  });
  await assert.rejects(
    client.updateAdministrativeAppointmentStatus(
      concurrent.id,
      {
        status: "CONFIRMED",
        expectedVersion: concurrent.version,
      },
      context,
    ),
    (error) => error.status === 409 && error.errorCode === "CONCURRENT_UPDATE",
  );
  const current = await client.getAdministrativeAppointment(
    concurrent.id,
    context,
  );
  assert.equal(current.version, concurrent.version + 1);
  assert.equal(current.status, "REQUESTED");
  checks.push(
    "Una versión desactualizada produce 409 y la consulta actual recupera la nueva versión sin reenviar la decisión.",
  );

  const cutoff = requested.shift();
  await control("fixture", {
    action: "appointment-state",
    appointmentId: cutoff.id,
    cutoffPassed: true,
  });
  await assert.rejects(
    client.updateAdministrativeAppointmentStatus(
      cutoff.id,
      {
        status: "CONFIRMED",
        expectedVersion: cutoff.version,
      },
      context,
    ),
    (error) =>
      error.status === 409 &&
      error.errorCode === "APPOINTMENT_CONFIRMATION_CUTOFF_PASSED",
  );
  checks.push(
    "El cliente conserva el conflicto específico del corte persistido del servidor, sin inventar su hora en la interfaz.",
  );

  for (const mode of ["drop", "empty", "invalid-json", "timeout"]) {
    const uncertain = requested.shift();
    await control("fixture", {
      action: "next-mutation",
      ...(mode === "drop" ? { drop: true } : { responseMode: mode }),
    });
    const start = requests.length;
    await assert.rejects(
      client.updateAdministrativeAppointmentStatus(
        uncertain.id,
        {
          status: "CONFIRMED",
          expectedVersion: uncertain.version,
        },
        context,
      ),
      (error) =>
        mode === "drop"
          ? error.status === 502
          : mode === "timeout"
            ? error.status === 408
            : mode === "empty"
              ? error.errorCode === "EMPTY_RESPONSE"
              : error.errorCode === "INVALID_JSON_RESPONSE",
    );
    const observed = await client.getAdministrativeAppointment(
      uncertain.id,
      context,
    );
    const history = await client.listAdministrativeAppointmentEvents(
      uncertain.id,
      {},
      context,
    );
    assert.equal(observed.status, "CONFIRMED");
    assert.equal(observed.version, uncertain.version + 1);
    assert.equal(history.totalElements, 2);
    assert.equal(
      requests.slice(start).filter((request) => request.method === "PATCH")
        .length,
      1,
    );
    checks.push(
      `La respuesta ${mode} después de escribir se rechaza; detalle e historial muestran el estado actual sin repetir PATCH.`,
    );
  }
  const readOnlySession = await client.login({
    email: "read-only-administrator@roles.test",
    password: "SimulationOnly!2026",
  });
  context = {
    token: readOnlySession.accessToken,
    generation: context.generation + 1,
  };
  const readOnlyPage = await client.listAdministrativeAppointments(
    { ...query, page: 0 },
    context,
  );
  assert.equal(readOnlyPage.totalElements, 25);
  const readOnlyCandidate = readOnlyPage.items.find(
    (item) => item.status === "REQUESTED",
  );
  await assert.rejects(
    client.updateAdministrativeAppointmentStatus(
      readOnlyCandidate.id,
      {
        status: "CONFIRMED",
        expectedVersion: readOnlyCandidate.version,
      },
      context,
    ),
    (error) => error.status === 403,
  );
  checks.push(
    "Una cuenta ficticia de administrador con solo lectura consulta citas y recibe 403 al intentar modificarlas.",
  );
  const report = {
    simulationOnly: true,
    checkedAtUtc: new Date().toISOString(),
    checks,
    requestCount: requests.length,
    requests,
  };
  await writeFile(
    resolve(runtimeDirectory, "administrative-appointments-client-http.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    `${checks.length} comprobaciones del cliente real aprobadas mediante ${requests.length} peticiones de producto, solo HTTP local.\n`,
  );
} finally {
  context = { token: undefined, generation: context.generation + 1 };
  await control("reset");
  globalThis.fetch = originalFetch;
}
