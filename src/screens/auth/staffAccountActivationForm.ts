import { ApiError } from "@grownupsvet/api-client";

export interface StaffAccountActivationFieldErrors {
  password?: string;
  confirmPassword?: string;
}

export interface StaffAccountActivationFailure {
  message: string;
  invalidInvitation: boolean;
  uncertain: boolean;
  fields: StaffAccountActivationFieldErrors;
}

export function validateStaffAccountActivationForm(
  password: string,
  confirmPassword: string,
): StaffAccountActivationFieldErrors {
  const errors: StaffAccountActivationFieldErrors = {};
  const length = Array.from(password).length;
  if (length < 15 || length > 128 || !password.trim())
    errors.password =
      "Usa entre 15 y 128 caracteres; puede ser una frase larga.";
  if (!confirmPassword || password !== confirmPassword)
    errors.confirmPassword = "Las dos contraseñas deben coincidir exactamente.";
  return errors;
}

export function staffAccountActivationFailure(
  error: unknown,
): StaffAccountActivationFailure {
  const fields: StaffAccountActivationFieldErrors = {};
  if (error instanceof ApiError) {
    for (const failure of error.fieldErrors) {
      if (failure.field === "password")
        fields.password =
          "Revisa la contraseña: usa una frase de 15 a 128 caracteres y evita contraseñas comunes.";
      if (failure.field === "confirmPassword")
        fields.confirmPassword =
          "La confirmación debe cumplir los requisitos y coincidir con la contraseña.";
    }
    if (error.errorCode === "STAFF_INVITATION_INVALID")
      return {
        message:
          "Esta invitación no es válida, ya se usó o venció. Solicita una nueva invitación a la clínica.",
        invalidInvitation: true,
        uncertain: false,
        fields,
      };
    if (error.errorCode === "PASSWORD_CONFIRMATION_MISMATCH")
      fields.confirmPassword =
        "Las dos contraseñas deben coincidir exactamente.";
    if (error.status === 400)
      return {
        message: "Revisa los datos de la contraseña e intenta de nuevo.",
        invalidInvitation: false,
        uncertain: false,
        fields,
      };
    if (
      error.status === 503 &&
      error.errorCode === "STAFF_INVITATIONS_UNAVAILABLE"
    )
      return {
        message:
          "La activación no está disponible por el momento. Conserva el enlace e intenta más tarde o contacta a la clínica.",
        invalidInvitation: false,
        uncertain: false,
        fields,
      };
    if (error.status === 429)
      return {
        message:
          "Hay demasiados intentos. Espera un momento antes de reintentar.",
        invalidInvitation: false,
        uncertain: false,
        fields,
      };
  }
  return {
    message:
      "No pudimos confirmar el resultado. La cuenta pudo haberse activado. Antes de repetir la activación, intenta iniciar sesión con el correo invitado y la contraseña que elegiste. Si no puedes ingresar, abre de nuevo tu enlace. No enviaremos otra activación desde esta pantalla.",
    invalidInvitation: false,
    uncertain: true,
    fields: {},
  };
}
