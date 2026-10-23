import {
  ApiError,
  type VerifyPasswordRecoveryResponse,
} from "@grownupsvet/api-client";
import {
  validateAuthenticationEmail,
  validateNewPassword,
} from "./registrationForm";

export interface PasswordRecoveryFieldErrors {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export interface PasswordRecoveryFailure {
  message: string;
  fields: PasswordRecoveryFieldErrors;
  restartRecovery: boolean;
  uncertainOutcome: boolean;
}

export type PasswordRecoveryStep = "request" | "verify" | "reset";

/** Synchronous guard; interruption must be reconciled before any further write. */
export function createPasswordRecoverySubmissionGuard() {
  let focused = false;
  let generation = 0;
  let pending = false;
  let interrupted = false;
  const isCurrent = (attempt: number) =>
    focused && pending && attempt === generation;
  return {
    focus() {
      focused = true;
      generation += 1;
      interrupted ||= pending;
      pending = false;
      return interrupted;
    },
    blur() {
      focused = false;
      generation += 1;
    },
    begin() {
      if (!focused || pending || interrupted) return undefined;
      generation += 1;
      pending = true;
      return generation;
    },
    isCurrent,
    isBusy: () => pending,
    finish(attempt: number) {
      if (!isCurrent(attempt)) return false;
      pending = false;
      return true;
    },
  };
}

const confirmationGuidance =
  "Las dos contraseñas deben coincidir exactamente, incluidos los espacios.";
const passwordGuidance =
  "Usa entre 15 y 128 caracteres; puedes elegir una frase larga con espacios.";
const codeGuidance =
  "Escribe los 6 dígitos del código, incluidos los ceros iniciales.";

export function normalizeRecoveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePasswordRecoveryRequest(
  email: string,
): PasswordRecoveryFieldErrors {
  const error = validateAuthenticationEmail(email);
  return error ? { email: error } : {};
}

export function validatePasswordRecoveryCode(
  email: string,
  code: string,
): PasswordRecoveryFieldErrors {
  const fields = validatePasswordRecoveryRequest(email);
  if (!/^[0-9]{6}$/.test(code.trim())) fields.code = codeGuidance;
  return fields;
}

export function validPasswordResetToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function validRecoveryVerificationResponse(
  value: unknown,
): value is VerifyPasswordRecoveryResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<VerifyPasswordRecoveryResponse>;
  return (
    validPasswordResetToken(response.resetToken) &&
    typeof response.expiresIn === "number" &&
    Number.isSafeInteger(response.expiresIn) &&
    response.expiresIn > 0
  );
}

export function validatePasswordReset(
  newPassword: string,
  confirmNewPassword: string,
): PasswordRecoveryFieldErrors {
  const fields: PasswordRecoveryFieldErrors = {};
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) fields.newPassword = passwordError;
  const confirmationError = validateNewPassword(confirmNewPassword);
  if (confirmationError) fields.confirmNewPassword = confirmationError;
  if (!confirmNewPassword || newPassword !== confirmNewPassword)
    fields.confirmNewPassword = confirmationGuidance;
  return fields;
}

/** Known validation failures never imply that a valid reset token has expired. */
export function passwordRecoveryFailure(
  step: PasswordRecoveryStep,
  error: unknown,
): PasswordRecoveryFailure {
  const fields: PasswordRecoveryFieldErrors = {};
  const failure = (
    message: string,
    restartRecovery = false,
    uncertainOutcome = false,
  ): PasswordRecoveryFailure => ({
    message,
    fields,
    restartRecovery,
    uncertainOutcome,
  });

  if (error instanceof ApiError) {
    for (const invalidField of error.fieldErrors) {
      if (invalidField.field === "email" && step !== "reset")
        fields.email =
          "Revisa el correo electrónico, por ejemplo nombre@correo.com.";
      if (invalidField.field === "code" && step === "verify")
        fields.code = codeGuidance;
      if (
        step === "reset" &&
        (invalidField.field === "newPassword" ||
          invalidField.field === "confirmNewPassword")
      )
        fields[invalidField.field] =
          invalidField.code === "COMMON_PASSWORD"
            ? "Elige una contraseña menos común; puedes usar una frase con varias palabras."
            : invalidField.code === "PASSWORD_MISMATCH"
              ? confirmationGuidance
              : passwordGuidance;
    }

    if (
      step === "reset" &&
      (error.errorCode === "INVALID_PASSWORD_RESET_TOKEN" ||
        error.fieldErrors.some(
          (invalidField) => invalidField.field === "resetToken",
        ))
    )
      return failure(
        "El permiso para cambiar tu contraseña no es válido, ya se usó o venció. Solicita un nuevo código para continuar.",
        true,
      );
    if (
      step === "verify" &&
      error.errorCode === "INVALID_PASSWORD_RECOVERY_CODE"
    ) {
      fields.code =
        "El código no es válido o venció. Revisa el más reciente o solicita uno nuevo.";
      return failure("Revisa el código indicado o solicita uno nuevo.");
    }
    if (
      step === "reset" &&
      error.errorCode === "PASSWORD_CONFIRMATION_MISMATCH"
    ) {
      fields.confirmNewPassword = confirmationGuidance;
      return failure(
        "Las contraseñas deben coincidir. Revisa la confirmación.",
      );
    }
    if (error.status === 429)
      return failure(
        "Hay demasiados intentos. Espera unos minutos antes de volver a intentar.",
      );
    if (error.errorCode === "PASSWORD_RECOVERY_UNAVAILABLE")
      return failure(
        "La recuperación no está disponible en este momento. Intenta más tarde o contacta a la clínica.",
      );
    if (error.status >= 400 && error.status < 500 && error.status !== 408)
      return failure(
        Object.keys(fields).length
          ? "Revisa los campos indicados antes de continuar."
          : "No pudimos aceptar la solicitud. Revisa los datos o intenta más tarde.",
        !!fields.email && step === "verify",
      );
  }

  if (step === "reset")
    return failure(
      "No pudimos confirmar si la contraseña cambió. Antes de volver a cambiarla, intenta iniciar sesión con la nueva contraseña. Si no puedes ingresar, solicita un nuevo código. No enviaremos otro cambio desde esta pantalla.",
      false,
      true,
    );
  if (step === "verify")
    return failure(
      "No pudimos confirmar la verificación. El código pudo haberse usado. Solicita uno nuevo para continuar de forma segura.",
      true,
      true,
    );
  return failure(
    "No pudimos confirmar el envío. Revisa tu correo y la carpeta de correo no deseado. Si recibiste un código, puedes continuar con él; espera unos minutos antes de solicitar otro.",
    false,
    true,
  );
}
