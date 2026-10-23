/** Run the real frontend client over HTTP against local, fictitious Postman data. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const runtimeDirectory = resolve(repositoryRoot, "postman/.runtime");
await mkdir(runtimeDirectory, { recursive: true });
const bundlePath = resolve(runtimeDirectory, "availability-batch-client.mjs");
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
const veterinarianId = "00000000-0000-4000-8000-000000000003";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const day = (offset) => client.addDaysToIsoDate(today, offset);
const everyDay = [1, 2, 3, 4, 5, 6, 7];
const checks = [];
await control("reset");
try {
  const session = await client.login({
    email: "administrator@roles.test",
    password: "SimulationOnly!2026",
  });
  context = { token: session.accessToken, generation: 1 };
  const singleDay = day(3);
  const endingAtMidnight = {
    startDate: singleDay,
    endDate: singleDay,
    daysOfWeek: everyDay,
    dailyStartTime: "23:30",
    dailyEndTime: "24:00",
  };
  const created = await client.createVeterinarianAvailabilitySlotBatch(
    veterinarianId,
    endingAtMidnight,
    context,
  );
  assert.equal(created.createdCount, 1);
  assert.equal(
    Date.parse(created.items[0].endsAt),
    Date.parse(`${day(4)}T00:00:00-05:00`),
  );
  checks.push(
    "El cliente real crea el turno de 23:30 a 24:00 y valida el fin del día siguiente.",
  );

  await assert.rejects(
    client.createVeterinarianAvailabilitySlotBatch(
      veterinarianId,
      { ...endingAtMidnight, dailyStartTime: "22:30" },
      context,
    ),
    (error) =>
      error.status === 409 && error.errorCode === "AVAILABILITY_SLOT_CONFLICT",
  );
  const afterConflict = await client.listVeterinarianAvailabilityBatchRange(
    veterinarianId,
    {
      startDate: singleDay,
      endDate: singleDay,
    },
    context,
  );
  assert.equal(afterConflict.length, 1);
  assert.equal(afterConflict[0].id, created.items[0].id);
  checks.push(
    "Una colisión al final del lote devuelve 409 y las lecturas no encuentran turnos parciales.",
  );

  const uncertainInput = {
    startDate: day(4),
    endDate: day(6),
    daysOfWeek: everyDay,
    dailyStartTime: "00:00",
    dailyEndTime: "24:00",
  };
  const expected = client.previewVeterinarianAvailabilityBatch(uncertainInput);
  assert.equal(expected.createdCount, 144);
  await control("fixture", { action: "next-mutation", drop: true });
  const beforeUncertain = requests.length;
  await assert.rejects(
    client.createVeterinarianAvailabilitySlotBatch(
      veterinarianId,
      uncertainInput,
      context,
    ),
    (error) => error.status === 502,
  );
  const current = await client.listVeterinarianAvailabilityBatchRange(
    veterinarianId,
    {
      startDate: uncertainInput.startDate,
      endDate: uncertainInput.endDate,
    },
    context,
  );
  assert.equal(current.length, 144);
  assert.equal(new Set(current.map((slot) => slot.id)).size, 144);
  assert.deepEqual(
    new Set(current.map((slot) => Date.parse(slot.startsAt))),
    new Set(
      expected.intervals.map((interval) => Date.parse(interval.startsAt)),
    ),
  );
  const uncertainRequests = requests.slice(beforeUncertain);
  assert.equal(
    uncertainRequests.filter((request) => request.method === "POST").length,
    1,
  );
  const pages = uncertainRequests.filter((request) => request.method === "GET");
  assert.equal(pages.length, 2);
  assert.equal(
    pages.every(
      (request) =>
        !new URL(`http://local${request.path}`).searchParams.has("status"),
    ),
    true,
  );
  assert.deepEqual(
    pages.map((request) =>
      new URL(`http://local${request.path}`).searchParams.get("page"),
    ),
    ["0", "1"],
  );
  checks.push(
    "Tras perder la respuesta de un lote de 144 horarios, el cliente consulta dos páginas sin filtro y no repite el POST; la lectura solo acredita el estado actual.",
  );

  for (const [index, responseMode, expectedStatus, expectedErrorCode] of [
    [0, "empty", 201, "EMPTY_RESPONSE"],
    [1, "invalid-json", 201, "INVALID_JSON_RESPONSE"],
    [2, "timeout", 408, "SIMULATION_RESPONSE_TIMEOUT"],
  ]) {
    const selectedDay = day(8 + index);
    const input = {
      startDate: selectedDay,
      endDate: selectedDay,
      daysOfWeek: everyDay,
      dailyStartTime: "06:30",
      dailyEndTime: "07:00",
    };
    await control("fixture", { action: "next-mutation", responseMode });
    const beforeWrite = requests.length;
    await assert.rejects(
      client.createVeterinarianAvailabilitySlotBatch(
        veterinarianId,
        input,
        context,
      ),
      (error) =>
        error.status === expectedStatus &&
        error.errorCode === expectedErrorCode,
    );
    const persisted = await client.listVeterinarianAvailabilityBatchRange(
      veterinarianId,
      { startDate: selectedDay, endDate: selectedDay },
      context,
    );
    assert.equal(persisted.length, 1);
    assert.equal(
      requests.slice(beforeWrite).filter((request) => request.method === "POST")
        .length,
      1,
    );
    checks.push(
      `El cliente rechaza el fallo controlado ${responseMode} después de la escritura; consulta el turno vigente sin repetir el POST.`,
    );
  }

  const report = {
    simulationOnly: true,
    checkedAtUtc: new Date().toISOString(),
    checks,
    requests,
  };
  await writeFile(
    resolve(runtimeDirectory, "availability-batch-client-http.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${checks.length} comprobaciones del cliente real por HTTP correctas, sin credenciales en el informe.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  await control("reset");
}
