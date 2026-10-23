/** Local-only stand-in derived from OpenAPI 0.9.0 and UserPermissionResolver.
 * All accounts and JWTs are fictitious. Unsupported operations return 501.
 * Nothing is forwarded to the deployed backend.
 */
const http = require("node:http");
const { randomUUID, randomBytes } = require("node:crypto");
const STATE_PREFIX = "grownupsvet.roles.";
const PASSWORD = "SimulationOnly!2026";
const TIME_ZONE = "America/Bogota";
const EXPIRES_IN_SECONDS = 3600;
let generation = randomUUID();

const permissions = {
  OWNER: [
    "PROFILE_READ_SELF",
    "PROFILE_UPDATE_SELF",
    "PROFILE_DEACTIVATE_SELF",
    "PROFILE_PHOTO_READ_SELF",
    "PROFILE_PHOTO_UPDATE_SELF",
    "PET_CREATE_SELF",
    "PET_READ_SELF",
    "PET_UPDATE_SELF",
    "VETERINARIAN_PROFILE_READ",
    "VETERINARIAN_AVAILABILITY_READ_AVAILABLE",
    "APPOINTMENT_CREATE_SELF",
    "APPOINTMENT_READ_SELF",
  ],
  VETERINARIAN: [
    "PROFILE_PHOTO_READ_SELF",
    "PROFILE_PHOTO_UPDATE_SELF",
    "VETERINARIAN_AVAILABILITY_READ_SELF",
    "APPOINTMENT_READ_ASSIGNED",
    "APPOINTMENT_OWNER_EMAIL_READ",
  ],
  ADMINISTRATOR: [
    "PROFILE_PHOTO_READ_SELF",
    "PROFILE_PHOTO_UPDATE_SELF",
    "VETERINARIAN_MANAGE",
    "VETERINARIAN_AVAILABILITY_MANAGE",
    "APPOINTMENT_READ_ALL",
    "APPOINTMENT_MANAGE",
  ],
  SUPER_ADMIN: [
    "PROFILE_PHOTO_READ_SELF",
    "PROFILE_PHOTO_UPDATE_SELF",
    "ADMINISTRATOR_MANAGE",
  ],
};
const accounts = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@roles.test",
    role: "SUPER_ADMIN",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    email: "administrator@roles.test",
    role: "ADMINISTRATOR",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    email: "veterinarian@roles.test",
    role: "VETERINARIAN",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    email: "owner@roles.test",
    role: "OWNER",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    email: "other-owner@roles.test",
    role: "OWNER",
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    email: "missing-permission@roles.test",
    role: "SUPER_ADMIN",
    permissions: [],
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    email: "forbidden@roles.test",
    role: "SUPER_ADMIN",
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    email: "flaky-administrator@roles.test",
    role: "ADMINISTRATOR",
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    email: "unavailable-superadmin@roles.test",
    role: "SUPER_ADMIN",
  },
  {
    id: "00000000-0000-4000-8000-000000000010",
    email: "unavailable-administrator@roles.test",
    role: "ADMINISTRATOR",
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    email: "read-only-administrator@roles.test",
    role: "ADMINISTRATOR",
    permissions: ["APPOINTMENT_READ_ALL"],
  },
].map((account) => ({
  ...account,
  permissions: account.permissions ?? permissions[account.role],
}));
const statuses = ["ACTIVE", "PENDING_ACTIVATION", "DISABLED"];
const recordId = (prefix, index) =>
  `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
const timestamps = (index) => ({
  createdAt: `2026-09-${String(30 - index).padStart(2, "0")}T14:00:00Z`,
  updatedAt: "2026-10-20T14:00:00Z",
});
const nameSuffixes = [
  "Uno",
  "Dos",
  "Tres",
  "Cuatro",
  "Cinco",
  "Seis",
  "Siete",
  "Ocho",
  "Nueve",
  "Diez",
  "Once",
  "Doce",
  "Trece",
  "Catorce",
  "Quince",
  "Dieciséis",
  "Diecisiete",
  "Dieciocho",
  "Diecinueve",
  "Veinte",
  "Veintiuno",
  "Veintidós",
  "Veintitrés",
  "Veinticuatro",
  "Veinticinco",
];
const administrators = Array.from({ length: 23 }, (_, index) => ({
  id: index === 0 ? accounts[1].id : recordId("a1000000", index + 1),
  email:
    index === 0 ? accounts[1].email : `administrator-${index + 1}@roles.test`,
  fullName: `Administrador de simulación ${nameSuffixes[index]}`,
  status: statuses[index % statuses.length],
  ...timestamps(index),
}));
const veterinarians = Array.from({ length: 25 }, (_, index) => ({
  id: index === 0 ? accounts[2].id : recordId("b1000000", index + 1),
  fullName: `Veterinario de simulación ${nameSuffixes[index]}`,
  professionalPhoneNumber: "+573001234567",
  professionalRegistrationNumber: `SIM-${String(index + 1).padStart(4, "0")}`,
  baseDegreeTitle: "Medicina veterinaria",
  baseDegreeInstitution: "Institución de simulación",
  biography: null,
  email:
    index === 0 ? accounts[2].email : `veterinarian-${index + 1}@roles.test`,
  status: statuses[index % statuses.length],
  qualifications: [
    {
      id: recordId("e1000000", index + 1),
      type: "UNDERGRADUATE",
      title: "Medicina veterinaria",
      institution: "Institución de simulación",
      graduationYear: null,
      isBaseDegree: true,
      diplomaAvailable: index === 0,
      diplomaPublished: index === 0,
    },
  ],
  ...timestamps(index),
}));
const initialAdministrators = structuredClone(administrators);
const initialVeterinarians = structuredClone(veterinarians);
const users = new Map();
const invitations = [];
let nextMutation = null;
let nextAuthentication = null;
const ownerProfiles = new Map();
const recoveryChallenges = new Map();
const recoveryRequestTimes = new Map();
let expandedPetOwnerId = null;
const availabilitySlots = [];
const availabilityEvents = [];
const occupiedAvailabilitySlots = new Set();
const referencedAvailabilitySlots = new Set();
let storedAppointments = null;
const appointmentEvents = [];
const appointmentMetadata = new Map();
let appointmentChangesPrepared = false;
const appointmentNotifications = [];
let nextNotificationRead = null;

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };
}
function issueInvitation(user, createdAt = Date.now()) {
  const invitation = {
    invitationId: randomUUID(),
    userId: user.id,
    token: randomBytes(32).toString("base64url"),
    createdAt,
    expiresAt: createdAt + 48 * 60 * 60 * 1000,
    status: "PENDING",
  };
  invitations.push(invitation);
  return invitation;
}
function invitationResponse(invitation) {
  return {
    invitationId: invitation.invitationId,
    userId: invitation.userId,
    expiresAt: new Date(invitation.expiresAt).toISOString(),
    deliveryStatus: "PENDING",
  };
}
function invalidateInvitations(userId) {
  invitations
    .filter((item) => item.userId === userId && item.status === "PENDING")
    .forEach((item) => {
      item.status = "CANCELLED";
    });
}
function resetData() {
  generation = randomUUID();
  administrators.splice(
    0,
    administrators.length,
    ...structuredClone(initialAdministrators),
  );
  veterinarians.splice(
    0,
    veterinarians.length,
    ...structuredClone(initialVeterinarians),
  );
  users.clear();
  invitations.length = 0;
  nextMutation = null;
  nextAuthentication = null;
  ownerProfiles.clear();
  recoveryChallenges.clear();
  recoveryRequestTimes.clear();
  expandedPetOwnerId = null;
  storedAppointments = null;
  appointmentEvents.length = 0;
  appointmentMetadata.clear();
  appointmentChangesPrepared = false;
  appointmentNotifications.length = 0;
  nextNotificationRead = null;
  for (const account of accounts)
    users.set(account.id, {
      ...account,
      status: "ACTIVE",
      password: PASSWORD,
      authenticationVersion: 0,
    });
  for (const [records, role] of [
    [administrators, "ADMINISTRATOR"],
    [veterinarians, "VETERINARIAN"],
  ]) {
    for (const record of records) {
      const user = users.get(record.id) ?? {
        id: record.id,
        email: record.email,
        role,
        permissions: permissions[role],
        authenticationVersion: 0,
      };
      user.status = record.status;
      user.password = record.status === "PENDING_ACTIVATION" ? null : PASSWORD;
      users.set(user.id, user);
      if (record.status === "PENDING_ACTIVATION")
        issueInvitation(user, Date.now() - 61_000);
    }
  }
  resetAvailability();
}
resetData();
const pets = [
  {
    id: recordId("c1000000", 1),
    ownerId: accounts[3].id,
    name: "Luna de simulación",
    species: "DOG",
    active: true,
  },
  {
    id: recordId("c1000000", 2),
    ownerId: accounts[3].id,
    name: "Milo de simulación",
    species: "CAT",
    active: false,
  },
  {
    id: recordId("c1000000", 3),
    ownerId: accounts[4].id,
    name: "Nala de simulación",
    species: "DOG",
    active: true,
  },
].map((pet) => ({
  ...pet,
  breed: null,
  sex: "FEMALE",
  dateOfBirth: "2021-04-10",
  dateOfBirthEstimated: false,
  createdAt: "2026-09-20T14:00:00Z",
  updatedAt: "2026-10-20T14:00:00Z",
}));

function businessDate(now = Date.now()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(
    new Date(now),
  );
}
function shiftedBusinessDate(days) {
  return new Date(Date.parse(`${businessDate()}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function availabilityEvent(slot, actorId, eventType, previous, reason = null) {
  return {
    id: randomUUID(),
    slotId: slot.id,
    slotVersion: slot.version,
    actorId,
    occurredAt: new Date().toISOString(),
    eventType,
    previousStartsAt: previous?.startsAt ?? null,
    previousEndsAt: previous?.endsAt ?? null,
    previousStatus: previous?.status ?? null,
    newStartsAt: slot.startsAt,
    newEndsAt: slot.endsAt,
    newStatus: slot.status,
    reason,
  };
}
function newAvailabilitySlot(veterinarianId, start, id = randomUUID()) {
  return {
    id,
    veterinarianId,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 30 * 60000).toISOString(),
    status: "PUBLISHED",
    version: 0,
    timeZone: TIME_ZONE,
  };
}
function resetAvailability() {
  availabilitySlots.length = 0;
  availabilityEvents.length = 0;
  occupiedAvailabilitySlots.clear();
  referencedAvailabilitySlots.clear();
  // Explicit fictitious states for UI conflict checks; no real appointment is created.
  const tomorrow = shiftedBusinessDate(1);
  for (let index = 0; index < 4; index += 1) {
    const slot = newAvailabilitySlot(
      veterinarians[0].id,
      Date.parse(`${tomorrow}T14:00:00Z`) + index * 30 * 60000,
      recordId("f1000000", index + 1),
    );
    availabilityEvents.push(availabilityEvent(slot, accounts[1].id, "CREATED"));
    if (index === 1) {
      const previous = { ...slot };
      slot.status = "BLOCKED";
      slot.version = 1;
      availabilityEvents.push(
        availabilityEvent(
          slot,
          accounts[1].id,
          "BLOCKED",
          previous,
          "Bloqueo ficticio inicial",
        ),
      );
    }
    if (index === 2) occupiedAvailabilitySlots.add(slot.id);
    if (index >= 2) referencedAvailabilitySlots.add(slot.id);
    availabilitySlots.push(slot);
  }
  const past = newAvailabilitySlot(
    veterinarians[0].id,
    Date.parse(`${shiftedBusinessDate(-1)}T14:00:00Z`),
    recordId("f1000000", 5),
  );
  availabilitySlots.push(past);
  availabilityEvents.push(availabilityEvent(past, accounts[1].id, "CREATED"));
  const other = newAvailabilitySlot(
    veterinarians[3].id,
    Date.parse(`${tomorrow}T14:00:00Z`),
    recordId("f1000000", 6),
  );
  availabilitySlots.push(other);
  availabilityEvents.push(availabilityEvent(other, accounts[1].id, "CREATED"));
}
function appointmentRecords() {
  if (storedAppointments) return storedAppointments;
  const day = businessDate();
  const initial = [0, 1].map((index) => ({
    id: recordId("d1000000", index + 1),
    ownerId: accounts[index === 0 ? 3 : 4].id,
    ownerFullName: `Propietario de simulación ${index + 1}`,
    ownerPhoneNumber: "+573001234567",
    petId: pets[index === 0 ? 0 : 2].id,
    petName: pets[index === 0 ? 0 : 2].name,
    veterinarianId: veterinarians[index === 0 ? 0 : 3].id,
    veterinarianFullName: veterinarians[index === 0 ? 0 : 3].fullName,
    status: index === 0 ? "CONFIRMED" : "REQUESTED",
    assignmentStatus: "ASSIGNED",
    reason: "Consulta ficticia para comprobar la integración web",
    startsAt: `${day}T${index === 0 ? "14" : "15"}:00:00Z`,
    endsAt: `${day}T${index === 0 ? "14" : "15"}:30:00Z`,
    version: 0,
    createdAt: "2026-10-20T14:00:00Z",
    updatedAt: "2026-10-20T14:00:00Z",
    timeZone: TIME_ZONE,
  }));
  const tomorrow = shiftedBusinessDate(1);
  for (let index = 0; index < 25; index += 1) {
    const ownerIndex = index % 2 === 0 ? 3 : 4;
    const pet = pets[ownerIndex === 3 ? 0 : 2];
    const veterinarian = veterinarians[index % 2 === 0 ? 0 : 3];
    const startsAt = Date.parse(`${tomorrow}T13:00:00Z`) + index * 1_800_000;
    initial.push({
      ...initial[0],
      id: recordId("d1000000", index + 3),
      ownerId: accounts[ownerIndex].id,
      ownerFullName: `Propietario de simulación ${ownerIndex === 3 ? 1 : 2}`,
      petId: pet.id,
      petName: `${pet.name} · solicitud ${index + 1}`,
      veterinarianId: veterinarian.id,
      veterinarianFullName: veterinarian.fullName,
      status: index % 6 === 0 ? "CONFIRMED" : "REQUESTED",
      assignmentStatus: index === 23 ? "NEEDS_REASSIGNMENT" : "ASSIGNED",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(startsAt + 1_800_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  storedAppointments = initial;
  for (const appointment of storedAppointments) {
    appointmentMetadata.set(appointment.id, {
      slotId: randomUUID(),
      cutoffAt: Date.parse(
        `${businessDate(Date.parse(appointment.startsAt))}T11:00:00Z`,
      ),
      participantInactive: false,
      lastStatusOperation: null,
      moveOperations: new Map(),
    });
    appointmentEvents.push(
      appointmentEvent(
        appointment,
        "REQUESTED",
        appointment.ownerId,
        null,
        appointment.reason,
      ),
    );
    if (appointment.status === "CONFIRMED") {
      appointment.version = 1;
      appointmentEvents.push(
        appointmentEvent(appointment, "CONFIRMED", accounts[1].id, "REQUESTED"),
      );
    }
  }
  return storedAppointments;
}

function appointmentEvent(
  appointment,
  eventType,
  actorId,
  previousStatus,
  reason = null,
) {
  const metadata = appointmentMetadata.get(appointment.id);
  return {
    id: randomUUID(),
    appointmentId: appointment.id,
    appointmentVersion: appointment.version,
    eventType,
    actorType: actorId ? "HUMAN" : "SYSTEM",
    actorId,
    previousStatus,
    newStatus: eventType === "REQUESTED" ? "REQUESTED" : appointment.status,
    previousAssignmentStatus:
      previousStatus === null ? null : appointment.assignmentStatus,
    newAssignmentStatus: appointment.assignmentStatus,
    previousSlotId: previousStatus === null ? null : metadata.slotId,
    newSlotId: metadata.slotId,
    reason,
    occurredAt: new Date().toISOString(),
  };
}

function canReadAppointment(user, appointment) {
  return (
    (user.role === "ADMINISTRATOR" &&
      user.permissions.includes("APPOINTMENT_READ_ALL")) ||
    (user.role === "OWNER" &&
      user.permissions.includes("APPOINTMENT_READ_SELF") &&
      appointment.ownerId === user.id) ||
    (user.role === "VETERINARIAN" &&
      user.permissions.includes("APPOINTMENT_READ_ASSIGNED") &&
      appointment.veterinarianId === user.id)
  );
}

// Match String.strip/isBlank in the Java contract, excluding nonbreaking spaces.
function normalizedAppointmentReason(reason) {
  return (
    reason?.replace(
      /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+$/g,
      "",
    ) || null
  );
}

function prepareAppointmentChanges() {
  if (appointmentChangesPrepared) return;
  appointmentChangesPrepared = true;
  // Opt-in local fixture: wire the independent appointment seeds to schedule rows.
  for (const appointment of appointmentRecords()) {
    let slot = availabilitySlots.find(
      (item) =>
        item.veterinarianId === appointment.veterinarianId &&
        Date.parse(item.startsAt) === Date.parse(appointment.startsAt),
    );
    if (!slot) {
      slot = newAvailabilitySlot(
        appointment.veterinarianId,
        Date.parse(appointment.startsAt),
      );
      availabilitySlots.push(slot);
    }
    const metadata = appointmentMetadata.get(appointment.id);
    const oldSlotId = metadata.slotId;
    metadata.slotId = slot.id;
    for (const event of appointmentEvents.filter(
      (item) => item.appointmentId === appointment.id,
    )) {
      if (event.previousSlotId === oldSlotId) event.previousSlotId = slot.id;
      if (event.newSlotId === oldSlotId) event.newSlotId = slot.id;
    }
    referencedAvailabilitySlots.add(slot.id);
    if (["REQUESTED", "CONFIRMED"].includes(appointment.status))
      occupiedAvailabilitySlots.add(slot.id);
  }
  for (const veterinarian of [veterinarians[0], veterinarians[3]]) {
    for (let index = 0; index < 26; index += 1) {
      const slot = newAvailabilitySlot(
        veterinarian.id,
        Date.parse(`${shiftedBusinessDate(3)}T13:00:00Z`) + index * 1_800_000,
      );
      if (index === 25) slot.status = "BLOCKED";
      availabilitySlots.push(slot);
      availabilityEvents.push(
        availabilityEvent(slot, accounts[1].id, "CREATED"),
      );
    }
  }
  for (const day of [shiftedBusinessDate(1), shiftedBusinessDate(70)])
    availabilitySlots.push(
      newAvailabilitySlot(
        veterinarians[0].id,
        Date.parse(`${day}T00:30:00-05:00`),
      ),
    );
  availabilitySlots.push(
    newAvailabilitySlot(
      veterinarians[0].id,
      Date.parse(`${shiftedBusinessDate(1)}T19:30:00-05:00`),
    ),
  );
}

function releaseAppointmentSlot(appointment, slotId) {
  if (
    !appointmentRecords().some(
      (item) =>
        item.id !== appointment.id &&
        ["REQUESTED", "CONFIRMED"].includes(item.status) &&
        appointmentMetadata.get(item.id).slotId === slotId,
    )
  )
    occupiedAvailabilitySlots.delete(slotId);
}

function strictAgreementInstant(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    )
  )
    return false;
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value);
  if (
    offset &&
    (Number(offset[2]) > 18 ||
      (Number(offset[2]) === 18 && Number(offset[3]) !== 0))
  )
    return false;
  return (
    Number.isFinite(Date.parse(value)) &&
    new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) ===
      value.slice(0, 10)
  );
}

function canonicalAgreementInstant(value) {
  if (value === undefined || value === null) return null;
  const fraction = /\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/.exec(value)?.[1] ?? "";
  const seconds =
    Date.parse(value.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/, "")) / 1000;
  return `${seconds}:${fraction.padEnd(9, "0")}`;
}

async function handleAppointmentMove(
  response,
  bodyPromise,
  appointmentId,
  operation,
  user,
) {
  const fail = (status, code, message) =>
    problem(response, status, code, message);
  if (
    user.role !== "ADMINISTRATOR" ||
    !user.permissions.includes("APPOINTMENT_MANAGE")
  )
    return fail(403, "ACCESS_DENIED", "El rol no permite cambiar esta cita.");
  const body = await bodyPromise;
  if (
    !objectWithFields(body, [
      "clientRequestId",
      "availabilitySlotId",
      "expectedAvailabilitySlotVersion",
      "expectedVersion",
      "reason",
      "agreementChannel",
      "agreementContactedAt",
      "agreementNote",
    ])
  )
    return fail(
      400,
      "UNKNOWN_PROPERTY",
      "La estructura del cambio no es válida.",
    );
  const uuid = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  const reason =
    typeof body.reason === "string"
      ? normalizedAppointmentReason(body.reason)
      : null;
  if (
    !uuid(body.clientRequestId) ||
    !uuid(body.availabilitySlotId) ||
    !Number.isSafeInteger(body.expectedVersion) ||
    body.expectedVersion < 0 ||
    !Number.isSafeInteger(body.expectedAvailabilitySlotVersion) ||
    body.expectedAvailabilitySlotVersion < 0 ||
    !reason ||
    body.reason.length > 1000 ||
    (body.agreementNote !== undefined &&
      body.agreementNote !== null &&
      (typeof body.agreementNote !== "string" ||
        body.agreementNote.length > 500)) ||
    (body.agreementChannel !== undefined &&
      body.agreementChannel !== null &&
      !["PHONE", "WHATSAPP", "OTHER"].includes(body.agreementChannel))
  )
    return fail(
      400,
      "VALIDATION_FAILED",
      "Revisa destino, versiones, motivo y acuerdo.",
    );
  if (
    body.agreementContactedAt !== undefined &&
    body.agreementContactedAt !== null &&
    !strictAgreementInstant(body.agreementContactedAt)
  )
    return fail(
      400,
      "TYPE_MISMATCH",
      "La fecha de contacto necesita un texto ISO 8601 con offset.",
    );
  const agreementShape = () =>
    ["PHONE", "WHATSAPP", "OTHER"].includes(body.agreementChannel) &&
    strictAgreementInstant(body.agreementContactedAt) &&
    typeof body.agreementNote === "string" &&
    !!normalizedAppointmentReason(body.agreementNote) &&
    body.agreementNote.length <= 500;
  if (operation === "RESCHEDULING" && !agreementShape())
    return fail(
      400,
      "VALIDATION_FAILED",
      "Registra el acuerdo previo completo.",
    );
  if (
    operation === "RESCHEDULING" &&
    Date.parse(body.agreementContactedAt) > Date.now()
  )
    return fail(
      400,
      "INVALID_APPOINTMENT_REQUEST",
      "El contacto no puede ser futuro.",
    );
  const appointment = appointmentRecords().find(
    (item) => item.id === appointmentId,
  );
  if (!appointment)
    return fail(404, "APPOINTMENT_NOT_FOUND", "La cita no existe.");
  const metadata = appointmentMetadata.get(appointment.id);
  const fingerprint = JSON.stringify([
    ...(operation === "RESCHEDULING" ? [user.id] : []),
    body.availabilitySlotId.toLowerCase(),
    body.expectedAvailabilitySlotVersion,
    body.expectedVersion,
    reason,
    body.agreementChannel ?? null,
    canonicalAgreementInstant(body.agreementContactedAt),
    body.agreementNote === null || body.agreementNote === undefined
      ? ""
      : (normalizedAppointmentReason(body.agreementNote) ?? ""),
  ]);
  const operationKey = operation + ":" + body.clientRequestId.toLowerCase();
  const previous = metadata.moveOperations.get(operationKey);
  if (previous !== undefined) {
    if (previous !== fingerprint)
      return fail(
        409,
        "APPOINTMENT_IDEMPOTENCY_CONFLICT",
        "La clave ya identifica otra intención de cambio.",
      );
    return mutationResponse(response, 200, structuredClone(appointment));
  }
  if (appointment.version !== body.expectedVersion)
    return fail(
      409,
      "CONCURRENT_UPDATE",
      "La cita cambió; consulta su estado actual.",
    );
  if (!["REQUESTED", "CONFIRMED"].includes(appointment.status))
    return fail(
      409,
      "APPOINTMENT_TRANSITION_NOT_ALLOWED",
      "La cita es terminal.",
    );
  const now = Date.now();
  const originalVeterinarian = users.get(appointment.veterinarianId);
  const owner = users.get(appointment.ownerId);
  const pet = pets.find((item) => item.id === appointment.petId);
  if (
    operation === "RESCHEDULING" &&
    appointment.assignmentStatus !== "ASSIGNED"
  )
    return fail(
      409,
      "APPOINTMENT_REASSIGNMENT_REQUIRED",
      "Resuelve la falta de veterinario mediante una reasignación.",
    );
  if (operation === "REASSIGNMENT") {
    if (Date.parse(appointment.endsAt) <= now)
      return fail(409, "APPOINTMENT_ALREADY_ENDED", "La cita ya terminó.");
    if (
      appointment.assignmentStatus !== "NEEDS_REASSIGNMENT" ||
      originalVeterinarian?.status === "ACTIVE" ||
      originalVeterinarian?.role !== "VETERINARIAN"
    )
      return fail(
        409,
        "APPOINTMENT_REASSIGNMENT_NOT_REQUIRED",
        "La cita no requiere reemplazar a un veterinario inactivo.",
      );
  }
  if (
    metadata.participantInactive ||
    owner?.status !== "ACTIVE" ||
    owner?.role !== "OWNER" ||
    !pet?.active ||
    pet.ownerId !== appointment.ownerId
  )
    return fail(
      409,
      "APPOINTMENT_PARTICIPANT_INACTIVE",
      "El propietario o la mascota ya no están activos.",
    );
  if (operation === "RESCHEDULING" && originalVeterinarian?.status !== "ACTIVE")
    return fail(
      409,
      "APPOINTMENT_VETERINARIAN_INACTIVE",
      "El veterinario original ya no está activo.",
    );
  const destination = availabilitySlots.find(
    (slot) => slot.id.toLowerCase() === body.availabilitySlotId.toLowerCase(),
  );
  if (!destination)
    return fail(
      409,
      "APPOINTMENT_SLOT_NOT_AVAILABLE",
      "El turno de destino no está disponible.",
    );
  if (destination.version !== body.expectedAvailabilitySlotVersion)
    return fail(409, "CONCURRENT_UPDATE", "El turno seleccionado cambió.");
  if (users.get(destination.veterinarianId)?.status !== "ACTIVE")
    return fail(
      409,
      "APPOINTMENT_VETERINARIAN_INACTIVE",
      "El veterinario de destino ya no está activo.",
    );
  if (operation === "RESCHEDULING" && Date.parse(appointment.startsAt) <= now)
    return fail(409, "APPOINTMENT_ALREADY_STARTED", "La cita ya comenzó.");
  if (appointment.status === "REQUESTED" && now >= metadata.cutoffAt)
    return fail(
      409,
      "APPOINTMENT_CONFIRMATION_CUTOFF_PASSED",
      "La solicitud llegó a su corte persistido.",
    );
  if (
    destination.id === metadata.slotId ||
    destination.status !== "PUBLISHED" ||
    (operation === "REASSIGNMENT" && Date.parse(destination.startsAt) <= now)
  )
    return fail(
      409,
      "APPOINTMENT_DESTINATION_NOT_AVAILABLE",
      "El destino no permite aplicar el cambio.",
    );
  const destinationDay = businessDate(Date.parse(destination.startsAt));
  if (
    (operation === "RESCHEDULING" &&
      (destinationDay < shiftedBusinessDate(1) ||
        destinationDay > shiftedBusinessDate(60))) ||
    (operation === "REASSIGNMENT" &&
      appointment.status === "REQUESTED" &&
      destinationDay < shiftedBusinessDate(1))
  )
    return fail(
      409,
      "APPOINTMENT_OUTSIDE_REQUEST_WINDOW",
      "La fecha de destino está fuera de la ventana permitida.",
    );
  if (occupiedAvailabilitySlots.has(destination.id))
    return fail(
      409,
      "APPOINTMENT_SLOT_OCCUPIED",
      "Otra cita ocupa el destino.",
    );
  if (
    appointmentRecords().some(
      (item) =>
        item.id !== appointment.id &&
        item.petId === appointment.petId &&
        ["REQUESTED", "CONFIRMED"].includes(item.status) &&
        Date.parse(item.startsAt) === Date.parse(destination.startsAt),
    )
  )
    return fail(
      409,
      "APPOINTMENT_PET_ALREADY_SCHEDULED",
      "La mascota ya tiene una cita en ese horario.",
    );
  const timeChanged =
    Date.parse(destination.startsAt) !== Date.parse(appointment.startsAt);
  if (
    operation === "REASSIGNMENT" &&
    timeChanged &&
    (!agreementShape() || Date.parse(body.agreementContactedAt) > now)
  )
    return fail(
      400,
      "INVALID_APPOINTMENT_REQUEST",
      "Registra el acuerdo previo para cambiar el horario.",
    );
  const cutoffAt =
    appointment.status === "REQUESTED"
      ? Date.parse(`${destinationDay}T06:00:00-05:00`)
      : metadata.cutoffAt;
  if (appointment.status === "REQUESTED" && now >= cutoffAt)
    return fail(
      409,
      "APPOINTMENT_CONFIRMATION_CUTOFF_PASSED",
      "El destino alcanzó su corte.",
    );
  const previousSlotId = metadata.slotId;
  const previousAssignment = appointment.assignmentStatus;
  releaseAppointmentSlot(appointment, previousSlotId);
  metadata.slotId = destination.id;
  metadata.cutoffAt = cutoffAt;
  appointment.veterinarianId = destination.veterinarianId;
  appointment.veterinarianFullName = veterinarians.find(
    (item) => item.id === destination.veterinarianId,
  ).fullName;
  appointment.startsAt = destination.startsAt;
  appointment.endsAt = destination.endsAt;
  appointment.assignmentStatus = "ASSIGNED";
  appointment.version += 1;
  appointment.updatedAt = new Date().toISOString();
  occupiedAvailabilitySlots.add(destination.id);
  referencedAvailabilitySlots.add(destination.id);
  const event = appointmentEvent(
    appointment,
    operation === "RESCHEDULING" ? "RESCHEDULED" : "REASSIGNED",
    user.id,
    appointment.status,
    reason,
  );
  event.previousSlotId = previousSlotId;
  event.previousAssignmentStatus = previousAssignment;
  appointmentEvents.push(event);
  metadata.moveOperations.set(operationKey, fingerprint);
  return mutationResponse(response, 200, structuredClone(appointment));
}

function prepareAppointmentNotifications(appointment, count = 26) {
  // Explicit fixtures only: no SMTP dispatcher or production queue is simulated.
  for (let index = appointmentNotifications.length - 1; index >= 0; index -= 1)
    if (appointmentNotifications[index].appointmentId === appointment.id)
      appointmentNotifications.splice(index, 1);
  const ownerTypes = [
    "OWNER_CONFIRMED",
    "OWNER_REJECTED",
    "OWNER_CANCELLED",
    "OWNER_RESCHEDULED",
    "OWNER_REASSIGNED",
    "OWNER_REMINDER",
  ];
  const notificationStatuses = [
    "SENT",
    "PENDING",
    "SENDING",
    "FAILED",
    "SUPERSEDED",
  ];
  const day = businessDate();
  for (let index = 0; index < count; index += 1) {
    const status = notificationStatuses[index % notificationStatuses.length];
    const internal = index === 25;
    appointmentNotifications.push({
      id: recordId(
        "e1000000",
        Number(appointment.id.slice(-6)) * 100 + index + 1,
      ),
      appointmentId: appointment.id,
      recipientId: internal ? accounts[1].id : appointment.ownerId,
      notificationType: internal
        ? "ADMIN_REASSIGNMENT"
        : ownerTypes[index % ownerTypes.length],
      status,
      scheduledAt: index === 0 ? `${day}T04:30:00Z` : `${day}T15:00:00Z`,
      nextAttemptAt: status === "PENDING" ? `${day}T20:00:00Z` : null,
      sentAt: status === "SENT" ? `${day}T16:00:00Z` : null,
      attemptCount: status === "SUPERSEDED" ? 0 : status === "SENT" ? 1 : 2,
      errorCode:
        status === "PENDING"
          ? "SMTP_DELIVERY_FAILED"
          : status === "FAILED"
            ? "DELIVERY_ATTEMPTS_EXHAUSTED"
            : status === "SUPERSEDED"
              ? "NOTICE_NO_LONGER_CURRENT"
              : null,
    });
  }
}

async function handleAppointmentNotifications(
  request,
  response,
  path,
  session,
) {
  const match = /^\/api\/v1\/appointments\/([^/]+)\/notifications$/.exec(path);
  if (!match) return false;
  if (request.method !== "GET") {
    problem(
      response,
      501,
      "SIMULATION_ENDPOINT_NOT_MODELED",
      "Esta operación no está modelada.",
    );
    return true;
  }
  const user = session.user;
  const permission = {
    OWNER: "APPOINTMENT_READ_SELF",
    ADMINISTRATOR: "APPOINTMENT_READ_ALL",
  }[user.role];
  if (!permission || !user.permissions.includes(permission)) {
    problem(
      response,
      403,
      "ACCESS_DENIED",
      "La cuenta no tiene permiso para consultar estos avisos.",
    );
    return true;
  }
  const page = pagination(new URL(request.url, "http://simulation.invalid"));
  if (!page) {
    problem(
      response,
      400,
      "INVALID_APPOINTMENT_REQUEST",
      "La paginación no es válida.",
    );
    return true;
  }
  const appointment = appointmentRecords().find((item) => item.id === match[1]);
  if (
    !appointment ||
    (user.role === "OWNER" && appointment.ownerId !== user.id)
  ) {
    problem(
      response,
      404,
      "APPOINTMENT_NOT_FOUND",
      "No se encontró la cita solicitada.",
    );
    return true;
  }
  const entries = appointmentNotifications
    .filter(
      (item) =>
        item.appointmentId === appointment.id &&
        (user.role === "ADMINISTRATOR" || item.recipientId === user.id),
    )
    .map(({ recipientId, ...item }) => {
      void recipientId;
      return item;
    });
  const body = structuredClone(pageOf(entries, page));
  const control =
    nextNotificationRead?.appointmentId === appointment.id
      ? nextNotificationRead
      : null;
  if (control) nextNotificationRead = null;
  if (control?.delayMs)
    await new Promise((resolve) => setTimeout(resolve, control.delayMs));
  if (control?.mode === "unavailable")
    problem(
      response,
      503,
      "SIMULATION_TEMPORARY_UNAVAILABLE",
      "La consulta de avisos falló temporalmente.",
    );
  else if (control?.mode === "forbidden")
    problem(
      response,
      403,
      "ACCESS_DENIED",
      "La cuenta ya no tiene permiso para consultar estos avisos.",
    );
  else if (control?.mode === "missing")
    problem(
      response,
      404,
      "APPOINTMENT_NOT_FOUND",
      "No se encontró la cita solicitada.",
    );
  else if (control?.mode === "invalid-json") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "private, no-store",
    });
    response.end('{"items":');
  } else {
    if (body.items[0] && control?.mode === "extra-field")
      body.items[0].recipientEmail = "fictional@roles.test";
    if (body.items[0] && control?.mode === "foreign")
      body.items[0].appointmentId = recordId("d1000000", 999);
    send(response, 200, body);
  }
  return true;
}

async function handleAppointments(
  request,
  response,
  bodyPromise,
  path,
  session,
) {
  const match =
    /^\/api\/v1\/appointments(?:\/([^/]+)(?:\/(status|events|reschedulings|veterinarian-reassignments))?)?$/.exec(
      path,
    );
  if (!match) return false;
  const user = session.user;
  const method = request.method;
  const records = appointmentRecords();
  const forbidden = () =>
    problem(
      response,
      403,
      "ACCESS_DENIED",
      "El rol no permite esta operación.",
    );
  if (
    method === "POST" &&
    ["reschedulings", "veterinarian-reassignments"].includes(match[2])
  ) {
    await handleAppointmentMove(
      response,
      bodyPromise,
      match[1],
      match[2] === "reschedulings" ? "RESCHEDULING" : "REASSIGNMENT",
      user,
    );
    return true;
  }
  if (method === "PATCH" && match[2] === "status") {
    if (
      user.role !== "ADMINISTRATOR" ||
      !user.permissions.includes("APPOINTMENT_MANAGE")
    ) {
      forbidden();
      return true;
    }
    const body = await bodyPromise;
    if (!objectWithFields(body, ["status", "expectedVersion", "reason"])) {
      problem(
        response,
        400,
        "UNKNOWN_PROPERTY",
        "La estructura del cambio no es válida.",
      );
      return true;
    }
    if (
      (body.status !== null &&
        body.status !== undefined &&
        (typeof body.status !== "string" ||
          ![
            "REQUESTED",
            "CONFIRMED",
            "REJECTED",
            "CANCELLED",
            "NO_SHOW",
          ].includes(body.status))) ||
      (body.expectedVersion !== null &&
        body.expectedVersion !== undefined &&
        !Number.isSafeInteger(body.expectedVersion)) ||
      (body.reason !== null &&
        body.reason !== undefined &&
        typeof body.reason !== "string")
    ) {
      problem(
        response,
        400,
        "TYPE_MISMATCH",
        "El tipo de un campo no es válido.",
      );
      return true;
    }
    if (
      !Number.isSafeInteger(body.expectedVersion) ||
      body.expectedVersion < 0 ||
      typeof body.status !== "string" ||
      (body.reason !== undefined &&
        body.reason !== null &&
        (typeof body.reason !== "string" || body.reason.length > 1000))
    ) {
      problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa estado, versión y motivo.",
      );
      return true;
    }
    if (
      !["CONFIRMED", "REJECTED", "CANCELLED", "NO_SHOW"].includes(body.status)
    ) {
      problem(
        response,
        409,
        "APPOINTMENT_TRANSITION_NOT_ALLOWED",
        "Esta transición no está permitida.",
      );
      return true;
    }
    const reason = normalizedAppointmentReason(body.reason);
    if (body.status !== "CONFIRMED" && !reason) {
      problem(
        response,
        400,
        "INVALID_APPOINTMENT_REQUEST",
        "Indica el motivo del rechazo.",
      );
      return true;
    }
    const appointment = records.find((item) => item.id === match[1]);
    if (!appointment) {
      problem(response, 404, "APPOINTMENT_NOT_FOUND", "La cita no existe.");
      return true;
    }
    const metadata = appointmentMetadata.get(appointment.id);
    const previousOperation = metadata.lastStatusOperation;
    if (
      appointment.version === body.expectedVersion + 1 &&
      appointment.status === body.status &&
      previousOperation?.actorId === user.id &&
      previousOperation.target === body.status &&
      previousOperation.reason === reason &&
      previousOperation.version === appointment.version
    ) {
      await mutationResponse(response, 200, structuredClone(appointment));
      return true;
    }
    if (appointment.version !== body.expectedVersion) {
      problem(
        response,
        409,
        "CONCURRENT_UPDATE",
        "Los datos cambiaron. Consulta la cita actual.",
      );
      return true;
    }
    const allowed =
      body.status === "CANCELLED"
        ? ["REQUESTED", "CONFIRMED"].includes(appointment.status)
        : body.status === "NO_SHOW"
          ? appointment.status === "CONFIRMED"
          : appointment.status === "REQUESTED";
    if (!allowed) {
      problem(
        response,
        409,
        "APPOINTMENT_TRANSITION_NOT_ALLOWED",
        "La solicitud ya cambió de estado.",
      );
      return true;
    }
    if (
      body.status === "CANCELLED" &&
      Date.parse(appointment.startsAt) <= Date.now()
    ) {
      problem(
        response,
        409,
        "APPOINTMENT_ALREADY_STARTED",
        "La cita ya comenzó.",
      );
      return true;
    }
    if (
      body.status === "NO_SHOW" &&
      Date.parse(appointment.endsAt) > Date.now()
    ) {
      problem(
        response,
        409,
        "APPOINTMENT_NOT_ENDED",
        "La cita todavía no terminó.",
      );
      return true;
    }
    if (body.status === "CONFIRMED") {
      if (
        Date.now() >= metadata.cutoffAt ||
        Date.now() >= Date.parse(appointment.startsAt)
      ) {
        problem(
          response,
          409,
          "APPOINTMENT_CONFIRMATION_CUTOFF_PASSED",
          "La solicitud llegó a su corte o el turno comenzó.",
        );
        return true;
      }
      const owner = users.get(appointment.ownerId);
      const veterinarian = users.get(appointment.veterinarianId);
      const pet = pets.find((item) => item.id === appointment.petId);
      if (
        metadata.participantInactive ||
        owner?.status !== "ACTIVE" ||
        owner.role !== "OWNER" ||
        veterinarian?.status !== "ACTIVE" ||
        !pet?.active
      ) {
        problem(
          response,
          409,
          "APPOINTMENT_PARTICIPANT_INACTIVE",
          "Un participante o el turno ya no está habilitado.",
        );
        return true;
      }
    }
    const previousStatus = appointment.status;
    appointment.status = body.status;
    appointment.version += 1;
    appointment.updatedAt = new Date().toISOString();
    metadata.lastStatusOperation = {
      actorId: user.id,
      target: body.status,
      reason,
      version: appointment.version,
    };
    appointmentEvents.push(
      appointmentEvent(
        appointment,
        body.status,
        user.id,
        previousStatus,
        reason,
      ),
    );
    if (["REJECTED", "CANCELLED", "NO_SHOW"].includes(body.status))
      releaseAppointmentSlot(appointment, metadata.slotId);
    await mutationResponse(response, 200, structuredClone(appointment));
    return true;
  }
  if (method !== "GET") {
    problem(
      response,
      501,
      "SIMULATION_ENDPOINT_NOT_MODELED",
      "Esta operación no está modelada.",
    );
    return true;
  }
  const readPermission = {
    ADMINISTRATOR: "APPOINTMENT_READ_ALL",
    OWNER: "APPOINTMENT_READ_SELF",
    VETERINARIAN: "APPOINTMENT_READ_ASSIGNED",
  }[user.role];
  if (!readPermission || !user.permissions.includes(readPermission)) {
    forbidden();
    return true;
  }
  const url = new URL(request.url, "http://simulation.invalid");
  if (!match[1]) {
    const range = dateRange(url);
    const page = pagination(url);
    const status = url.searchParams.get("status");
    if (
      !range ||
      !page ||
      (status !== null &&
        ![
          "REQUESTED",
          "CONFIRMED",
          "REJECTED",
          "CANCELLED",
          "NO_SHOW",
        ].includes(status))
    ) {
      problem(
        response,
        400,
        "INVALID_APPOINTMENT_REQUEST",
        "Revisa el rango de 1 a 31 fechas, el estado y la paginación.",
      );
      return true;
    }
    const visible = records
      .filter((appointment) => {
        const day = businessDate(Date.parse(appointment.startsAt));
        return (
          canReadAppointment(user, appointment) &&
          day >= range.from &&
          day <= range.to &&
          (status === null || status === appointment.status)
        );
      })
      .sort(
        (left, right) =>
          Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
          left.id.localeCompare(right.id),
      );
    send(response, 200, pageOf(visible, page));
    return true;
  }
  const appointment = records.find((item) => item.id === match[1]);
  if (!appointment || !canReadAppointment(user, appointment)) {
    problem(
      response,
      404,
      "APPOINTMENT_NOT_FOUND",
      "La cita no existe o no pertenece a esta cuenta.",
    );
    return true;
  }
  if (!match[2]) {
    send(response, 200, appointment);
    return true;
  }
  if (match[2] === "events") {
    const page = pagination(url);
    if (!page)
      problem(
        response,
        400,
        "INVALID_APPOINTMENT_REQUEST",
        "La paginación no es válida.",
      );
    else
      send(
        response,
        200,
        pageOf(
          appointmentEvents
            .filter(
              (event) =>
                event.appointmentId === appointment.id &&
                (user.role === "ADMINISTRATOR" ||
                  event.eventType !== "EMAIL_ACCESSED"),
            )
            .sort(
              (left, right) =>
                Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
                left.id.localeCompare(right.id),
            ),
          page,
        ),
      );
    return true;
  }
  problem(
    response,
    501,
    "SIMULATION_ENDPOINT_NOT_MODELED",
    "Esta operación no está modelada.",
  );
  return true;
}
function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type":
      status >= 400 ? "application/problem+json" : "application/json",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}
function problem(response, status, code, detail, fieldErrors = []) {
  const titles = {
    400: "Solicitud incorrecta",
    401: "Autenticación requerida",
    403: "Acceso denegado",
    404: "Recurso no encontrado",
    409: "Conflicto con el estado actual",
    429: "Demasiadas solicitudes",
    501: "Operación no simulada",
    503: "Servicio temporalmente no disponible",
  };
  return send(response, status, {
    type: "about:blank",
    title: titles[status] || "Error de simulación",
    status,
    detail,
    errorCode: code,
    fieldErrors,
  });
}
function readBody(request) {
  if (request.body !== undefined) return Promise.resolve(request.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    request.on("error", reject);
  });
}
function objectWithFields(body, allowed) {
  return (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body).every((key) => allowed.includes(key))
  );
}
function fieldError(field, message) {
  return { field, code: "INVALID_VALUE", message };
}
function signupErrors(body) {
  const errors = profileErrors(
    { email: body.email, fullName: body.fullName },
    false,
    true,
  );
  const date = body.dateOfBirth;
  const today = businessDate();
  const validDate =
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const completedYears = validDate
    ? Number(today.slice(0, 4)) -
      Number(date.slice(0, 4)) -
      Number(today.slice(5) < date.slice(5))
    : null;
  if (!validDate || date > today || completedYears > 130)
    errors.push(
      fieldError(
        "dateOfBirth",
        "Escribe una fecha válida, no futura, de hasta 130 años cumplidos.",
      ),
    );
  // Structural E.164 check only: worldwide numbering metadata is tested by
  // the real backend, not reproduced by this dependency-free stand-in.
  if (
    typeof body.phoneNumber !== "string" ||
    !/^\+[1-9]\d{1,14}$/.test(body.phoneNumber)
  )
    errors.push(
      fieldError(
        "phoneNumber",
        "Escribe un teléfono internacional válido, como +573001234567.",
      ),
    );
  if (
    typeof body.password !== "string" ||
    [...body.password].length < 15 ||
    [...body.password].length > 128 ||
    body.password.toLowerCase() === "films+pic+galeries"
  )
    errors.push(
      fieldError(
        "password",
        "Usa entre 15 y 128 caracteres y una contraseña menos común.",
      ),
    );
  return errors;
}
async function authenticationControl(response, operation) {
  if (nextAuthentication?.operation !== operation) return false;
  const controlled = nextAuthentication;
  nextAuthentication = null;
  if (controlled.delayMs)
    await new Promise((resolve) => setTimeout(resolve, controlled.delayMs));
  if (controlled.errorStatus === 503) {
    problem(
      response,
      503,
      "SIMULATION_TEMPORARY_UNAVAILABLE",
      "No se pudo completar la solicitud en este momento.",
    );
    return true;
  }
  if (controlled.fieldError) {
    problem(
      response,
      400,
      "VALIDATION_FAILED",
      "Revisa los campos indicados.",
      [
        fieldError(
          controlled.fieldError,
          "El servidor no acepta este valor. Revisa el campo indicado.",
        ),
      ],
    );
    return true;
  }
  return false;
}
function profileErrors(body, veterinarian, creating) {
  const fields = [
    "fullName",
    ...(creating ? ["email"] : []),
    ...(veterinarian
      ? [
          "professionalPhoneNumber",
          "professionalRegistrationNumber",
          "baseDegreeTitle",
          "baseDegreeInstitution",
          "biography",
        ]
      : []),
  ];
  if (!objectWithFields(body, fields))
    return [fieldError("request", "La estructura no es válida.")];
  const errors = [];
  const name = body.fullName;
  if (
    typeof name !== "string" ||
    [...name].length > 150 ||
    !/^[\p{L}\p{M}\p{Zs}'’.-]+$/u.test(name) ||
    name.trim().split(/\p{Zs}+/u).length < 2 ||
    name
      .trim()
      .split(/\p{Zs}+/u)
      .some((part) => !/\p{L}/u.test(part))
  )
    errors.push(
      fieldError(
        "fullName",
        "Escribe al menos dos componentes del nombre, hasta 150 caracteres.",
      ),
    );
  if (
    creating &&
    (typeof body.email !== "string" ||
      body.email.length < 3 ||
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
  )
    errors.push(
      fieldError("email", "Escribe un correo válido de hasta 254 caracteres."),
    );
  if (veterinarian) {
    if (
      typeof body.professionalPhoneNumber !== "string" ||
      !/^\+[1-9]\d{1,14}$/.test(body.professionalPhoneNumber)
    )
      errors.push(
        fieldError(
          "professionalPhoneNumber",
          "Usa el formato internacional, por ejemplo +573001234567.",
        ),
      );
    if (
      typeof body.professionalRegistrationNumber !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9 ./-]{0,49}$/.test(
        body.professionalRegistrationNumber,
      )
    )
      errors.push(
        fieldError(
          "professionalRegistrationNumber",
          "Revisa la matrícula profesional, hasta 50 caracteres.",
        ),
      );
    for (const field of ["baseDegreeTitle", "baseDegreeInstitution"])
      if (
        typeof body[field] !== "string" ||
        !body[field].trim() ||
        body[field].length > 200
      )
        errors.push(
          fieldError(field, "Completa este campo con hasta 200 caracteres."),
        );
    if (
      body.biography !== undefined &&
      body.biography !== null &&
      (typeof body.biography !== "string" || body.biography.length > 2000)
    )
      errors.push(
        fieldError("biography", "La biografía admite hasta 2000 caracteres."),
      );
  }
  return errors;
}
function updateProfile(record, body, veterinarian) {
  record.fullName = body.fullName.trim();
  record.updatedAt = new Date().toISOString();
  if (veterinarian) {
    const academicChanged =
      record.baseDegreeTitle !== body.baseDegreeTitle.trim() ||
      record.baseDegreeInstitution !== body.baseDegreeInstitution.trim();
    for (const field of [
      "professionalPhoneNumber",
      "baseDegreeTitle",
      "baseDegreeInstitution",
    ])
      record[field] = body[field].trim();
    record.professionalRegistrationNumber = body.professionalRegistrationNumber
      .trim()
      .toUpperCase();
    record.biography = body.biography?.trim() || null;
    const baseDegree = record.qualifications.find((item) => item.isBaseDegree);
    baseDegree.title = record.baseDegreeTitle;
    baseDegree.institution = record.baseDegreeInstitution;
    if (academicChanged) baseDegree.diplomaPublished = false;
  }
}
function disableUser(user) {
  if (user.status !== "DISABLED") user.authenticationVersion += 1;
  user.status = "DISABLED";
  invalidateInvitations(user.id);
}
function changeRecordStatus(record, user, status) {
  if (status === "DISABLED") disableUser(user);
  else user.status = status;
  record.status = user.status;
  record.updatedAt = new Date().toISOString();
}
async function mutationResponse(response, status, body, headers) {
  const controlled = nextMutation;
  nextMutation = null;
  if (controlled?.delayMs)
    await new Promise((resolve) => setTimeout(resolve, controlled.delayMs));
  if (controlled?.drop) {
    response.destroy();
    return;
  }
  if (controlled?.responseMode === "empty")
    return send(response, status, undefined, headers);
  if (controlled?.responseMode === "invalid-json") {
    response.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    });
    response.end('{"simulationOnly":');
    return;
  }
  if (controlled?.responseMode === "timeout")
    return problem(
      response,
      408,
      "SIMULATION_RESPONSE_TIMEOUT",
      "La escritura se aplicó, pero su respuesta agotó el tiempo de espera simulado.",
    );
  return send(response, status, body, headers);
}
function sourceForUser(user) {
  return user.role === "ADMINISTRATOR" ? administrators : veterinarians;
}
function invitationsUnavailable(user, response) {
  if (user.email.startsWith("unavailable-")) {
    problem(
      response,
      503,
      "STAFF_INVITATIONS_UNAVAILABLE",
      "Las invitaciones de personal no están disponibles en este momento.",
    );
    return true;
  }
  return false;
}
async function handleStaff(request, response, bodyPromise, path, session) {
  const match =
    /^\/api\/v1\/(administrators|veterinarians)(?:\/([^/]+)(\/status)?)?$/.exec(
      path,
    );
  const invitationMatch = /^\/api\/v1\/staff\/([^/]+)\/invitations$/.exec(path);
  if (!match && !invitationMatch) return false;
  const actor = users.get(session.user.id);
  const method = request.method;
  if (invitationMatch) {
    if (!["POST", "DELETE"].includes(method)) return false;
    const user = users.get(invitationMatch[1]);
    if (!user) {
      problem(
        response,
        404,
        "STAFF_MEMBER_NOT_FOUND",
        "No se encontró la cuenta de personal.",
      );
      return true;
    }
    const requiredRole =
      user.role === "ADMINISTRATOR" ? "SUPER_ADMIN" : "ADMINISTRATOR";
    const requiredPermission =
      user.role === "ADMINISTRATOR"
        ? "ADMINISTRATOR_MANAGE"
        : "VETERINARIAN_MANAGE";
    if (
      !["ADMINISTRATOR", "VETERINARIAN"].includes(user.role) ||
      actor.role !== requiredRole ||
      !actor.permissions.includes(requiredPermission)
    ) {
      problem(
        response,
        403,
        "STAFF_OPERATION_FORBIDDEN",
        "No tienes permiso para administrar esta invitación.",
      );
      return true;
    }
    if (method === "POST" && invitationsUnavailable(actor, response))
      return true;
    if (user.password || user.status === "ACTIVE") {
      problem(
        response,
        409,
        "STAFF_INVITATION_STATE_CONFLICT",
        "La cuenta no admite una invitación de activación.",
      );
      return true;
    }
    const record = sourceForUser(user).find((item) => item.id === user.id);
    if (method === "DELETE") {
      changeRecordStatus(record, user, "DISABLED");
      await mutationResponse(response, 204);
      return true;
    }
    const history = invitations.filter((item) => item.userId === user.id);
    if (
      history.some((item) => item.createdAt > Date.now() - 60_000) ||
      history.filter((item) => item.createdAt > Date.now() - 86_400_000)
        .length >= 5
    ) {
      problem(
        response,
        429,
        "STAFF_INVITATION_RATE_LIMITED",
        "Espera antes de solicitar otra invitación; se permiten cinco por cuenta en 24 horas.",
      );
      return true;
    }
    invalidateInvitations(user.id);
    changeRecordStatus(record, user, "PENDING_ACTIVATION");
    await mutationResponse(
      response,
      202,
      invitationResponse(issueInvitation(user)),
    );
    return true;
  }
  const veterinarian = match[1] === "veterinarians";
  const requiredRole = veterinarian ? "ADMINISTRATOR" : "SUPER_ADMIN";
  const requiredPermission = veterinarian
    ? "VETERINARIAN_MANAGE"
    : "ADMINISTRATOR_MANAGE";
  if (
    actor.role !== requiredRole ||
    !actor.permissions.includes(requiredPermission) ||
    actor.email === "forbidden@roles.test"
  ) {
    problem(
      response,
      403,
      "STAFF_ACCESS_DENIED",
      "La cuenta no tiene permiso para esta operación.",
    );
    return true;
  }
  const source = veterinarian ? veterinarians : administrators;
  if (method === "GET" && !match[2]) return false; // Existing list/filter and flaky fixture below.
  if (method === "POST" && !match[2]) {
    const body = await bodyPromise;
    const errors = profileErrors(body, veterinarian, true);
    if (errors.length) {
      problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa los campos indicados.",
        errors,
      );
      return true;
    }
    if (
      [...users.values()].some(
        (user) => user.email === body.email.trim().toLowerCase(),
      )
    ) {
      problem(
        response,
        409,
        "EMAIL_ALREADY_REGISTERED",
        "Este correo ya está registrado.",
      );
      return true;
    }
    if (
      veterinarian &&
      veterinarians.some(
        (item) =>
          item.professionalRegistrationNumber ===
          body.professionalRegistrationNumber.trim().toUpperCase(),
      )
    ) {
      problem(
        response,
        409,
        "PROFESSIONAL_REGISTRATION_ALREADY_EXISTS",
        "La matrícula profesional ya está registrada.",
      );
      return true;
    }
    if (invitationsUnavailable(actor, response)) return true;
    const user = {
      id: randomUUID(),
      email: body.email.trim().toLowerCase(),
      role: veterinarian ? "VETERINARIAN" : "ADMINISTRATOR",
      status: "PENDING_ACTIVATION",
      password: null,
      authenticationVersion: 0,
      permissions: permissions[veterinarian ? "VETERINARIAN" : "ADMINISTRATOR"],
    };
    const record = {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(veterinarian
        ? {
            qualifications: [
              {
                id: randomUUID(),
                type: "UNDERGRADUATE",
                title: "",
                institution: "",
                graduationYear: null,
                isBaseDegree: true,
                diplomaAvailable: false,
                diplomaPublished: false,
              },
            ],
          }
        : {}),
    };
    updateProfile(record, body, veterinarian);
    users.set(user.id, user);
    source.push(record);
    issueInvitation(user);
    await mutationResponse(response, 201, record, {
      location: `/api/v1/${match[1]}/${record.id}`,
    });
    return true;
  }
  if (!match[2]) return false;
  const record = source.find((item) => item.id === match[2]);
  if (!record) {
    problem(
      response,
      404,
      "STAFF_MEMBER_NOT_FOUND",
      "No se encontró la cuenta de personal.",
    );
    return true;
  }
  const user = users.get(record.id);
  if (method === "GET" && !match[3]) {
    send(response, 200, record);
    return true;
  }
  if (method === "PUT" && !match[3]) {
    const body = await bodyPromise;
    const errors = profileErrors(body, veterinarian, false);
    if (errors.length) {
      problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa los campos indicados.",
        errors,
      );
      return true;
    }
    if (
      veterinarian &&
      veterinarians.some(
        (item) =>
          item.id !== record.id &&
          item.professionalRegistrationNumber ===
            body.professionalRegistrationNumber.trim().toUpperCase(),
      )
    ) {
      problem(
        response,
        409,
        "PROFESSIONAL_REGISTRATION_ALREADY_EXISTS",
        "La matrícula profesional ya está registrada.",
      );
      return true;
    }
    updateProfile(record, body, veterinarian);
    await mutationResponse(response, 200, record);
    return true;
  }
  if (method === "PATCH" && match[3]) {
    const body = await bodyPromise;
    if (
      !objectWithFields(body, ["status"]) ||
      !["ACTIVE", "DISABLED"].includes(body.status)
    ) {
      problem(
        response,
        400,
        "INVALID_STAFF_STATUS",
        "Solo se admite ACTIVE o DISABLED.",
      );
      return true;
    }
    if (
      body.status === "ACTIVE" &&
      (user.status === "PENDING_ACTIVATION" || !user.password)
    ) {
      problem(
        response,
        409,
        "STAFF_ACTIVATION_REQUIRED",
        "La persona debe establecer su contraseña mediante una invitación.",
      );
      return true;
    }
    changeRecordStatus(record, user, body.status);
    await mutationResponse(response, 200, record);
    return true;
  }
  return false;
}
function pagination(url) {
  const pageText = url.searchParams.get("page") ?? "0";
  const sizeText = url.searchParams.get("size") ?? "20";
  if (!/^\d+$/.test(pageText) || !/^\d+$/.test(sizeText)) return null;
  const page = Number(pageText),
    size = Number(sizeText);
  return Number.isSafeInteger(page) &&
    size >= 1 &&
    size <= 100 &&
    page * size <= 2147483647
    ? { page, size }
    : null;
}
function pageOf(items, page) {
  return {
    items: items.slice(page.page * page.size, (page.page + 1) * page.size),
    ...page,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / page.size),
  };
}
function dateRange(url) {
  const from = url.searchParams.get("from"),
    to = url.searchParams.get("to");
  const valid = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return null;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  return days >= 1 && days <= 31 ? { from, to } : null;
}
function availabilityBodyError(body, operation) {
  const allowed =
    operation === "create"
      ? ["startsAt"]
      : operation === "move"
        ? ["startsAt", "expectedVersion", "reason"]
        : ["status", "expectedVersion", "reason"];
  if (!objectWithFields(body, allowed))
    return { code: "INVALID_REQUEST", fields: [] };
  const fields = [];
  if (operation !== "status") {
    if (body.startsAt === null || body.startsAt === undefined)
      fields.push(
        fieldError("startsAt", "Indica una fecha y hora con offset."),
      );
    else if (
      typeof body.startsAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        body.startsAt,
      ) ||
      !Number.isFinite(Date.parse(body.startsAt)) ||
      new Date(`${body.startsAt.slice(0, 10)}T00:00:00Z`)
        .toISOString()
        .slice(0, 10) !== body.startsAt.slice(0, 10)
    )
      return { code: "TYPE_MISMATCH", fields: [] };
    else if (
      Date.parse(body.startsAt) % (30 * 60000) !== 0 ||
      /\.\d*[1-9]\d*(?:Z|[+-]\d{2}:\d{2})$/.test(body.startsAt)
    )
      return { code: "INVALID_AVAILABILITY_REQUEST", fields: [] };
  }
  if (operation !== "create") {
    if (body.expectedVersion === null || body.expectedVersion === undefined)
      fields.push(
        fieldError("expectedVersion", "Indica una versión no negativa."),
      );
    else if (
      typeof body.expectedVersion !== "number" ||
      !Number.isSafeInteger(body.expectedVersion)
    )
      return { code: "TYPE_MISMATCH", fields: [] };
    else if (body.expectedVersion < 0)
      fields.push(
        fieldError("expectedVersion", "Indica una versión no negativa."),
      );
    if (
      typeof body.reason !== "string" ||
      !body.reason.trim() ||
      body.reason.length > 500
    )
      fields.push(
        fieldError("reason", "Indica un motivo de hasta 500 caracteres."),
      );
  }
  if (operation === "status") {
    if (body.status === null || body.status === undefined)
      fields.push(fieldError("status", "Indica el estado del turno."));
    else if (!["PUBLISHED", "BLOCKED"].includes(body.status))
      return { code: "TYPE_MISMATCH", fields: [] };
  }
  return fields.length ? { code: "VALIDATION_FAILED", fields } : null;
}
function availabilityBatchBodyError(body) {
  if (
    !objectWithFields(body, [
      "startDate",
      "endDate",
      "daysOfWeek",
      "dailyStartTime",
      "dailyEndTime",
    ])
  )
    return { code: "INVALID_REQUEST", fields: [] };
  const fields = [];
  for (const field of ["startDate", "endDate"]) {
    const value = body[field];
    if (value === undefined || value === null)
      fields.push(fieldError(field, "Indica una fecha local."));
    else if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
    )
      return { code: "TYPE_MISMATCH", fields: [] };
  }
  for (const field of ["dailyStartTime", "dailyEndTime"]) {
    if (body[field] === undefined || body[field] === null)
      fields.push(fieldError(field, "Indica la hora local."));
    else if (typeof body[field] !== "string")
      return { code: "TYPE_MISMATCH", fields: [] };
  }
  if (body.daysOfWeek === undefined || body.daysOfWeek === null)
    fields.push(
      fieldError("daysOfWeek", "Selecciona al menos un día de la semana."),
    );
  else if (!Array.isArray(body.daysOfWeek))
    return { code: "TYPE_MISMATCH", fields: [] };
  else {
    if (body.daysOfWeek.length < 1 || body.daysOfWeek.length > 7)
      fields.push(
        fieldError(
          "daysOfWeek",
          "Selecciona de uno a siete días de la semana.",
        ),
      );
    for (const day of body.daysOfWeek) {
      if (day === null) continue; // The service rejects null elements after DTO validation.
      if (typeof day !== "number" || !Number.isInteger(day))
        return { code: "TYPE_MISMATCH", fields: [] };
      if (day < 1 || day > 7)
        fields.push(
          fieldError("daysOfWeek", "Usa días ISO entre uno y siete."),
        );
    }
  }
  return fields.length ? { code: "VALIDATION_FAILED", fields } : null;
}
function availabilityBatchStarts(body) {
  const firstDate = Date.parse(`${body.startDate}T00:00:00Z`);
  const lastDate = Date.parse(`${body.endDate}T00:00:00Z`);
  const dateCount = (lastDate - firstDate) / 86400000 + 1;
  if (dateCount < 1 || dateCount > 31)
    return { error: "El rango debe incluir entre una y 31 fechas locales." };
  if (
    new Set(body.daysOfWeek).size !== body.daysOfWeek.length ||
    body.daysOfWeek.some((day) => day === null)
  )
    return {
      error:
        "Los días de la semana deben ser únicos y usar valores ISO de uno a siete.",
    };
  if (
    !/^(?:[01][0-9]|2[0-3]):(?:00|30)$/.test(body.dailyStartTime) ||
    !/^(?:(?:[01][0-9]|2[0-3]):(?:00|30)|24:00)$/.test(body.dailyEndTime)
  )
    return {
      error:
        "Usa horas de inicio y fin en :00 o :30; 24:00 solo puede ser el fin.",
    };
  const minute = (value) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const firstMinute = minute(body.dailyStartTime);
  const lastMinute = minute(body.dailyEndTime);
  if (lastMinute <= firstMinute)
    return { error: "La hora final debe ser posterior a la inicial." };
  const starts = [];
  for (let date = firstDate; date <= lastDate; date += 86400000) {
    const weekday = new Date(date).getUTCDay() || 7;
    if (!body.daysOfWeek.includes(weekday)) continue;
    const localMidnight = Date.parse(
      `${new Date(date).toISOString().slice(0, 10)}T00:00:00-05:00`,
    );
    for (let time = firstMinute; time < lastMinute; time += 30) {
      starts.push(localMidnight + time * 60000);
      if (starts.length > 1000)
        return { error: "La generación supera el máximo de 1000 turnos." };
    }
  }
  if (!starts.length)
    return { error: "La generación debe producir al menos un turno." };
  if (starts.some((start) => start <= Date.now()))
    return { error: "Todos los turnos generados deben ser futuros." };
  return { starts };
}
async function handleAvailabilityBatch(
  request,
  response,
  bodyPromise,
  path,
  session,
) {
  const route =
    /^\/api\/v1\/veterinarians\/([^/]+)\/availability-slot-batches$/.exec(path);
  if (!route) return false;
  const fail = (status, code, detail, fields = []) => {
    problem(response, status, code, detail, fields);
    return true;
  };
  const actor = session.user;
  if (
    actor.role !== "ADMINISTRATOR" ||
    !actor.permissions.includes("VETERINARIAN_AVAILABILITY_MANAGE")
  )
    return fail(403, "ACCESS_DENIED", "La cuenta no puede generar turnos.");
  if (request.method !== "POST")
    return fail(
      501,
      "SIMULATION_ENDPOINT_NOT_MODELED",
      "Esta operación no está modelada.",
    );
  const body = await bodyPromise;
  const invalid = availabilityBatchBodyError(body);
  if (invalid)
    return fail(
      400,
      invalid.code,
      "Revisa los campos del lote.",
      invalid.fields,
    );
  const veterinarianId = route[1];
  if (!veterinarians.some((item) => item.id === veterinarianId))
    return fail(
      404,
      "STAFF_RESOURCE_NOT_FOUND",
      "No se encontró el profesional solicitado.",
    );
  if (users.get(veterinarianId).status !== "ACTIVE")
    return fail(
      409,
      "VETERINARIAN_NOT_ACTIVE",
      "El veterinario debe estar activo para publicar turnos.",
    );
  const generated = availabilityBatchStarts(body);
  if (generated.error)
    return fail(400, "INVALID_AVAILABILITY_REQUEST", generated.error);
  const existing = new Set(
    availabilitySlots
      .filter((slot) => slot.veterinarianId === veterinarianId)
      .map((slot) => Date.parse(slot.startsAt)),
  );
  // Validate the entire batch before changing either slots or audit events.
  if (generated.starts.some((start) => existing.has(start)))
    return fail(
      409,
      "AVAILABILITY_SLOT_CONFLICT",
      "El lote contiene un turno que ya existe; no se creó ninguno.",
    );
  const created = generated.starts.map((start) =>
    newAvailabilitySlot(veterinarianId, start),
  );
  const events = created.map((slot) =>
    availabilityEvent(slot, actor.id, "CREATED"),
  );
  availabilitySlots.push(...created);
  availabilityEvents.push(...events);
  await mutationResponse(response, 201, {
    createdCount: created.length,
    items: created.map((slot) => ({ ...slot })),
    timeZone: TIME_ZONE,
  });
  return true;
}
async function handleAvailability(
  request,
  response,
  bodyPromise,
  path,
  session,
) {
  const route =
    /^\/api\/v1\/veterinarians\/([^/]+)\/availability-slots(?:\/([^/]+)(?:\/(status|events))?)?$/.exec(
      path,
    );
  if (!route) return false;
  const [, veterinarianId, slotId, section] = route;
  const user = session.user;
  const method = request.method;
  const fail = (status, code, detail, fields = []) => {
    problem(response, status, code, detail, fields);
    return true;
  };
  const manage =
    user.role === "ADMINISTRATOR" &&
    user.permissions.includes("VETERINARIAN_AVAILABILITY_MANAGE");
  const ownRead =
    method === "GET" &&
    section !== "events" &&
    user.role === "VETERINARIAN" &&
    user.permissions.includes("VETERINARIAN_AVAILABILITY_READ_SELF");
  if (!manage && !ownRead)
    return fail(
      403,
      "ACCESS_DENIED",
      "La cuenta no tiene permiso para esta agenda.",
    );
  if (ownRead && veterinarianId !== user.id)
    return fail(
      404,
      "AVAILABILITY_SLOT_NOT_FOUND",
      "No se encontró el turno solicitado.",
    );
  const veterinarian = veterinarians.find((item) => item.id === veterinarianId);
  if (!veterinarian)
    return fail(
      404,
      "STAFF_RESOURCE_NOT_FOUND",
      "No se encontró el profesional solicitado.",
    );
  const slot =
    slotId &&
    availabilitySlots.find(
      (item) => item.id === slotId && item.veterinarianId === veterinarianId,
    );
  if (slotId && !slot)
    return fail(
      404,
      "AVAILABILITY_SLOT_NOT_FOUND",
      "No se encontró el turno solicitado.",
    );
  if (method === "GET") {
    if (slotId && !section) {
      send(response, 200, slot);
      return true;
    }
    const url = new URL(request.url, "http://simulation.invalid");
    const page = pagination(url);
    if (!page)
      return fail(
        400,
        "INVALID_AVAILABILITY_REQUEST",
        "La paginación no es válida.",
      );
    if (section === "events") {
      send(
        response,
        200,
        pageOf(
          availabilityEvents
            .filter((event) => event.slotId === slotId)
            .sort((left, right) => left.slotVersion - right.slotVersion),
          page,
        ),
      );
      return true;
    }
    if (section)
      return fail(
        501,
        "SIMULATION_ENDPOINT_NOT_MODELED",
        "Esta operación no está modelada.",
      );
    const range = dateRange(url);
    const status = url.searchParams.get("status");
    if (
      !range ||
      (status !== null && !["PUBLISHED", "BLOCKED"].includes(status))
    )
      return fail(
        400,
        "INVALID_AVAILABILITY_REQUEST",
        "Usa un rango de 1 a 31 fechas y un estado válido.",
      );
    send(
      response,
      200,
      pageOf(
        availabilitySlots
          .filter((item) => {
            const day = new Intl.DateTimeFormat("sv-SE", {
              timeZone: TIME_ZONE,
            }).format(new Date(item.startsAt));
            return (
              item.veterinarianId === veterinarianId &&
              day >= range.from &&
              day <= range.to &&
              (status === null || item.status === status)
            );
          })
          .sort(
            (left, right) =>
              left.startsAt.localeCompare(right.startsAt) ||
              left.id.localeCompare(right.id),
          ),
        page,
      ),
    );
    return true;
  }
  const operation =
    method === "POST" && !slotId
      ? "create"
      : method === "PUT" && slotId && !section
        ? "move"
        : method === "PATCH" && section === "status"
          ? "status"
          : null;
  if (!operation)
    return fail(
      501,
      "SIMULATION_ENDPOINT_NOT_MODELED",
      "Esta operación no está modelada.",
    );
  const body = await bodyPromise;
  const invalid = availabilityBodyError(body, operation);
  if (invalid)
    return fail(
      400,
      invalid.code,
      "Revisa los datos del turno.",
      invalid.fields,
    );
  const newStart = operation !== "status" ? Date.parse(body.startsAt) : null;
  if (
    (slot && Date.parse(slot.startsAt) <= Date.now()) ||
    (newStart !== null && newStart <= Date.now())
  )
    return fail(
      409,
      "AVAILABILITY_SLOT_NOT_EDITABLE",
      "Solo se pueden crear o modificar turnos futuros.",
    );
  if (slot && slot.version !== body.expectedVersion)
    return fail(
      409,
      "CONCURRENT_UPDATE",
      "Los datos cambiaron. Actualiza la información.",
    );
  if (
    (operation !== "status" || body.status === "PUBLISHED") &&
    users.get(veterinarianId).status !== "ACTIVE"
  )
    return fail(
      409,
      "VETERINARIAN_NOT_ACTIVE",
      "El veterinario debe estar activo para publicar o cambiar turnos.",
    );
  if (operation === "create") {
    if (
      availabilitySlots.some(
        (item) =>
          item.veterinarianId === veterinarianId &&
          Date.parse(item.startsAt) === newStart,
      )
    )
      return fail(
        409,
        "AVAILABILITY_SLOT_CONFLICT",
        "Ya existe un turno para ese veterinario y esa hora.",
      );
    const created = newAvailabilitySlot(veterinarianId, newStart);
    availabilitySlots.push(created);
    availabilityEvents.push(availabilityEvent(created, user.id, "CREATED"));
    await mutationResponse(response, 201, created, {
      location: `${path}/${created.id}`,
    });
    return true;
  }
  const previous = { ...slot };
  if (operation === "move") {
    if (newStart === Date.parse(slot.startsAt)) {
      send(response, 200, slot);
      return true;
    }
    if (referencedAvailabilitySlots.has(slotId))
      return fail(
        409,
        "AVAILABILITY_SLOT_REFERENCED_BY_APPOINTMENT",
        "Este turno tiene historial de citas y no se puede mover.",
      );
    if (
      availabilitySlots.some(
        (item) =>
          item.id !== slotId &&
          item.veterinarianId === veterinarianId &&
          Date.parse(item.startsAt) === newStart,
      )
    )
      return fail(
        409,
        "AVAILABILITY_SLOT_CONFLICT",
        "Ya existe un turno para ese veterinario y esa hora.",
      );
    slot.startsAt = new Date(newStart).toISOString();
    slot.endsAt = new Date(newStart + 30 * 60000).toISOString();
  } else {
    if (slot.status === body.status) {
      send(response, 200, slot);
      return true;
    }
    if (body.status === "BLOCKED" && occupiedAvailabilitySlots.has(slotId))
      return fail(
        409,
        "AVAILABILITY_SLOT_OCCUPIED_BY_APPOINTMENT",
        "No se puede bloquear un turno con una cita pendiente o confirmada.",
      );
    slot.status = body.status;
  }
  slot.version += 1;
  availabilityEvents.push(
    availabilityEvent(
      slot,
      user.id,
      operation === "move" ? "RESCHEDULED" : body.status,
      previous,
      body.reason.trim(),
    ),
  );
  await mutationResponse(response, 200, slot);
  return true;
}
async function authenticate(request) {
  const match = /^Bearer (\S+)$/.exec(request.headers.authorization || "");
  if (!match) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(match[1].split(".")[1], "base64url").toString(),
    );
    const stateKey = `${STATE_PREFIX}session.${claims.jti}`;
    const session = await pm.state.get(stateKey);
    const currentUser = session && users.get(session.user.id);
    if (
      !session ||
      session.token !== match[1] ||
      session.generation !== generation ||
      session.expiresAt <= Date.now() ||
      !currentUser ||
      currentUser.status !== "ACTIVE" ||
      session.authenticationVersion !== currentUser.authenticationVersion
    )
      return null;
    return { ...session, stateKey };
  } catch {
    return null;
  }
}
async function handle(request, response, bodyPromise) {
  const url = new URL(request.url, "http://simulation.invalid");
  // The simulation removes its `api` routeKey before dispatching to this member.
  const path = url.pathname.startsWith("/api/")
    ? url.pathname
    : `/api${url.pathname}`;
  const method = request.method;
  if (method === "POST" && url.pathname === "/__simulation/reset") {
    resetData();
    return send(response, 204);
  }
  // Test fixtures only: these routes do not exist in the product or OpenAPI.
  if (method === "GET" && url.pathname === "/__simulation/availability") {
    const veterinarian = veterinarians.find(
      (item) => item.email === url.searchParams.get("email"),
    );
    return veterinarian
      ? send(response, 200, {
          simulationOnly: true,
          veterinarianId: veterinarian.id,
          slots: availabilitySlots
            .filter((slot) => slot.veterinarianId === veterinarian.id)
            .map((slot) => ({
              ...slot,
              occupiedByAppointment: occupiedAvailabilitySlots.has(slot.id),
              referencedByAppointment: referencedAvailabilitySlots.has(slot.id),
            })),
        })
      : problem(
          response,
          404,
          "SIMULATION_FIXTURE_NOT_FOUND",
          "No se encontró el profesional ficticio.",
        );
  }
  if (method === "GET" && url.pathname === "/__simulation/recovery") {
    const challenge = recoveryChallenges.get(url.searchParams.get("email"));
    return challenge
      ? send(response, 200, { code: challenge.code, simulationOnly: true })
      : problem(
          response,
          404,
          "SIMULATION_FIXTURE_NOT_FOUND",
          "No hay código ficticio.",
        );
  }
  if (method === "GET" && url.pathname === "/__simulation/activation") {
    const user = [...users.values()].find(
      (item) => item.email === url.searchParams.get("email"),
    );
    const invitation =
      user &&
      invitations
        .filter((item) => item.userId === user.id && item.status === "PENDING")
        .at(-1);
    return invitation
      ? send(response, 200, {
          ...invitationResponse(invitation),
          token: invitation.token,
          simulationOnly: true,
        })
      : problem(
          response,
          404,
          "SIMULATION_FIXTURE_NOT_FOUND",
          "No hay invitación ficticia pendiente.",
        );
  }
  if (method === "POST" && url.pathname === "/__simulation/fixture") {
    const body = await bodyPromise;
    const user = [...users.values()].find((item) => item.email === body.email);
    if (body.action === "prepare-appointment-notifications") {
      const appointment = appointmentRecords().find(
        (item) => item.id === body.appointmentId,
      );
      const count = body.count ?? 26;
      if (!appointment || !Number.isInteger(count) || count < 0 || count > 26)
        return problem(
          response,
          400,
          "SIMULATION_FIXTURE_INVALID",
          "Revisa la cita ficticia y el número de avisos de 0 a 26.",
        );
      prepareAppointmentNotifications(appointment, count);
      return send(response, 204);
    }
    if (body.action === "next-notification-read") {
      if (
        !appointmentRecords().some((item) => item.id === body.appointmentId) ||
        ![
          "normal",
          "unavailable",
          "forbidden",
          "missing",
          "invalid-json",
          "extra-field",
          "foreign",
        ].includes(body.mode)
      )
        return problem(
          response,
          400,
          "SIMULATION_FIXTURE_INVALID",
          "Revisa el control de consulta de avisos.",
        );
      nextNotificationRead = {
        appointmentId: body.appointmentId,
        mode: body.mode,
        delayMs: Math.max(0, Math.min(5000, Number(body.delayMs) || 0)),
      };
      return send(response, 204);
    }
    if (body.action === "prepare-appointment-changes") {
      prepareAppointmentChanges();
      return send(response, 204);
    }
    if (body.action === "appointment-veterinarian-unavailable") {
      const appointment = appointmentRecords().find(
        (item) => item.id === body.appointmentId,
      );
      if (!appointment)
        return problem(
          response,
          404,
          "SIMULATION_FIXTURE_NOT_FOUND",
          "No existe la cita ficticia.",
        );
      const veterinarian = veterinarians.find(
        (item) => item.id === appointment.veterinarianId,
      );
      changeRecordStatus(veterinarian, users.get(veterinarian.id), "DISABLED");
      for (const item of appointmentRecords().filter(
        (entry) =>
          entry.veterinarianId === veterinarian.id &&
          ["REQUESTED", "CONFIRMED"].includes(entry.status) &&
          Date.parse(entry.endsAt) > Date.now(),
      )) {
        if (item.assignmentStatus !== "NEEDS_REASSIGNMENT") {
          const previousAssignment = item.assignmentStatus;
          item.assignmentStatus = "NEEDS_REASSIGNMENT";
          item.version += 1;
          item.updatedAt = new Date().toISOString();
          const event = appointmentEvent(
            item,
            "VETERINARIAN_DISABLED",
            null,
            item.status,
            "Veterinario no disponible en la simulación",
          );
          event.previousAssignmentStatus = previousAssignment;
          appointmentEvents.push(event);
        }
      }
      return send(response, 204);
    }
    if (body.action === "appointment-state") {
      const appointment = appointmentRecords().find(
        (item) => item.id === body.appointmentId,
      );
      if (!appointment)
        return problem(
          response,
          404,
          "SIMULATION_FIXTURE_NOT_FOUND",
          "No existe la cita ficticia.",
        );
      const metadata = appointmentMetadata.get(appointment.id);
      if (["STARTED", "ENDED"].includes(body.timing)) {
        const start =
          body.timing === "ENDED"
            ? Date.parse(`${shiftedBusinessDate(-1)}T14:00:00Z`)
            : Math.floor(Date.now() / 1_800_000) * 1_800_000;
        appointment.startsAt = new Date(start).toISOString();
        appointment.endsAt = new Date(start + 1_800_000).toISOString();
        metadata.cutoffAt = Date.parse(`${businessDate(start)}T06:00:00-05:00`);
        const slot = availabilitySlots.find(
          (item) => item.id === metadata.slotId,
        );
        if (slot) {
          slot.startsAt = appointment.startsAt;
          slot.endsAt = appointment.endsAt;
        }
      }
      if (typeof body.cutoffPassed === "boolean")
        metadata.cutoffAt = body.cutoffPassed
          ? Date.now() - 1000
          : Date.now() + 86_400_000;
      if (typeof body.participantInactive === "boolean")
        metadata.participantInactive = body.participantInactive;
      if (["ASSIGNED", "NEEDS_REASSIGNMENT"].includes(body.assignmentStatus))
        appointment.assignmentStatus = body.assignmentStatus;
      if (body.advanceVersion === true) {
        appointment.version += 1;
        appointment.updatedAt = new Date().toISOString();
        appointmentEvents.push(
          appointmentEvent(
            appointment,
            "VETERINARIAN_RESTORED",
            null,
            appointment.status,
            "Cambio concurrente ficticio",
          ),
        );
      }
      return send(response, 204);
    }
    if (
      body.action === "next-authentication" &&
      [
        "login",
        "registration",
        "recovery-request",
        "recovery-verification",
        "password-reset",
      ].includes(body.operation) &&
      (Number.isInteger(body.delayMs) ||
        body.errorStatus === 503 ||
        [
          "email",
          "fullName",
          "dateOfBirth",
          "phoneNumber",
          "password",
          "newPassword",
          "confirmNewPassword",
          "code",
        ].includes(body.fieldError))
    ) {
      nextAuthentication = {
        operation: body.operation,
        delayMs: Math.max(0, Math.min(10_000, body.delayMs || 0)),
        errorStatus: body.errorStatus === 503 ? 503 : undefined,
        fieldError: [
          "email",
          "fullName",
          "dateOfBirth",
          "phoneNumber",
          "password",
          "newPassword",
          "confirmNewPassword",
          "code",
        ].includes(body.fieldError)
          ? body.fieldError
          : undefined,
      };
      return send(response, 204);
    }
    if (
      body.action === "next-mutation" &&
      (typeof body.drop === "boolean" ||
        Number.isInteger(body.delayMs) ||
        ["empty", "invalid-json", "timeout"].includes(body.responseMode))
    ) {
      nextMutation = {
        drop: body.drop === true,
        delayMs: Math.max(0, Math.min(10_000, body.delayMs || 0)),
        responseMode: ["empty", "invalid-json", "timeout"].includes(
          body.responseMode,
        )
          ? body.responseMode
          : undefined,
      };
      return send(response, 204);
    }
    if (body.action === "availability-state") {
      const slot = availabilitySlots.find((item) => item.id === body.slotId);
      if (!slot)
        return problem(
          response,
          404,
          "SIMULATION_FIXTURE_NOT_FOUND",
          "No se encontró el turno ficticio.",
        );
      if (
        typeof body.occupied !== "boolean" ||
        typeof body.referenced !== "boolean" ||
        (body.occupied && !body.referenced)
      )
        return problem(
          response,
          400,
          "SIMULATION_INVALID_FIXTURE",
          "Indica ocupación y referencia compatibles.",
        );
      if (body.occupied) occupiedAvailabilitySlots.add(slot.id);
      else occupiedAvailabilitySlots.delete(slot.id);
      if (body.referenced) referencedAvailabilitySlots.add(slot.id);
      else referencedAvailabilitySlots.delete(slot.id);
      return send(response, 204);
    }
    if (!user)
      return problem(
        response,
        404,
        "SIMULATION_FIXTURE_NOT_FOUND",
        "No se encontró la cuenta ficticia.",
      );
    if (body.action === "expand-pets" && user.role === "OWNER") {
      expandedPetOwnerId = user.id;
      return send(response, 204);
    }
    const history = invitations.filter((item) => item.userId === user.id);
    if (
      body.action === "age-invitations" &&
      Number.isInteger(body.seconds) &&
      body.seconds >= 0 &&
      body.seconds <= 172800
    ) {
      for (const invitation of history)
        invitation.createdAt -= body.seconds * 1000;
      return send(response, 204);
    }
    if (body.action === "expire-invitation") {
      history.forEach((invitation) => {
        invitation.expiresAt = Date.now() - 1;
      });
      return send(response, 204);
    }
    return problem(
      response,
      400,
      "SIMULATION_INVALID_FIXTURE",
      "La operación de prueba no es válida.",
    );
  }
  if (method === "POST" && path === "/api/v1/auth/password-recoveries") {
    const body = await bodyPromise;
    if (
      !objectWithFields(body, ["email"]) ||
      typeof body.email !== "string" ||
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
    )
      return problem(response, 400, "VALIDATION_FAILED", "Revisa tu correo.", [
        fieldError("email", "Escribe un correo válido."),
      ]);
    if (await authenticationControl(response, "recovery-request")) return;
    const email = body.email.trim().toLowerCase();
    const previous = recoveryRequestTimes.get(email);
    if (previous !== undefined && Date.now() - previous < 60000) {
      response.setHeader("Retry-After", "60");
      return problem(
        response,
        429,
        "PASSWORD_RECOVERY_RATE_LIMITED",
        "Espera antes de solicitar otro código.",
      );
    }
    recoveryRequestTimes.set(email, Date.now());
    const user = [...users.values()].find(
      (item) => item.email === email && item.status === "ACTIVE",
    );
    if (user)
      recoveryChallenges.set(email, {
        userId: user.id,
        code: "012345",
        createdAt: Date.now(),
        attempts: 0,
        authenticationVersion: user.authenticationVersion,
        codeExpiresAt: Date.now() + 600000,
        resetToken: null,
      });
    return send(response, 202, {
      message:
        "Si existe una cuenta activa con este correo, recibirás un código para recuperar el acceso.",
    });
  }
  if (
    method === "POST" &&
    path === "/api/v1/auth/password-recoveries/verifications"
  ) {
    const body = await bodyPromise;
    if (
      !objectWithFields(body, ["email", "code"]) ||
      typeof body.email !== "string" ||
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
      typeof body.code !== "string" ||
      !/^[0-9]{6}$/.test(body.code)
    )
      return problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa el correo y los seis dígitos.",
      );
    if (await authenticationControl(response, "recovery-verification")) return;
    const challenge = recoveryChallenges.get(body.email.trim().toLowerCase());
    const user = challenge && users.get(challenge.userId);
    const invalid =
      !challenge ||
      !user ||
      user.status !== "ACTIVE" ||
      user.authenticationVersion !== challenge.authenticationVersion ||
      challenge.codeExpiresAt <= Date.now() ||
      challenge.attempts >= 5 ||
      !challenge.code;
    if (invalid || challenge.code !== body.code) {
      if (challenge) challenge.attempts += 1;
      return problem(
        response,
        400,
        "INVALID_PASSWORD_RECOVERY_CODE",
        "El código es inválido, venció o ya fue usado.",
      );
    }
    challenge.code = null;
    challenge.resetToken = randomBytes(32).toString("base64url");
    challenge.resetExpiresAt = Date.now() + 300000;
    return mutationResponse(response, 200, {
      resetToken: challenge.resetToken,
      expiresIn: 300,
    });
  }
  if (method === "POST" && path === "/api/v1/auth/password-resets") {
    const body = await bodyPromise;
    if (
      !objectWithFields(body, [
        "resetToken",
        "newPassword",
        "confirmNewPassword",
      ])
    )
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "La estructura no es válida.",
      );
    const errors = [];
    if (
      typeof body.resetToken !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.resetToken)
    )
      errors.push(fieldError("resetToken", "El permiso no es válido."));
    for (const field of ["newPassword", "confirmNewPassword"]) {
      if (
        typeof body[field] !== "string" ||
        !body[field].trim() ||
        [...body[field]].length < 15 ||
        [...body[field]].length > 128 ||
        body[field].toLowerCase() === "films+pic+galeries"
      )
        errors.push(
          fieldError(
            field,
            "Usa entre 15 y 128 caracteres y una contraseña menos común.",
          ),
        );
    }
    if (errors.length)
      return problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa los campos indicados.",
        errors,
      );
    if (body.newPassword !== body.confirmNewPassword)
      return problem(
        response,
        400,
        "PASSWORD_CONFIRMATION_MISMATCH",
        "Las contraseñas no coinciden.",
      );
    if (await authenticationControl(response, "password-reset")) return;
    const entry = [...recoveryChallenges.entries()].find(
      ([, item]) => item.resetToken === body.resetToken,
    );
    const challenge = entry?.[1];
    const user = challenge && users.get(challenge.userId);
    if (
      !challenge ||
      !user ||
      user.status !== "ACTIVE" ||
      challenge.resetExpiresAt <= Date.now() ||
      user.authenticationVersion !== challenge.authenticationVersion
    )
      return problem(
        response,
        400,
        "INVALID_PASSWORD_RESET_TOKEN",
        "El permiso venció o ya fue usado.",
      );
    user.password = body.newPassword;
    user.authenticationVersion += 1;
    recoveryChallenges.delete(entry[0]);
    return mutationResponse(response, 204);
  }
  if (method === "POST" && path === "/api/v1/auth/registrations") {
    const body = await bodyPromise;
    if (
      !objectWithFields(body, [
        "email",
        "fullName",
        "dateOfBirth",
        "phoneNumber",
        "password",
      ])
    )
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "La estructura del registro no es válida.",
      );
    const errors = signupErrors(body);
    if (errors.length)
      return problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa los campos indicados.",
        errors,
      );
    if (await authenticationControl(response, "registration")) return;
    const email = body.email.trim().toLowerCase();
    if ([...users.values()].some((user) => user.email === email))
      return problem(
        response,
        409,
        "EMAIL_ALREADY_REGISTERED",
        "Este correo ya está registrado. Puedes iniciar sesión o recuperar tu contraseña.",
      );
    const user = {
      id: randomUUID(),
      email,
      role: "OWNER",
      status: "ACTIVE",
      password: body.password,
      authenticationVersion: 0,
      permissions: permissions.OWNER,
    };
    users.set(user.id, user);
    ownerProfiles.set(user.id, {
      fullName: body.fullName.trim(),
      dateOfBirth: body.dateOfBirth,
      phoneNumber: body.phoneNumber,
    });
    // Signup returns a receipt only: no session, role, password or Location.
    return mutationResponse(response, 201, { id: user.id, email });
  }
  if (method === "POST" && path === "/api/v1/auth/account-activations") {
    const body = await bodyPromise;
    if (!objectWithFields(body, ["token", "password", "confirmPassword"]))
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "La estructura de activación no es válida.",
      );
    const errors = [];
    if (
      typeof body.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.token)
    )
      errors.push(
        fieldError("token", "El enlace no tiene el formato correcto."),
      );
    for (const field of ["password", "confirmPassword"])
      if (
        typeof body[field] !== "string" ||
        [...body[field]].length < 15 ||
        [...body[field]].length > 128 ||
        // Only entry of length >= 15 in the backend's versioned 10k list.
        body[field].toLowerCase() === "films+pic+galeries"
      )
        errors.push(
          fieldError(
            field,
            "Usa entre 15 y 128 caracteres y una contraseña menos común.",
          ),
        );
    if (errors.length)
      return problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa los campos indicados.",
        errors,
      );
    if (body.password !== body.confirmPassword)
      return problem(
        response,
        400,
        "PASSWORD_CONFIRMATION_MISMATCH",
        "La confirmación debe coincidir exactamente con la contraseña.",
      );
    const invitation = invitations.find((item) => item.token === body.token);
    const user = invitation && users.get(invitation.userId);
    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt <= Date.now() ||
      !user ||
      user.status !== "PENDING_ACTIVATION" ||
      user.password
    )
      return problem(
        response,
        400,
        "STAFF_INVITATION_INVALID",
        "El enlace de activación es inválido, venció o ya fue utilizado.",
      );
    invitation.status = "CONSUMED";
    user.password = body.password;
    user.authenticationVersion += 1;
    changeRecordStatus(
      sourceForUser(user).find((item) => item.id === user.id),
      user,
      "ACTIVE",
    );
    return mutationResponse(response, 204);
  }
  if (method === "POST" && path === "/api/v1/auth/sessions") {
    const body = await bodyPromise;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      Object.keys(body).some((key) => !["email", "password"].includes(key))
    ) {
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "El acceso requiere correo y contraseña de simulación.",
      );
    }
    if (await authenticationControl(response, "login")) return;
    const errors = [];
    if (
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
    )
      errors.push(fieldError("email", "Escribe un correo electrónico válido."));
    if (!body.password.trim() || [...body.password].length > 128)
      errors.push(
        fieldError(
          "password",
          "Escribe una contraseña de hasta 128 caracteres.",
        ),
      );
    if (errors.length)
      return problem(
        response,
        400,
        "VALIDATION_FAILED",
        "Revisa los campos indicados.",
        errors,
      );
    const user = [...users.values()].find(
      (account) => account.email === body.email.trim().toLowerCase(),
    );
    if (!user || user.status !== "ACTIVE" || body.password !== user.password)
      return problem(
        response,
        401,
        "INVALID_CREDENTIALS",
        "Revisa el correo y la contraseña de simulación.",
      );
    const issuedAt = Math.floor(Date.now() / 1000);
    const claims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      iss: "grownupsvet-local-simulation",
      aud: ["grownupsvet-clients"],
      iat: issuedAt,
      exp: issuedAt + EXPIRES_IN_SECONDS,
      jti: randomUUID(),
      authentication_version: user.authenticationVersion,
    };
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const accessToken = `${encode({ alg: "RS256", typ: "JWT", kid: "simulation-only" })}.${encode(claims)}.${Buffer.from("not-a-valid-production-signature").toString("base64url")}`;
    await pm.state.set(`${STATE_PREFIX}session.${claims.jti}`, {
      token: accessToken,
      user: publicUser(user),
      authenticationVersion: user.authenticationVersion,
      generation,
      expiresAt: claims.exp * 1000,
    });
    return send(response, 200, {
      accessToken,
      tokenType: "Bearer",
      expiresIn: EXPIRES_IN_SECONDS,
      user: publicUser(user),
    });
  }
  const modeled =
    path === "/api/v1/auth/sessions/current" ||
    path === "/api/v1/users/me" ||
    path === "/api/v1/pets" ||
    path === "/api/v1/availability-slots" ||
    /^\/api\/v1\/pets\/[^/]+$/.test(path) ||
    path === "/api/v1/administrators" ||
    path === "/api/v1/veterinarians" ||
    /^\/api\/v1\/(administrators|veterinarians)\/[^/]+(?:\/status)?$/.test(
      path,
    ) ||
    /^\/api\/v1\/staff\/[^/]+\/invitations$/.test(path) ||
    /^\/api\/v1\/veterinarians\/[^/]+\/availability-slot-batches$/.test(path) ||
    /^\/api\/v1\/veterinarians\/[^/]+\/availability-slots(?:\/[^/]+(?:\/(?:status|events))?)?$/.test(
      path,
    ) ||
    /^\/api\/v1\/appointments(?:\/[^/]+(?:\/(?:status|events|reschedulings|veterinarian-reassignments))?)?$/.test(
      path,
    ) ||
    /^\/api\/v1\/appointments\/[^/]+\/notifications$/.test(path);
  if (!modeled)
    return problem(
      response,
      501,
      "SIMULATION_ENDPOINT_NOT_MODELED",
      "Esta operación no está modelada; no se contactó a Cloud Run.",
    );
  const session = await authenticate(request);
  if (!session)
    return problem(
      response,
      401,
      "AUTHENTICATION_REQUIRED",
      "La sesión de simulación no es válida o ya terminó.",
    );
  if (method === "DELETE" && path === "/api/v1/auth/sessions/current") {
    await pm.state.set(session.stateKey, null);
    return send(response, 204);
  }
  if (
    await handleAvailabilityBatch(request, response, bodyPromise, path, session)
  )
    return;
  if (await handleAvailability(request, response, bodyPromise, path, session))
    return;
  if (await handleStaff(request, response, bodyPromise, path, session)) return;
  if (await handleAppointmentNotifications(request, response, path, session))
    return;
  if (await handleAppointments(request, response, bodyPromise, path, session))
    return;
  if (method !== "GET" || path === "/api/v1/auth/sessions/current")
    return problem(
      response,
      501,
      "SIMULATION_ENDPOINT_NOT_MODELED",
      "Esta operación no está modelada.",
    );
  const user = session.user;
  const forbidden = () =>
    problem(response, 403, "ACCESS_DENIED", "El rol no permite esta consulta.");
  if (path === "/api/v1/users/me") {
    if (user.role !== "OWNER") return forbidden();
    return send(response, 200, {
      id: user.id,
      email: user.email,
      role: user.role,
      active: true,
      fullName:
        user.id === accounts[3].id
          ? "Propietario de simulación 1"
          : "Propietario de simulación 2",
      dateOfBirth: "1960-05-15",
      phoneNumber: "+573001234567",
      profilePhotoUrl: null,
      ...(ownerProfiles.get(user.id) ?? {}),
    });
  }
  const page = pagination(url);
  if (!page)
    return problem(
      response,
      400,
      "INVALID_PAGINATION",
      "La paginación solicitada no es válida.",
    );
  if (path === "/api/v1/availability-slots") {
    if (!user.permissions.includes("VETERINARIAN_AVAILABILITY_READ_AVAILABLE"))
      return forbidden();
    const range = dateRange(url);
    const tomorrow = new Date(
      Date.parse(`${businessDate()}T00:00:00Z`) + 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const horizon = new Date(
      Date.parse(`${businessDate()}T00:00:00Z`) + 60 * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    if (!range)
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "Usa un rango de hasta 31 fechas locales.",
      );
    const veterinarianId = url.searchParams.get("veterinarianId");
    const visible = availabilitySlots
      .filter((slot) => {
        const day = new Intl.DateTimeFormat("sv-SE", {
          timeZone: TIME_ZONE,
        }).format(new Date(slot.startsAt));
        return (
          slot.status === "PUBLISHED" &&
          users.get(slot.veterinarianId)?.status === "ACTIVE" &&
          !occupiedAvailabilitySlots.has(slot.id) &&
          day >= range.from &&
          day <= range.to &&
          day >= tomorrow &&
          day <= horizon &&
          (!veterinarianId || veterinarianId === slot.veterinarianId)
        );
      })
      .sort(
        (left, right) =>
          left.startsAt.localeCompare(right.startsAt) ||
          left.id.localeCompare(right.id),
      )
      .map(({ status, ...slot }) => {
        void status;
        return {
          ...slot,
          veterinarianFullName: veterinarians.find(
            (item) => item.id === slot.veterinarianId,
          ).fullName,
        };
      });
    return send(response, 200, pageOf(visible, page));
  }
  if (path === "/api/v1/administrators" || path === "/api/v1/veterinarians") {
    if (
      user.role !==
      (path.endsWith("administrators") ? "SUPER_ADMIN" : "ADMINISTRATOR")
    )
      return forbidden();
    const requiredPermission = path.endsWith("administrators")
      ? "ADMINISTRATOR_MANAGE"
      : "VETERINARIAN_MANAGE";
    if (!user.permissions.includes(requiredPermission)) return forbidden();
    if (
      path.endsWith("administrators") &&
      user.email === "forbidden@roles.test"
    ) {
      return forbidden();
    }
    if (
      path.endsWith("veterinarians") &&
      user.email === "flaky-administrator@roles.test"
    ) {
      const counterKey = `${STATE_PREFIX}${generation}.veterinarianReads.${user.id}`;
      const readCount = ((await pm.state.get(counterKey)) ?? 0) + 1;
      await pm.state.set(counterKey, readCount);
      if (readCount === 2) {
        return problem(
          response,
          503,
          "SIMULATION_TEMPORARY_UNAVAILABLE",
          "Fallo temporal simulado: reintenta la consulta sin cerrar la sesión.",
        );
      }
    }
    const status = url.searchParams.get("status");
    if (status !== null && !statuses.includes(status))
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "El estado de cuenta no es válido.",
      );
    const source = path.endsWith("administrators")
      ? administrators
      : veterinarians;
    return send(
      response,
      200,
      pageOf(
        source
          .filter((item) => status === null || item.status === status)
          .sort(
            (left, right) =>
              right.createdAt.localeCompare(left.createdAt) ||
              left.id.localeCompare(right.id),
          ),
        page,
      ),
    );
  }
  if (path.startsWith("/api/v1/pets")) {
    if (user.role !== "OWNER") return forbidden();
    const ownPets = pets.filter((pet) => pet.ownerId === user.id);
    if (expandedPetOwnerId === user.id) {
      for (let index = 1; index <= 24; index += 1)
        ownPets.push({
          ...pets[0],
          id: recordId("c2000000", index),
          ownerId: user.id,
          name: `Mascota adicional ${String(index).padStart(2, "0")}`,
        });
    }
    const publicPet = ({ ownerId, ...pet }) => {
      void ownerId;
      return pet;
    };
    if (path !== "/api/v1/pets") {
      const pet = ownPets.find((item) => path.endsWith(`/${item.id}`));
      return pet
        ? send(response, 200, publicPet(pet))
        : problem(
            response,
            404,
            "PET_NOT_FOUND",
            "No se encontró esa mascota propia.",
          );
    }
    const active = url.searchParams.get("active");
    if (active !== null && !["true", "false"].includes(active))
      return problem(
        response,
        400,
        "INVALID_REQUEST",
        "El filtro active debe ser booleano.",
      );
    return send(
      response,
      200,
      pageOf(
        ownPets
          .filter(
            (pet) => active === null || pet.active === (active === "true"),
          )
          .map(publicPet),
        page,
      ),
    );
  }
  return problem(
    response,
    501,
    "SIMULATION_ENDPOINT_NOT_MODELED",
    "Esta operación no está modelada.",
  );
}
http
  .createServer((request, response) => {
    const bodyPromise = readBody(request);
    void bodyPromise.catch(() => {});
    handle(request, response, bodyPromise).catch((error) => {
      problem(
        response,
        error.message === "INVALID_JSON" ? 400 : 500,
        error.message === "INVALID_JSON"
          ? "INVALID_REQUEST"
          : "SIMULATION_INTERNAL_ERROR",
        "No se pudo procesar la petición local de simulación.",
      );
    });
  })
  .listen(Number(process.env.PORT || 4901));
