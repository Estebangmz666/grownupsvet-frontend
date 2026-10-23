/** Run the current TypeScript client against local fictitious academic records. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const runtimeDirectory = resolve(repositoryRoot, "postman/.runtime");
await mkdir(runtimeDirectory, { recursive: true });
const bundlePath = resolve(
  runtimeDirectory,
  "veterinarian-qualifications-client.mjs",
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
const allowedOrigins = new Set([origin]);
const originalFetch = globalThis.fetch;
const requests = [];
const rawProtocolRequests = [];
const checks = [];
const binaryTransfers = [];
let context = { token: undefined, generation: 0 };
let unauthorizedCallbacks = 0;
let failure;
let resetFinallySucceeded = false;
function configureOrigin(apiOrigin) {
  client.configureApiClient({
    baseUrl: `${apiOrigin}/api/v1`,
    getRequestContext: () => context,
    isRequestContextCurrent: (captured) =>
      captured.generation === context.generation,
    onUnauthorized: () => {
      unauthorizedCallbacks += 1;
    },
  });
}
configureOrigin(origin);

// Observe metadata and delegate every product request to the original HTTP fetch.
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.ok(allowedOrigins.has(url.origin));
  assert.ok(url.pathname.startsWith("/api/v1/"));
  const record = {
    method:
      options?.method ?? (typeof input === "string" ? "GET" : input.method),
    path: url.pathname + url.search,
    status: null,
    transport:
      url.origin === origin ? "postman-simulation" : "isolated-binary-loopback",
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
  assert.equal(response.status, 204, `Simulation ${path}`);
}
const fixture = (body) => control("fixture", body);
async function rawProtocol(path, init) {
  assert.ok(path.startsWith("/veterinarians/"));
  const record = { method: init.method, path: `/api/v1${path}`, status: null };
  rawProtocolRequests.push(record);
  const response = await originalFetch(`${origin}/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${context.token}`, ...init.headers },
  });
  record.status = response.status;
  return { response, body: await response.json() };
}
async function login(email) {
  const session = await client.login({
    email,
    password: "SimulationOnly!2026",
  });
  context = { token: session.accessToken, generation: context.generation + 1 };
  return session.user;
}
const problem = (status, errorCode) => (error) =>
  error.status === status && error.errorCode === errorCode;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const academicRequest = (title = "Especialización ficticia de transporte") => ({
  type: "SPECIALIZATION",
  title,
  institution: "Institución ficticia de verificación",
  graduationYear: 2020,
});
const countPostsSince = (start) =>
  requests
    .slice(start)
    .filter(
      (record) =>
        record.method === "POST" && record.path.endsWith("/qualifications"),
    ).length;

/** A one-page fixture, optionally carrying non-UTF8 bytes in a legal PDF comment. */
function pdfBytes(label, binaryComment = false) {
  const stream = `BT /F1 12 Tf 40 720 Td (${label}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let bytes = Buffer.concat([
    Buffer.from("%PDF-1.4\n%"),
    binaryComment
      ? Buffer.from([0xe2, 0xe3, 0xcf, 0xd3])
      : Buffer.from("ASCII TRANSPORT FIXTURE"),
    Buffer.from("\n"),
  ]);
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(bytes.length);
    bytes = Buffer.concat([
      bytes,
      Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`),
    ]);
  });
  const start = bytes.length;
  return Buffer.concat([
    bytes,
    Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("")}
trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`),
  ]);
}
const firstPdf = pdfBytes("SIMULATION FIRST - NO ACADEMIC VALIDITY");
const secondPdf = pdfBytes("SIMULATION REPLACEMENT - NO ACADEMIC VALIDITY");
const uploadInput = (bytes = firstPdf, published) => ({
  blob: new Blob([bytes], { type: "application/pdf" }),
  name: "diploma-ficticio.pdf",
  ...(published === undefined ? {} : { published }),
});
async function assertPdf(veterinarianId, qualificationId, expectedBytes) {
  const blob = await client.fetchVeterinarianDiplomaBlob(
    veterinarianId,
    qualificationId,
    context,
  );
  const bytes = Buffer.from(await blob.arrayBuffer());
  binaryTransfers.push({
    uploadedByteCount: expectedBytes.length,
    downloadedByteCount: bytes.length,
    uploadedSha256: sha256(expectedBytes),
    downloadedSha256: sha256(bytes),
    exactByteMatch: expectedBytes.equals(bytes),
    includesNonUtf8PdfComment: expectedBytes.includes(
      Buffer.from([0xe2, 0xe3, 0xcf, 0xd3]),
    ),
    transport: "postman-simulation",
  });
  assert.equal(
    sha256(bytes),
    sha256(expectedBytes),
    "Multipart upload/download must preserve the simulation-compatible PDF bytes",
  );
  assert.deepEqual(bytes, expectedBytes);
}

/** The Postman interceptor decodes multipart as UTF8. Isolate true binary proof. */
async function verifyIsolatedBinaryTransport(veterinarianId, qualificationId) {
  const expected = pdfBytes("BINARY FIXTURE - NO ACADEMIC VALIDITY", true);
  let stored;
  let serverFailure;
  const target = `/api/v1/veterinarians/${veterinarianId}/qualifications/${qualificationId}/diploma`;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://loopback.invalid");
      assert.equal(url.pathname, target);
      assert.ok(
        request.headers.authorization === `Bearer ${context.token}`,
        "Isolated fixture authentication missing",
      );
      if (request.method === "PUT") {
        assert.equal(url.search, "?published=false");
        const contentType = String(request.headers["content-type"] ?? "");
        const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
        assert.ok(boundary, "Real fetch must generate the multipart boundary");
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const multipart = Buffer.concat(chunks);
        const headerEnd = multipart.indexOf(Buffer.from("\r\n\r\n"));
        assert.ok(headerEnd > 0);
        const partHeaders = multipart.subarray(0, headerEnd).toString("ascii");
        assert.ok(
          /content-disposition:[^\r\n]*;\s*name="file"/i.test(partHeaders),
        );
        assert.ok(/content-type:\s*application\/pdf/i.test(partHeaders));
        const end = multipart.indexOf(
          Buffer.from(`\r\n--${boundary[1] ?? boundary[2]}`),
          headerEnd + 4,
        );
        assert.ok(end > headerEnd);
        stored = multipart.subarray(headerEnd + 4, end);
        assert.equal(sha256(stored), sha256(expected));
        response.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        });
        response.end(
          JSON.stringify({
            id: qualificationId,
            type: "SPECIALIZATION",
            title: "Binary fixture",
            institution: "Loopback fixture",
            graduationYear: null,
            isBaseDegree: false,
            diplomaAvailable: true,
            diplomaPublished: false,
          }),
        );
      } else if (request.method === "GET") {
        assert.ok(stored);
        assert.equal(request.headers.accept, "application/pdf");
        response.writeHead(200, {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
        });
        response.end(stored);
      } else {
        throw new Error("Unexpected isolated binary fixture method");
      }
    } catch (error) {
      serverFailure = { name: error.name, message: error.message };
      response.writeHead(500, { "Content-Type": "application/problem+json" });
      response.end(
        JSON.stringify({
          status: 500,
          errorCode: "BINARY_FIXTURE_FAILURE",
          fieldErrors: [],
        }),
      );
    }
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  const binaryOrigin = `http://127.0.0.1:${address.port}`;
  allowedOrigins.add(binaryOrigin);
  configureOrigin(binaryOrigin);
  try {
    await client.uploadVeterinarianDiploma(
      veterinarianId,
      qualificationId,
      uploadInput(expected),
      context,
    );
    const blob = await client.fetchVeterinarianDiplomaBlob(
      veterinarianId,
      qualificationId,
      context,
    );
    const downloaded = Buffer.from(await blob.arrayBuffer());
    assert.equal(serverFailure, undefined);
    assert.deepEqual(downloaded, expected);
    assert.equal(sha256(stored), sha256(downloaded));
    binaryTransfers.push({
      uploadedByteCount: expected.length,
      downloadedByteCount: downloaded.length,
      uploadedSha256: sha256(expected),
      downloadedSha256: sha256(downloaded),
      exactByteMatch: expected.equals(downloaded),
      includesNonUtf8PdfComment: true,
      transport: "isolated-binary-loopback",
    });
    checks.push(
      "El mismo cliente real conserva bytes no UTF8 y SHA-256 al enviar multipart y descargar PDF en un servidor binario loopback separado, sin stubs fetch ni inspección estructural simulada.",
    );
  } finally {
    configureOrigin(origin);
    allowedOrigins.delete(binaryOrigin);
    await new Promise((done) => server.close(done));
  }
}

try {
  await control("reset");
  await login("administrator@roles.test");
  const page = await client.listVeterinarians(
    { page: 0, size: 20 },
    {},
    context,
  );
  const veterinarian = page.items.find((item) => item.status === "ACTIVE");
  const disabledVeterinarian = page.items.find(
    (item) => item.status === "DISABLED",
  );
  assert.ok(veterinarian && disabledVeterinarian);
  const veterinarianId = veterinarian.id;
  const list = () =>
    client.listVeterinarianQualifications(veterinarianId, context);
  const get = (id, captured = context) =>
    client.getVeterinarianQualification(veterinarianId, id, captured);
  const initial = await list();
  assert.equal(initial.length, 1);
  assert.equal(initial[0].isBaseDegree, true);
  const baseDegreeId = initial[0].id;
  assert.equal((await get(baseDegreeId)).id, baseDegreeId);
  checks.push(
    "Lista array y detalle consultan los ocho campos del DTO y el pregrado base, sin inventar paginación.",
  );

  const created = await client.createVeterinarianQualification(
    veterinarianId,
    academicRequest(),
    context,
  );
  assert.equal(created.isBaseDegree, false);
  assert.equal(created.diplomaAvailable, false);
  assert.equal((await get(created.id)).title, academicRequest().title);
  assert.equal((await list()).length, initial.length + 1);
  checks.push(
    "POST201 con Location correcto crea un título adicional consultable por su UUID.",
  );

  await assert.rejects(
    client.updateVeterinarianDiplomaPublication(
      veterinarianId,
      created.id,
      { published: true },
      context,
    ),
    problem(404, "STAFF_RESOURCE_NOT_FOUND"),
  );
  await assert.rejects(
    client.fetchVeterinarianDiplomaBlob(veterinarianId, created.id, context),
    problem(404, "STAFF_RESOURCE_NOT_FOUND"),
  );
  const resource = `/veterinarians/${veterinarianId}/qualifications/${created.id}`;
  const wrongPart = new FormData();
  wrongPart.append(
    "wrong",
    new Blob([firstPdf], { type: "application/pdf" }),
    "file",
  );
  const wrongPartResult = await rawProtocol(`${resource}/diploma`, {
    method: "PUT",
    body: wrongPart,
  });
  assert.equal(wrongPartResult.response.status, 400);
  assert.equal(wrongPartResult.body.errorCode, "INVALID_DIPLOMA");
  const wrongMethod = await rawProtocol(`${resource}/diploma/publication`, {
    method: "GET",
  });
  assert.equal(wrongMethod.response.status, 405);
  assert.equal(wrongMethod.body.errorCode, "METHOD_NOT_ALLOWED");
  const formWithFlag = new FormData();
  formWithFlag.append(
    "file",
    new Blob([firstPdf], { type: "application/pdf" }),
    "diploma.pdf",
  );
  formWithFlag.append("published", "true");
  const formPublication = await rawProtocol(`${resource}/diploma`, {
    method: "PUT",
    body: formWithFlag,
  });
  assert.equal(formPublication.response.status, 200);
  assert.equal(formPublication.body.diplomaPublished, true);
  checks.push(
    "Tres controles HTTP crudos separados del cliente: nombre de parte incorrecto con filename=file falla400, GET publication falla405 y published en campo multipart se acepta como RequestParam.",
  );
  const privateUpload = await client.uploadVeterinarianDiploma(
    veterinarianId,
    created.id,
    uploadInput(),
    context,
  );
  assert.equal(privateUpload.diplomaAvailable, true);
  assert.equal(privateUpload.diplomaPublished, false);
  await assertPdf(veterinarianId, created.id, firstPdf);
  checks.push(
    "Multipart real conserva SHA-256 del PDF ASCII compatible con Postman; la carga sin published explícito queda privada.",
  );

  const published = await client.updateVeterinarianDiplomaPublication(
    veterinarianId,
    created.id,
    { published: true },
    context,
  );
  assert.equal(published.diplomaPublished, true);
  const unchanged = await client.updateVeterinarianQualification(
    veterinarianId,
    created.id,
    academicRequest(),
    context,
  );
  assert.equal(unchanged.diplomaPublished, true);
  const edited = await client.updateVeterinarianQualification(
    veterinarianId,
    created.id,
    academicRequest("Título ficticio corregido"),
    context,
  );
  assert.equal(edited.diplomaPublished, false);
  assert.equal(edited.diplomaAvailable, true);
  await assertPdf(veterinarianId, created.id, firstPdf);
  checks.push(
    "Publicación explícita requiere archivo; PUT académico sin cambios conserva publicación y cambiar datos la retira sin borrar el PDF.",
  );

  const replaced = await client.uploadVeterinarianDiploma(
    veterinarianId,
    created.id,
    uploadInput(secondPdf),
    context,
  );
  assert.equal(replaced.diplomaPublished, false);
  await assertPdf(veterinarianId, created.id, secondPdf);
  const reviewedReplacement = await client.uploadVeterinarianDiploma(
    veterinarianId,
    created.id,
    uploadInput(firstPdf, true),
    context,
  );
  assert.equal(reviewedReplacement.diplomaPublished, true);
  await client.updateVeterinarianDiplomaPublication(
    veterinarianId,
    created.id,
    { published: false },
    context,
  );
  assert.equal((await get(created.id)).diplomaPublished, false);
  checks.push(
    "Reemplazar carga bytes nuevos y reinicia publicación a privado; true explícito publica y PATCHfalse retira publicación.",
  );

  for (const [errorCode, status] of [
    ["INVALID_DIPLOMA", 400],
    ["DIPLOMA_VALIDATION_BUSY", 503],
    ["DIPLOMA_VALIDATION_UNAVAILABLE", 503],
    ["DIPLOMA_VALIDATION_INTERRUPTED", 503],
  ]) {
    await fixture({ action: "next-diploma-validation", errorCode });
    const start = requests.length;
    await assert.rejects(
      client.uploadVeterinarianDiploma(
        veterinarianId,
        created.id,
        uploadInput(secondPdf, true),
        context,
      ),
      problem(status, errorCode),
    );
    assert.equal(requests.length - start, 1);
    assert.equal((await get(created.id)).diplomaPublished, false);
    await assertPdf(veterinarianId, created.id, firstPdf);
  }
  checks.push(
    "Fallos400/503 de validación inyectados conservan archivo/publicación previa y no generan reintento automático; no se atribuye inspección estructural al mock.",
  );

  await client.deleteVeterinarianDiploma(veterinarianId, created.id, context);
  await client.deleteVeterinarianDiploma(veterinarianId, created.id, context);
  const withoutDiploma = await get(created.id);
  assert.equal(withoutDiploma.diplomaAvailable, false);
  assert.equal(withoutDiploma.diplomaPublished, false);
  await assert.rejects(
    client.fetchVeterinarianDiplomaBlob(veterinarianId, created.id, context),
    problem(404, "STAFF_RESOURCE_NOT_FOUND"),
  );
  await client.deleteVeterinarianQualification(
    veterinarianId,
    created.id,
    context,
  );
  await assert.rejects(
    get(created.id),
    problem(404, "STAFF_RESOURCE_NOT_FOUND"),
  );
  checks.push(
    "DELETE diploma204 es repetible y conserva el título; DELETE título adicional204 elimina su recurso.",
  );

  await assert.rejects(
    client.deleteVeterinarianQualification(
      veterinarianId,
      baseDegreeId,
      context,
    ),
    problem(409, "BASE_DEGREE_REQUIRED"),
  );
  await assert.rejects(
    client.updateVeterinarianQualification(
      veterinarianId,
      baseDegreeId,
      academicRequest(),
      context,
    ),
    problem(409, "BASE_DEGREE_REQUIRED"),
  );
  assert.deepEqual(await get(baseDegreeId), initial[0]);
  checks.push(
    "El servidor rechaza borrar el título base o cambiar su tipo a especialización; el pregrado queda intacto.",
  );

  const disabledInitial = await client.listVeterinarianQualifications(
    disabledVeterinarian.id,
    context,
  );
  const disabledCreated = await client.createVeterinarianQualification(
    disabledVeterinarian.id,
    academicRequest("Formación de veterinario inactivo"),
    context,
  );
  assert.equal(
    (
      await client.listVeterinarianQualifications(
        disabledVeterinarian.id,
        context,
      )
    ).length,
    disabledInitial.length + 1,
  );
  await client.deleteVeterinarianQualification(
    disabledVeterinarian.id,
    disabledCreated.id,
    context,
  );
  checks.push(
    "ADMIN puede gestionar formación de un veterinario DISABLED; no se inventa un bloqueo por estado del destinatario.",
  );

  await fixture({
    action: "prepare-qualifications",
    veterinarianId,
    count: 20,
  });
  const twenty = await list();
  assert.equal(twenty.length, 20);
  const startAtLimit = requests.length;
  await assert.rejects(
    client.createVeterinarianQualification(
      veterinarianId,
      academicRequest(),
      context,
    ),
    problem(409, "QUALIFICATION_LIMIT_REACHED"),
  );
  assert.equal(countPostsSince(startAtLimit), 1);
  assert.equal((await list()).length, 20);
  await client.deleteVeterinarianQualification(
    veterinarianId,
    twenty[19].id,
    context,
  );
  await client.createVeterinarianQualification(
    veterinarianId,
    academicRequest(),
    context,
  );
  assert.equal((await list()).length, 20);
  checks.push(
    "El límite es20 contando el base: el título21 falla409 sin cambios; tras borrar uno vuelve a permitirse crear.",
  );

  await fixture({ action: "prepare-qualifications", veterinarianId, count: 1 });
  for (const mode of ["drop", "empty", "invalid-json", "timeout"]) {
    const before = await list();
    await fixture({
      action: "next-mutation",
      ...(mode === "drop" ? { drop: true } : { responseMode: mode }),
    });
    const start = requests.length;
    const title = `Alta ficticia con respuesta ${mode}`;
    await assert.rejects(
      client.createVeterinarianQualification(
        veterinarianId,
        academicRequest(title),
        context,
      ),
      (error) => {
        if (mode === "drop")
          return error.status === 502 || error.name === "TypeError";
        if (mode === "empty")
          return error.status === 201 && error.errorCode === "EMPTY_RESPONSE";
        if (mode === "invalid-json")
          return (
            error.status === 201 && error.errorCode === "INVALID_JSON_RESPONSE"
          );
        return (
          error.status === 408 &&
          error.errorCode === "SIMULATION_RESPONSE_TIMEOUT"
        );
      },
    );
    assert.equal(countPostsSince(start), 1);
    const after = await list();
    assert.equal(after.length, before.length + 1);
    assert.equal(after.filter((item) => item.title === title).length, 1);
    checks.push(
      `Alta aplicada con respuesta ${mode}: un solo POST y consulta explícita muestra el registro adicional; sin reenvío ni garantía de atribución fuera de esta fixture aislada.`,
    );
  }

  for (const [mode, status, errorCode] of [
    ["unavailable", 503, "SIMULATION_TEMPORARY_UNAVAILABLE"],
    ["forbidden", 403, "ACCESS_DENIED"],
    ["html", 200, "UNEXPECTED_QUALIFICATION_RESPONSE"],
    ["extra-field", 200, "INVALID_QUALIFICATION_RESPONSE"],
    ["foreign", 200, "INVALID_QUALIFICATION_RESPONSE"],
  ]) {
    await fixture({ action: "next-qualification-read", veterinarianId, mode });
    const start = requests.length;
    await assert.rejects(get(baseDegreeId), problem(status, errorCode));
    assert.equal(requests.length - start, 1);
    assert.equal(unauthorizedCallbacks, 0);
    assert.equal((await get(baseDegreeId)).id, baseDegreeId);
  }
  checks.push(
    "503/403, HTML200, campo privado extra e identidad ajena se rechazan sin reintentos ni cierre oculto de sesión; GET explícito se recupera.",
  );

  await fixture({
    action: "next-qualification-read",
    veterinarianId,
    mode: "html",
  });
  await assert.rejects(
    client.fetchVeterinarianDiplomaBlob(veterinarianId, baseDegreeId, context),
    problem(200, "INVALID_DIPLOMA_RESPONSE"),
  );
  checks.push("Una respuesta HTML200 no se presenta como PDF administrativo.");

  await fixture({
    action: "next-qualification-read",
    veterinarianId,
    mode: "normal",
    delayMs: 350,
  });
  const captured = context;
  const lateRead = get(baseDegreeId, captured);
  await new Promise((done) => setTimeout(done, 75));
  context = { token: captured.token, generation: captured.generation + 1 };
  await assert.rejects(
    lateRead,
    (error) => error.name === "StaleSessionRequestError",
  );
  assert.equal((await get(baseDegreeId)).id, baseDegreeId);
  checks.push(
    "GET HTTP demorado de una sesión anterior no alcanza la sesión actual; la nueva consulta conserva acceso autorizado.",
  );

  await fixture({ action: "next-mutation", delayMs: 350 });
  const beforeLateWrite = await list();
  const capturedWrite = context;
  const lateWriteStart = requests.length;
  const lateWrite = client.createVeterinarianQualification(
    veterinarianId,
    academicRequest("Alta de sesión anterior"),
    capturedWrite,
  );
  await new Promise((done) => setTimeout(done, 75));
  context = { token: undefined, generation: capturedWrite.generation + 1 };
  await assert.rejects(
    lateWrite,
    (error) => error.name === "StaleSessionRequestError",
  );
  assert.equal(countPostsSince(lateWriteStart), 1);
  await login("administrator@roles.test");
  assert.equal((await list()).length, beforeLateWrite.length + 1);
  checks.push(
    "Una creación aplicada cuyo recibo llega después del cambio de sesión se descarta; no se reintenta y una nueva sesión consulta la colección.",
  );

  const beforeInvalid = requests.length;
  await assert.rejects(
    client.createVeterinarianQualification(
      veterinarianId,
      academicRequest(" ".repeat(201)),
      context,
    ),
    RangeError,
  );
  await assert.rejects(
    client.getVeterinarianQualification(veterinarianId, "bad/id", context),
    RangeError,
  );
  await assert.rejects(
    client.uploadVeterinarianDiploma(
      veterinarianId,
      baseDegreeId,
      { blob: new Blob(["bad"], { type: "text/html" }), name: "bad.pdf" },
      context,
    ),
    RangeError,
  );
  await assert.rejects(
    get(baseDegreeId, capturedWrite),
    (error) => error.name === "StaleSessionRequestError",
  );
  assert.equal(requests.length, beforeInvalid);
  checks.push(
    "Texto fuera de límite, UUID inválido, archivo no PDF y contexto obsoleto se rechazan antes de cualquier HTTP.",
  );
  await verifyIsolatedBinaryTransport(veterinarianId, baseDegreeId);

  for (const email of [
    "owner@roles.test",
    "veterinarian@roles.test",
    "superadmin@roles.test",
    "read-only-administrator@roles.test",
  ]) {
    await login(email);
    await assert.rejects(list(), problem(403, "ACCESS_DENIED"));
  }
  context = { token: undefined, generation: context.generation + 1 };
  await assert.rejects(list(), (error) => error.status === 401);
  assert.equal(unauthorizedCallbacks, 0);
  checks.push(
    "OWNER, VET, SUPER_ADMIN y ADMIN sin VETERINARIAN_MANAGE reciben403; sin sesión401 y no se heredan permisos.",
  );
} catch (error) {
  failure = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  context = { token: undefined, generation: context.generation + 1 };
  try {
    await control("reset");
    resetFinallySucceeded = true;
  } catch (error) {
    failure ??= { name: error.name, message: "Final simulation reset failed" };
    process.exitCode = 1;
  } finally {
    globalThis.fetch = originalFetch;
  }
  const report = {
    simulationOnly: true,
    checkedAtUtc: new Date().toISOString(),
    allChecksPassed: failure === undefined,
    clientEntryPoint: "packages/api-client/src/index.ts",
    transport:
      "Original fetch to loopback HTTP. Observer delegates without modifying requests or responses; records method/path/status only.",
    fixtureControlsExcludedFromProductRequestCount: true,
    structuralPdfInspectionClaimed: false,
    ownerDirectoryOrPublicDiplomaTested: false,
    postmanMultipartLimitation:
      "The Postman interceptor decodes request bodies as UTF8, so port4900 exercises valid ASCII-only PDF fixtures. Non-UTF8 byte identity is proved separately over the isolated binary loopback server. The original failing SHA comparison is preserved as client-http-first-attempt.json.",
    delayedResponseScope:
      "Server fixtures delay before headers. Unit tests separately cover changes during response.text/blob consumption.",
    unauthorizedCallbacks,
    resetFinallySucceeded,
    checks,
    binaryTransfers,
    requestCount: requests.length,
    requests,
    rawProtocolRequestCount: rawProtocolRequests.length,
    rawProtocolRequests,
    ...(failure ? { failure } : {}),
  };
  await writeFile(
    resolve(runtimeDirectory, "veterinarian-qualifications-client-http.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    JSON.stringify(
      {
        allChecksPassed: report.allChecksPassed,
        checkCount: checks.length,
        requestCount: requests.length,
        resetFinallySucceeded,
        ...(failure ? { failure } : {}),
      },
      null,
      2,
    ) + "\n",
  );
}
