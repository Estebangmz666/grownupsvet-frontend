import { ApiError, type Page } from "@grownupsvet/api-client";
import type {
  AdministratorResponseDTO,
  VeterinarianResponseDTO,
} from "@api-client/staff.types";

export type StaffAccount = AdministratorResponseDTO | VeterinarianResponseDTO;
export type StaffAccountKind = "administrators" | "veterinarians";
export type StaffFormField = keyof StaffFormValues;
export interface StaffFormValues {
  email: string;
  fullName: string;
  professionalPhoneNumber: string;
  professionalRegistrationNumber: string;
  baseDegreeTitle: string;
  baseDegreeInstitution: string;
  biography: string;
}
export type StaffFormErrors = Partial<Record<StaffFormField, string>>;

export function staffFormValues(account?: StaffAccount): StaffFormValues {
  const veterinarian =
    account && "professionalRegistrationNumber" in account
      ? account
      : undefined;
  return {
    email: account?.email ?? "",
    fullName: account?.fullName ?? "",
    professionalPhoneNumber: veterinarian?.professionalPhoneNumber ?? "",
    professionalRegistrationNumber:
      veterinarian?.professionalRegistrationNumber ?? "",
    baseDegreeTitle: veterinarian?.baseDegreeTitle ?? "",
    baseDegreeInstitution: veterinarian?.baseDegreeInstitution ?? "",
    biography: veterinarian?.biography ?? "",
  };
}

/** Mirrors published structural constraints; phone/email metadata stay server-authoritative. */
export function validateStaffForm(
  kind: StaffAccountKind,
  values: StaffFormValues,
  creating: boolean,
): StaffFormErrors {
  const errors: StaffFormErrors = {};
  const components = values.fullName.trim().split(/\p{Zs}+/u);
  if (
    !/^[\p{L}\p{M}\p{Zs}'’.-]+$/u.test(values.fullName) ||
    Array.from(values.fullName).length > 150 ||
    components.length < 2 ||
    components.some((component) => !/\p{L}/u.test(component))
  ) {
    errors.fullName =
      "Escribe al menos dos componentes del nombre, con letras, y máximo 150 caracteres.";
  }
  if (
    creating &&
    (values.email.length < 3 ||
      values.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+$/.test(values.email))
  ) {
    errors.email = "Escribe un correo válido de máximo 254 caracteres.";
  }
  if (kind === "veterinarians") {
    if (!/^\+[1-9][0-9]{1,14}$/.test(values.professionalPhoneNumber)) {
      errors.professionalPhoneNumber =
        "Usa formato internacional: + y el número con código del país, sin espacios.";
    }
    if (
      !/^[A-Za-z0-9][A-Za-z0-9 ./-]{0,49}$/.test(
        values.professionalRegistrationNumber,
      )
    ) {
      errors.professionalRegistrationNumber =
        "Usa hasta 50 letras o números, espacios, punto, / o guion; comienza con letra o número.";
    }
    for (const field of ["baseDegreeTitle", "baseDegreeInstitution"] as const) {
      if (!values[field].trim() || values[field].length > 200) {
        errors[field] =
          "Este dato es obligatorio y admite máximo 200 caracteres.";
      }
    }
    if (values.biography.length > 2000) {
      errors.biography = "La presentación admite máximo 2000 caracteres.";
    }
  }
  return errors;
}

export function veterinarianEditableValues(values: StaffFormValues) {
  return {
    fullName: values.fullName,
    professionalPhoneNumber: values.professionalPhoneNumber,
    professionalRegistrationNumber: values.professionalRegistrationNumber,
    baseDegreeTitle: values.baseDegreeTitle,
    baseDegreeInstitution: values.baseDegreeInstitution,
    biography: values.biography.trim() ? values.biography : null,
  };
}

export function academicDetailsChanged(
  account: StaffAccount,
  values: StaffFormValues,
) {
  return (
    "baseDegreeTitle" in account &&
    (account.baseDegreeTitle !== values.baseDegreeTitle.trim() ||
      account.baseDegreeInstitution !== values.baseDegreeInstitution.trim())
  );
}

/** A status change may remove the final item from the final filtered page. */
export function reconciledStaffPage(
  currentPage: number,
  page: Page<unknown> | null,
): number {
  if (
    !page ||
    page.page !== currentPage ||
    page.items.length > 0 ||
    currentPage === 0
  )
    return currentPage;
  return Math.max(0, Math.min(currentPage - 1, page.totalPages - 1));
}

const messages: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED:
    "Ese correo ya está registrado. Consulta la cuenta existente antes de intentar otra alta.",
  PROFESSIONAL_REGISTRATION_ALREADY_EXISTS:
    "Esa matrícula profesional ya pertenece a otra cuenta.",
  STAFF_ACTIVATION_REQUIRED:
    "Esta cuenta necesita establecer su contraseña desde una invitación. Puedes solicitar una nueva invitación; habilitarla no sustituye su activación.",
  STAFF_INVITATION_STATE_CONFLICT:
    "El estado actual de la cuenta no permite esta invitación. Actualiza el detalle. Si ya tenía contraseña, utiliza habilitar o la recuperación de acceso, según corresponda.",
  STAFF_INVITATION_RATE_LIMITED:
    "Se alcanzó la espera o cuota de invitaciones. Intenta más adelante; no se conoce un tiempo exacto para el siguiente envío.",
  STAFF_INVITATIONS_UNAVAILABLE:
    "Las invitaciones no están disponibles. No se confirmó la creación ni un nuevo envío; inténtalo cuando el servicio esté habilitado.",
};

export interface StaffOperationError {
  message: string;
  fieldErrors: StaffFormErrors;
  uncertain: boolean;
  missing: boolean;
}

export function staffOperationError(
  error: unknown,
  writing = false,
): StaffOperationError {
  const fieldErrors: StaffFormErrors = {};
  if (error instanceof ApiError) {
    for (const item of error.fieldErrors) {
      if (Object.hasOwn(staffFormValues(), item.field)) {
        fieldErrors[item.field as StaffFormField] = item.message;
      }
    }
    const specific = messages[error.errorCode];
    if (error.errorCode === "EMAIL_ALREADY_REGISTERED")
      fieldErrors.email = specific;
    if (error.errorCode === "PROFESSIONAL_REGISTRATION_ALREADY_EXISTS")
      fieldErrors.professionalRegistrationNumber = specific;
    if (specific)
      return {
        message: specific,
        fieldErrors,
        uncertain: false,
        missing: false,
      };
    const message =
      error.status === 401
        ? "Tu sesión terminó. Ingresa de nuevo."
        : error.status === 403
          ? "No tienes permiso para realizar esta operación. Tu sesión se conserva."
          : error.status === 404
            ? "La cuenta ya no está disponible. Vuelve al listado y actualízalo."
            : error.status === 429
              ? "Se alcanzó un límite de solicitudes. Intenta más adelante."
              : error.status === 409
                ? "La cuenta cambió o la operación entra en conflicto con su estado. Consulta el detalle antes de continuar."
                : error.status === 400
                  ? "Revisa los datos indicados e intenta de nuevo."
                  : null;
    if (message)
      return {
        message,
        fieldErrors,
        uncertain: false,
        missing: error.status === 404,
      };
  }
  return {
    message: writing
      ? "No pudimos confirmar el resultado. La operación pudo haberse aplicado. Consulta la cuenta o el listado antes de decidir si vuelves a enviarla; no la repetiremos automáticamente."
      : "No pudimos consultar la información. Revisa tu conexión e intenta de nuevo.",
    fieldErrors,
    uncertain: writing,
    missing: false,
  };
}
