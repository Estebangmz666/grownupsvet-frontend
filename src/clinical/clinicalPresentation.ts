import {
  ApiError,
  isClinicalDose,
  isClinicalInstant,
  clinicalInstantMicroseconds,
  type AuthenticatedUser,
  type ClinicalEncounterResponseDTO,
  type ClinicalPrescriptionResponseDTO,
  type ClinicalControlResponseDTO,
} from "@grownupsvet/api-client";

export const clinicalTextFields = [
  { key: "reason", label: "Motivo de consulta" },
  { key: "anamnesis", label: "Anamnesis" },
  { key: "physicalExamination", label: "Examen físico" },
  { key: "diagnosis", label: "Diagnóstico" },
  { key: "carePlan", label: "Plan de cuidado" },
] as const;
export type ClinicalTextField = (typeof clinicalTextFields)[number]["key"];
export type ClinicalTextFormValues = Record<ClinicalTextField, string>;
export interface ClinicalPrescriptionFormValues extends Omit<
  ClinicalPrescriptionResponseDTO,
  "intervalHours"
> {
  intervalHours: string;
}
export type ClinicalControlFormValues = ClinicalControlResponseDTO;

export function clinicalPermissions(user: AuthenticatedUser | null) {
  return {
    canManage:
      user?.role === "VETERINARIAN" &&
      user.permissions.includes("CLINICAL_ENCOUNTER_MANAGE_ASSIGNED"),
    canReadHistory:
      !!user &&
      ((user.role === "OWNER" &&
        user.permissions.includes("CLINICAL_HISTORY_READ_SELF")) ||
        (user.role === "VETERINARIAN" &&
          user.permissions.includes("CLINICAL_HISTORY_READ_ASSIGNED"))),
  };
}
export function clinicalTextValues(
  encounter: ClinicalEncounterResponseDTO,
): ClinicalTextFormValues {
  return Object.fromEntries(
    clinicalTextFields.map(({ key }) => [key, encounter[key] ?? ""]),
  ) as ClinicalTextFormValues;
}
export function validateClinicalTexts(
  values: ClinicalTextFormValues,
  finalizing = false,
): Partial<Record<ClinicalTextField, string>> {
  return Object.fromEntries(
    clinicalTextFields.flatMap(({ key }) =>
      values[key].length > 4000
        ? [[key, "Usa hasta 4000 caracteres."]]
        : finalizing && !values[key].trim()
          ? [[key, "Completa este campo antes de finalizar."]]
          : [],
    ),
  );
}

/** UTC offsets are explicit; device timezone never changes a prescribed instant. */
export function clinicalDateTimeInput(instant: string): string {
  const date = new Date(Date.parse(instant) - 5 * 3600000);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = date.toISOString();
  const fraction = /\.(\d+)(?:Z|[+-])/.exec(instant)?.[1];
  return `${parts.slice(8, 10)}/${parts.slice(5, 7)}/${parts.slice(0, 4)} ${parts.slice(11, 19)}${fraction ? `.${fraction}` : ""}`;
}
export function clinicalInputToInstant(value: string): string | null {
  const match =
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2})(\.\d{1,6})?)?$/.exec(
      value.trim(),
    );
  if (!match) return null;
  const instant = `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${match[7] ?? ""}-05:00`;
  return isClinicalInstant(instant) ? instant : null;
}
export function formatClinicalInstant(value: string): string {
  return clinicalDateTimeInput(value);
}

export function validateClinicalTreatment(
  prescriptions: ClinicalPrescriptionFormValues[],
  controls: ClinicalControlFormValues[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (prescriptions.length > 50 || controls.length > 50)
    errors.treatment = "Cada lista admite hasta 50 elementos.";
  prescriptions.forEach((item, index) => {
    const field = (key: string, message: string) => {
      errors[`prescriptions.${index}.${key}`] = message;
    };
    for (const [key, maximum] of [
      ["medicationName", 200],
      ["doseUnit", 50],
      ["administrationRoute", 100],
    ] as const)
      if (!item[key].trim() || item[key].length > maximum)
        field(key, `Completa este campo con hasta ${maximum} caracteres.`);
    if (!isClinicalDose(item.dose.trim().replace(",", ".")))
      field(
        "dose",
        "Escribe una dosis positiva con hasta 12 dígitos enteros y 6 decimales, sin redondearla.",
      );
    if (
      !/^\d+$/.test(item.intervalHours) ||
      Number(item.intervalHours) < 1 ||
      Number(item.intervalHours) > 168
    )
      field("intervalHours", "Escribe un intervalo entero de 1 a 168 horas.");
    const start = clinicalInputToInstant(item.startsAt);
    const end = clinicalInputToInstant(item.endsAt);
    if (!start) field("startsAt", "Usa DD/MM/AAAA HH:mm, hora de Bogotá.");
    if (!end) field("endsAt", "Usa DD/MM/AAAA HH:mm, hora de Bogotá.");
    if (
      start &&
      end &&
      (clinicalInstantMicroseconds(end) <= clinicalInstantMicroseconds(start) ||
        clinicalInstantMicroseconds(end) - clinicalInstantMicroseconds(start) >
          366n * 86400000000n)
    )
      field(
        "endsAt",
        "El fin debe ser posterior al inicio, con una duración de hasta 366 días.",
      );
    if ((item.instructions?.length ?? 0) > 2000)
      field("instructions", "Usa hasta 2000 caracteres.");
  });
  controls.forEach((item, index) => {
    if (!clinicalInputToInstant(item.scheduledAt))
      errors[`controls.${index}.scheduledAt`] =
        "Usa DD/MM/AAAA HH:mm, hora de Bogotá.";
    if (!item.reason.trim() || item.reason.length > 1000)
      errors[`controls.${index}.reason`] =
        "Escribe el motivo del control con hasta 1000 caracteres.";
  });
  return errors;
}

export function clinicalFailure(error: unknown): {
  message: string;
  reconcile: boolean;
} {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404)
      return {
        message:
          "Esta atención ya no está disponible para tu cuenta. Puede haber cambiado la asignación o el permiso. Consulta de nuevo.",
        reconcile: true,
      };
    if (error.status === 409)
      return {
        message:
          error.errorCode === "CLINICAL_APPOINTMENT_NOT_STARTED"
            ? "La cita aún no ha comenzado. Solo puedes finalizar desde la hora de inicio del turno. Consulta de nuevo antes de continuar."
            : "La cita o la atención cambió. Conservamos lo que escribiste. Consulta la versión vigente y revísala antes de volver a guardar.",
        reconcile: true,
      };
    if (error.status >= 400 && error.status < 500 && error.status !== 408)
      return {
        message:
          error.errorCode === "CLINICAL_REQUIRED_FIELDS_MISSING"
            ? "Completa y guarda los cinco campos clínicos antes de finalizar."
            : "No se aceptó el cambio. Revisa los campos, los límites y las fechas indicadas antes de intentarlo otra vez.",
        reconcile: false,
      };
  }
  return {
    message:
      "No pudimos confirmar el resultado. Conservamos lo escrito y bloqueamos otro envío. Consulta el estado actual antes de decidir cómo continuar; no se reenviará automáticamente.",
    reconcile: true,
  };
}
