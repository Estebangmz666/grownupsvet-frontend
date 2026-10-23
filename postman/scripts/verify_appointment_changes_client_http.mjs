/** Execute the current TypeScript client over local HTTP, with fictitious data only. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const runtimeDirectory = resolve(repositoryRoot, "postman/.runtime");
await mkdir(runtimeDirectory, { recursive: true });
const bundlePath = resolve(runtimeDirectory, "appointment-changes-client.mjs");
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
let context = { token: undefined, generation: 0 };
client.configureApiClient({
  baseUrl: `${origin}/api/v1`,
  getRequestContext: () => context,
  isRequestContextCurrent: (captured) =>
    captured.generation === context.generation,
});

// Observe real requests without replacing their responses or recording bodies/headers.
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(
    url.origin,
    origin,
    "This verifier can contact only local port 4900.",
  );
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
async function fixture(body) {
  await control("fixture", body);
}
async function resetGroup() {
  context = { token: undefined, generation: context.generation + 1 };
  await control("reset");
  await fixture({ action: "prepare-appointment-changes" });
  const session = await client.login({
    email: "administrator@roles.test",
    password: "SimulationOnly!2026",
  });
  context = { token: session.accessToken, generation: context.generation + 1 };
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const day = (offset) => client.addDaysToIsoDate(today, offset);
const appointmentId = (suffix) =>
  `d1000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const veterinarianId = "00000000-0000-4000-8000-000000000003";
const getAppointment = (id) => client.getAdministrativeAppointment(id, context);
const getHistory = (id) =>
  client.listAdministrativeAppointmentEvents(
    id,
    { page: 0, size: 100 },
    context,
  );
const agrees = () => ({
  agreementChannel: "PHONE",
  agreementContactedAt: new Date(Date.now() - 60_000).toISOString(),
  agreementNote: "\u001cConstancia ficticia del acuerdo previo\u3000",
});
const moveIntent = (source, target, agreement = true) => ({
  clientRequestId: randomUUID(),
  availabilitySlotId: target.id,
  expectedAvailabilitySlotVersion: target.version,
  expectedVersion: source.version,
  reason: "\u001cCambio administrativo ficticio\u3000",
  ...(agreement ? agrees() : {}),
});
const expectedError = (status, errorCode) => (error) =>
  error.status === status && error.errorCode === errorCode;
const postsSince = (start, operation) =>
  requests
    .slice(start)
    .filter(
      (record) =>
        record.method === "POST" && record.path.endsWith(`/${operation}`),
    );

async function publishedSlots(vetId, date) {
  const slots = [];
  let expectedTotal;
  for (let page = 0; page < 10; page += 1) {
    const result = await client.listAdministrativeAppointmentDestinationSlots(
      vetId,
      { from: date, to: date, page, size: 20 },
      context,
    );
    expectedTotal ??= result.totalElements;
    assert.equal(result.totalElements, expectedTotal);
    slots.push(...result.items);
    if (page + 1 >= result.totalPages) break;
  }
  assert.equal(
    slots.length,
    expectedTotal,
    "The complete candidate range must be read.",
  );
  assert.equal(new Set(slots.map((slot) => slot.id)).size, slots.length);
  return slots;
}
async function firstDestination() {
  const slots = await publishedSlots(veterinarianId, day(3));
  assert.equal(slots.length, 25);
  return slots[0];
}
async function assertUnchanged(source, history) {
  assert.deepEqual(await getAppointment(source.id), source);
  assert.deepEqual(await getHistory(source.id), history);
}
async function prepareExceptionalSource(suffix = 26) {
  const source = await getAppointment(appointmentId(suffix));
  const originalVet = await client.getVeterinarian(
    source.veterinarianId,
    {},
    context,
  );
  assert.equal(originalVet.email, "veterinarian-4@roles.test");
  await fixture({
    action: "appointment-veterinarian-unavailable",
    appointmentId: source.id,
  });
  const current = await getAppointment(source.id);
  assert.equal(current.assignmentStatus, "NEEDS_REASSIGNMENT");
  assert.equal(
    (await client.getVeterinarian(originalVet.id, {}, context)).status,
    "DISABLED",
  );
  return current;
}

try {
  await resetGroup();
  const candidateRequestStart = requests.length;
  const candidates = await publishedSlots(veterinarianId, day(3));
  assert.equal(candidates.length, 25);
  const candidateRequests = requests.slice(candidateRequestStart);
  assert.deepEqual(
    candidateRequests.map((record) =>
      new URL(`${origin}${record.path}`).searchParams.get("page"),
    ),
    ["0", "1"],
  );
  assert.ok(
    candidateRequests.every(
      (record) =>
        new URL(`${origin}${record.path}`).searchParams.get("status") ===
        "PUBLISHED",
    ),
  );
  assert.ok(
    candidates.every(
      (slot) => slot.status === "PUBLISHED" && Object.keys(slot).length === 7,
    ),
  );
  const activeVets = await client.listVeterinarians(
    { status: "ACTIVE", page: 0, size: 20 },
    {},
    context,
  );
  assert.ok(activeVets.items.some((vet) => vet.id === veterinarianId));
  checks.push(
    "El cliente real recorre los 25 candidatos publicados en páginas de 20+5, sin presentar ocupación como parte del DTO.",
  );

  const cancellable = await getAppointment(appointmentId(5));
  const cancelled = await client.updateAdministrativeAppointmentStatus(
    cancellable.id,
    {
      status: "CANCELLED",
      expectedVersion: cancellable.version,
      reason: "\u001cCancelación ficticia\u3000",
    },
    context,
  );
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.version, cancellable.version + 1);
  const cancelledHistory = await getHistory(cancelled.id);
  assert.ok(
    cancelledHistory.items.some(
      (event) =>
        event.eventType === "CANCELLED" &&
        event.reason === "Cancelación ficticia",
    ),
  );
  checks.push(
    "Cancelar una solicitud futura conserva identidad, incrementa versión y registra el motivo normalizado por Java.",
  );

  const futureConfirmed = await getAppointment(appointmentId(3));
  const futureHistory = await getHistory(futureConfirmed.id);
  assert.equal(futureConfirmed.status, "CONFIRMED");
  await assert.rejects(
    client.updateAdministrativeAppointmentStatus(
      futureConfirmed.id,
      {
        status: "NO_SHOW",
        expectedVersion: futureConfirmed.version,
        reason: "Inasistencia ficticia",
      },
      context,
    ),
    expectedError(409, "APPOINTMENT_NOT_ENDED"),
  );
  await assertUnchanged(futureConfirmed, futureHistory);
  checks.push(
    "NO_SHOW antes del fin recibe 409 APPOINTMENT_NOT_ENDED y conserva cita e historial.",
  );

  await fixture({
    action: "appointment-state",
    appointmentId: appointmentId(1),
    timing: "ENDED",
  });
  const ended = await getAppointment(appointmentId(1));
  assert.equal(ended.status, "CONFIRMED");
  assert.ok(Date.parse(ended.endsAt) < Date.now());
  await assert.rejects(
    client.updateAdministrativeAppointmentStatus(
      ended.id,
      {
        status: "CANCELLED",
        expectedVersion: ended.version,
        reason: "Cancelación fuera de plazo",
      },
      context,
    ),
    expectedError(409, "APPOINTMENT_ALREADY_STARTED"),
  );
  const noShow = await client.updateAdministrativeAppointmentStatus(
    ended.id,
    {
      status: "NO_SHOW",
      expectedVersion: ended.version,
      reason: "Inasistencia ficticia",
    },
    context,
  );
  assert.equal(noShow.status, "NO_SHOW");
  assert.equal(noShow.version, ended.version + 1);
  assert.ok(
    (await getHistory(ended.id)).items.some(
      (event) => event.eventType === "NO_SHOW",
    ),
  );
  checks.push(
    "Con un turno terminado por fixture temporal, cancelar falla por plazo y registrar inasistencia sí aplica.",
  );

  await resetGroup();
  const source = await getAppointment(appointmentId(5));
  const beforeHistory = await getHistory(source.id);
  const target = await firstDestination();
  const staleTarget = {
    ...moveIntent(source, target),
    expectedAvailabilitySlotVersion: target.version + 1,
  };
  await assert.rejects(
    client.rescheduleAdministrativeAppointment(source.id, staleTarget, context),
    expectedError(409, "CONCURRENT_UPDATE"),
  );
  await assertUnchanged(source, beforeHistory);
  const occupiedAppointment = await getAppointment(appointmentId(3));
  const occupied = (await publishedSlots(veterinarianId, day(1))).find(
    (slot) =>
      Date.parse(slot.startsAt) === Date.parse(occupiedAppointment.startsAt),
  );
  assert.ok(occupied);
  await assert.rejects(
    client.rescheduleAdministrativeAppointment(
      source.id,
      moveIntent(source, occupied),
      context,
    ),
    expectedError(409, "APPOINTMENT_SLOT_OCCUPIED"),
  );
  await assertUnchanged(source, beforeHistory);
  checks.push(
    "Versión de destino obsoleta y destino ocupado producen sus 409 concretos sin modificar reserva, versión ni historial originales.",
  );

  await fixture({
    action: "appointment-state",
    appointmentId: source.id,
    cutoffPassed: true,
  });
  await assert.rejects(
    client.rescheduleAdministrativeAppointment(
      source.id,
      moveIntent(source, target),
      context,
    ),
    expectedError(409, "APPOINTMENT_CONFIRMATION_CUTOFF_PASSED"),
  );
  await assertUnchanged(source, beforeHistory);
  checks.push(
    "Una pendiente con corte original vencido no elude ese corte mediante reprogramación.",
  );

  await resetGroup();
  const original = await getAppointment(appointmentId(5));
  const destination = await firstDestination();
  const intent = moveIntent(original, destination);
  const moved = await client.rescheduleAdministrativeAppointment(
    original.id,
    intent,
    context,
  );
  assert.equal(moved.id, original.id);
  assert.equal(moved.ownerId, original.ownerId);
  assert.equal(moved.petId, original.petId);
  assert.equal(moved.status, "REQUESTED");
  assert.equal(moved.assignmentStatus, "ASSIGNED");
  assert.equal(moved.version, original.version + 1);
  assert.equal(Date.parse(moved.startsAt), Date.parse(destination.startsAt));
  const movedHistory = await getHistory(moved.id);
  assert.ok(
    movedHistory.items.some(
      (event) =>
        event.eventType === "RESCHEDULED" &&
        event.appointmentVersion === moved.version,
    ),
  );
  const replay = await client.rescheduleAdministrativeAppointment(
    original.id,
    intent,
    context,
  );
  assert.deepEqual(replay, moved);
  assert.deepEqual(await getHistory(moved.id), movedHistory);
  checks.push(
    "Reprogramar con acuerdo conserva participantes y estado; repetir intencionalmente la misma clave devuelve la cita sin otro evento.",
  );

  const laterCancelled = await client.updateAdministrativeAppointmentStatus(
    moved.id,
    {
      status: "CANCELLED",
      expectedVersion: moved.version,
      reason: "Cancelación posterior ficticia",
    },
    context,
  );
  const finalHistory = await getHistory(moved.id);
  const currentReplay = await client.rescheduleAdministrativeAppointment(
    original.id,
    intent,
    context,
  );
  assert.deepEqual(currentReplay, laterCancelled);
  assert.equal(currentReplay.status, "CANCELLED");
  assert.equal(currentReplay.version, original.version + 2);
  assert.deepEqual(await getHistory(moved.id), finalHistory);
  await assert.rejects(
    client.rescheduleAdministrativeAppointment(
      original.id,
      { ...intent, reason: "Otra intención con la misma clave" },
      context,
    ),
    expectedError(409, "APPOINTMENT_IDEMPOTENCY_CONFLICT"),
  );
  assert.deepEqual(await getHistory(moved.id), finalHistory);
  checks.push(
    "Un replay tras cancelación devuelve el estado CURRENT CANCELLED y su nueva versión; cambiar el contenido bajo la misma clave produce conflicto.",
  );

  for (const mode of ["drop", "empty", "invalid-json", "timeout"]) {
    await resetGroup();
    const uncertainSource = await getAppointment(appointmentId(5));
    const uncertainTarget = await firstDestination();
    const uncertainIntent = moveIntent(uncertainSource, uncertainTarget);
    await fixture({
      action: "next-mutation",
      ...(mode === "drop" ? { drop: true } : { responseMode: mode }),
    });
    const start = requests.length;
    const predicate =
      mode === "drop"
        ? (error) => error.status === 502
        : mode === "timeout"
          ? expectedError(408, "SIMULATION_RESPONSE_TIMEOUT")
          : expectedError(
              200,
              mode === "empty" ? "EMPTY_RESPONSE" : "INVALID_JSON_RESPONSE",
            );
    await assert.rejects(
      client.rescheduleAdministrativeAppointment(
        uncertainSource.id,
        uncertainIntent,
        context,
      ),
      predicate,
    );
    const observed = await getAppointment(uncertainSource.id);
    const history = await getHistory(uncertainSource.id);
    assert.equal(observed.version, uncertainSource.version + 1);
    assert.equal(
      Date.parse(observed.startsAt),
      Date.parse(uncertainTarget.startsAt),
    );
    assert.equal(
      history.items.filter((event) => event.eventType === "RESCHEDULED").length,
      1,
    );
    assert.equal(postsSince(start, "reschedulings").length, 1);
    checks.push(
      `El fallo inyectado ${mode} tras reprogramar se identifica por estado/código; GET de detalle e historial comprueba el cambio sin otro POST.`,
    );
  }

  await resetGroup();
  const exceptional = await prepareExceptionalSource();
  const sameTimeTarget = (await publishedSlots(veterinarianId, day(1))).find(
    (slot) => Date.parse(slot.startsAt) === Date.parse(exceptional.startsAt),
  );
  assert.ok(sameTimeTarget);
  const reassignmentIntent = moveIntent(exceptional, sameTimeTarget, false);
  const reassigned = await client.reassignAdministrativeAppointmentVeterinarian(
    exceptional.id,
    reassignmentIntent,
    context,
  );
  assert.equal(reassigned.veterinarianId, veterinarianId);
  assert.equal(reassigned.startsAt, exceptional.startsAt);
  assert.equal(reassigned.status, exceptional.status);
  assert.equal(reassigned.assignmentStatus, "ASSIGNED");
  assert.equal(reassigned.version, exceptional.version + 1);
  const reassignmentHistory = await getHistory(reassigned.id);
  assert.ok(
    reassignmentHistory.items.some((event) => event.eventType === "REASSIGNED"),
  );
  assert.deepEqual(
    await client.reassignAdministrativeAppointmentVeterinarian(
      exceptional.id,
      reassignmentIntent,
      context,
    ),
    reassigned,
  );
  assert.deepEqual(await getHistory(reassigned.id), reassignmentHistory);
  checks.push(
    "La reasignación excepcional al mismo horario sustituye al veterinario inactivo sin exigir acuerdo; su replay no duplica historia.",
  );

  await resetGroup();
  const changedTimeSource = await prepareExceptionalSource();
  const changedTimeTarget = await firstDestination();
  const changedTimeHistory = await getHistory(changedTimeSource.id);
  const withoutAgreement = moveIntent(
    changedTimeSource,
    changedTimeTarget,
    false,
  );
  await assert.rejects(
    client.reassignAdministrativeAppointmentVeterinarian(
      changedTimeSource.id,
      withoutAgreement,
      context,
    ),
    expectedError(400, "INVALID_APPOINTMENT_REQUEST"),
  );
  await assertUnchanged(changedTimeSource, changedTimeHistory);
  const withAgreement =
    await client.reassignAdministrativeAppointmentVeterinarian(
      changedTimeSource.id,
      { ...withoutAgreement, ...agrees() },
      context,
    );
  assert.equal(
    Date.parse(withAgreement.startsAt),
    Date.parse(changedTimeTarget.startsAt),
  );
  assert.equal(withAgreement.assignmentStatus, "ASSIGNED");
  checks.push(
    "Cambiar la hora durante una reasignación exige acuerdo en el servidor; el fallo conserva la cita y el envío completo sí la actualiza.",
  );

  await resetGroup();
  const pendingOtherVet = await getAppointment(appointmentId(4));
  assert.equal(pendingOtherVet.status, "REQUESTED");
  await client.updateAdministrativeAppointmentStatus(
    pendingOtherVet.id,
    { status: "CONFIRMED", expectedVersion: pendingOtherVet.version },
    context,
  );
  const confirmedExceptional = await prepareExceptionalSource(4);
  const farTarget = (await publishedSlots(veterinarianId, day(70))).find(
    (slot) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(slot.startsAt)) === "00:30",
  );
  assert.ok(farTarget);
  const farMove = await client.reassignAdministrativeAppointmentVeterinarian(
    confirmedExceptional.id,
    moveIntent(confirmedExceptional, farTarget),
    context,
  );
  assert.equal(farMove.status, "CONFIRMED");
  assert.equal(farMove.assignmentStatus, "ASSIGNED");
  assert.equal(Date.parse(farMove.startsAt), Date.parse(farTarget.startsAt));
  checks.push(
    "Una confirmada NEEDS_REASSIGNMENT admite destino del día70 con acuerdo, sin imponerle el horizonte del propietario.",
  );

  await resetGroup();
  const lostReassignmentSource = await prepareExceptionalSource();
  const lostReassignmentTarget = (
    await publishedSlots(veterinarianId, day(1))
  ).find(
    (slot) =>
      Date.parse(slot.startsAt) === Date.parse(lostReassignmentSource.startsAt),
  );
  assert.ok(lostReassignmentTarget);
  await fixture({ action: "next-mutation", drop: true });
  const reassignmentStart = requests.length;
  await assert.rejects(
    client.reassignAdministrativeAppointmentVeterinarian(
      lostReassignmentSource.id,
      moveIntent(lostReassignmentSource, lostReassignmentTarget, false),
      context,
    ),
    (error) => error.status === 502,
  );
  const lostReassignmentCurrent = await getAppointment(
    lostReassignmentSource.id,
  );
  const lostReassignmentHistory = await getHistory(lostReassignmentSource.id);
  assert.equal(lostReassignmentCurrent.assignmentStatus, "ASSIGNED");
  assert.equal(lostReassignmentCurrent.veterinarianId, veterinarianId);
  assert.equal(
    lostReassignmentCurrent.version,
    lostReassignmentSource.version + 1,
  );
  assert.equal(
    lostReassignmentHistory.items.filter(
      (event) => event.eventType === "REASSIGNED",
    ).length,
    1,
  );
  assert.equal(
    postsSince(reassignmentStart, "veterinarian-reassignments").length,
    1,
  );
  checks.push(
    "Una respuesta 502 perdida tras reasignar se consulta por detalle e historial y no causa un segundo POST automático.",
  );

  const report = {
    simulationOnly: true,
    checkedAtUtc: new Date().toISOString(),
    clientEntryPoint: "packages/api-client/src/index.ts",
    transport:
      "Original fetch over loopback HTTP; observer records only method/path/status. No response stubs.",
    fixtureControlsExcludedFromProductRequestCount: true,
    checks,
    requestCount: requests.length,
    requests,
  };
  await writeFile(
    resolve(runtimeDirectory, "appointment-changes-client-http.json"),
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
