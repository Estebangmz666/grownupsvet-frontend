import { ApiError, type RegisterInput } from "@grownupsvet/api-client";

export interface RegistrationFormValues extends RegisterInput {
  confirmPassword: string;
}

export type RegistrationField = keyof RegistrationFormValues;
export type RegistrationFieldErrors = Partial<
  Record<RegistrationField, string>
>;

export const registrationFieldOrder: readonly RegistrationField[] = [
  "fullName",
  "email",
  "dateOfBirth",
  "phoneNumber",
  "password",
  "confirmPassword",
];

const fieldGuidance: Record<RegistrationField, string> = {
  fullName:
    "Escribe al menos un nombre y un apellido, con un máximo de 150 caracteres.",
  email:
    "Escribe un correo válido de hasta 254 caracteres, por ejemplo nombre@correo.com.",
  dateOfBirth:
    "Escribe una fecha real en formato AAAA-MM-DD, no futura y con una edad de hasta 130 años.",
  phoneNumber:
    "Escribe un teléfono internacional válido, con + y código de país, sin espacios ni extensiones.",
  password:
    "Usa entre 15 y 128 caracteres; puedes elegir una frase larga con espacios.",
  confirmPassword: "Las dos contraseñas deben coincidir exactamente.",
};

export function validateAuthenticationEmail(value: string): string | undefined {
  const email = value.trim();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+$/u.test(email)
  )
    return fieldGuidance.email;
  return undefined;
}

/** Preserves intentional spaces and counts Unicode code points, like the API. */
export function validateNewPassword(value: string): string | undefined {
  const length = Array.from(value).length;
  if (length < 15 || length > 128 || !value.trim())
    return fieldGuidance.password;
  return undefined;
}

/** Uses the same calendar as the API, including when the local device is elsewhere. */
export function registrationTodayInBogota(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function validDateOfBirth(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1])
    return false;
  if (value > today) return false;
  const todayYear = Number(today.slice(0, 4));
  const completedYears =
    todayYear - year - Number(today.slice(5) < value.slice(5));
  return completedYears <= 130;
}

/** The API remains authoritative for email, phone metadata and common passwords. */
export function validateRegistrationForm(
  values: RegistrationFormValues,
  today = registrationTodayInBogota(),
): RegistrationFieldErrors {
  const fields: RegistrationFieldErrors = {};
  const components = values.fullName.trim().split(/\p{Zs}+/u);
  if (
    Array.from(values.fullName).length > 150 ||
    !/^[\p{L}\p{M}\p{Zs}'’.-]+$/u.test(values.fullName) ||
    components.length < 2 ||
    components.some((component) => !/\p{L}/u.test(component))
  )
    fields.fullName = fieldGuidance.fullName;
  const emailError = validateAuthenticationEmail(values.email);
  if (emailError) fields.email = emailError;
  if (!validDateOfBirth(values.dateOfBirth.trim(), today))
    fields.dateOfBirth = fieldGuidance.dateOfBirth;
  if (!/^\+[1-9][0-9]{1,14}$/.test(values.phoneNumber.trim()))
    fields.phoneNumber = fieldGuidance.phoneNumber;
  const passwordError = validateNewPassword(values.password);
  if (passwordError) fields.password = passwordError;
  if (!values.confirmPassword || values.confirmPassword !== values.password)
    fields.confirmPassword = fieldGuidance.confirmPassword;
  return fields;
}

/** Confirmation and role are never sent to public owner registration. */
export function registrationRequest(
  values: RegistrationFormValues,
): RegisterInput {
  return {
    fullName: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
    dateOfBirth: values.dateOfBirth.trim(),
    phoneNumber: values.phoneNumber.trim(),
    password: values.password,
  };
}

export interface RegistrationFailure {
  fields: RegistrationFieldErrors;
  message: string;
  uncertainOutcome: boolean;
  existingAccount: boolean;
}

/** Fixed guidance avoids exposing arbitrary upstream details or submitted values. */
export function registrationFailure(error: unknown): RegistrationFailure {
  const fields: RegistrationFieldErrors = {};
  if (error instanceof ApiError) {
    for (const failure of error.fieldErrors) {
      const field = registrationFieldOrder.find(
        (name) => name === failure.field,
      );
      if (!field) continue;
      fields[field] =
        field === "password" && failure.code === "COMMON_PASSWORD"
          ? "Elige una contraseña menos común; puedes usar una frase con varias palabras."
          : fieldGuidance[field];
    }
    if (error.errorCode === "EMAIL_ALREADY_REGISTERED") {
      fields.email =
        "Este correo ya está registrado. Inicia sesión o recupera tu contraseña.";
      return {
        fields,
        message:
          "Ya existe una cuenta con ese correo. Puedes iniciar sesión o recuperar tu contraseña.",
        uncertainOutcome: false,
        existingAccount: true,
      };
    }
    if (error.status >= 400 && error.status < 500 && error.status !== 408) {
      return {
        fields,
        message:
          error.status === 429
            ? "Hay demasiados intentos. Espera un momento antes de volver a intentar."
            : Object.keys(fields).length > 0
              ? "Revisa los campos indicados antes de continuar."
              : "No pudimos aceptar el registro. Revisa los datos o intenta más tarde.",
        uncertainOutcome: false,
        existingAccount: false,
      };
    }
  }
  return {
    fields,
    message:
      "No pudimos confirmar si tu cuenta se creó. Para evitar enviar otro registro, intenta iniciar sesión con los datos que elegiste o recuperar tu contraseña. Si no puedes ingresar, contacta a la clínica.",
    uncertainOutcome: true,
    existingAccount: false,
  };
}
