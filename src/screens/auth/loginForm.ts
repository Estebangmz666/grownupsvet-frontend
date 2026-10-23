import { ApiError, type LoginInput } from "@grownupsvet/api-client";

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFormFieldErrors {
  email?: string;
  password?: string;
}

export function createLoginInput(values: LoginFormValues): LoginInput {
  return {
    email: values.email.trim().toLowerCase(),
    password: values.password,
  };
}

export function validateLoginForm(
  values: LoginFormValues,
): LoginFormFieldErrors {
  const errors: LoginFormFieldErrors = {};
  const email = values.email.trim();
  if (!email) errors.email = "Escribe tu correo electrónico.";
  else if (email.length > 254)
    errors.email = "El correo electrónico no puede superar los 254 caracteres.";
  else if (!email.includes("@") || email.startsWith("@") || email.endsWith("@"))
    errors.email =
      "Revisa el correo electrónico; por ejemplo, nombre@correo.com.";
  // Login accepts existing credentials; signup strength rules do not apply here.
  if (!values.password.trim()) errors.password = "Escribe tu contraseña.";
  else if (Array.from(values.password).length > 128)
    errors.password = "La contraseña no puede superar los 128 caracteres.";
  return errors;
}

export function loginFailure(error: unknown): {
  message: string;
  fields: LoginFormFieldErrors;
} {
  const fields: LoginFormFieldErrors = {};
  if (error instanceof ApiError) {
    if (error.status === 401 || error.errorCode === "INVALID_CREDENTIALS")
      return {
        message:
          "No pudimos iniciar sesión con esos datos. Revisa el correo y la contraseña o usa «Olvidé mi contraseña».",
        fields,
      };
    if (error.status === 429)
      return {
        message:
          "Hay demasiados intentos. Espera un momento antes de volver a iniciar sesión.",
        fields,
      };
    if (error.status === 400) {
      for (const fieldError of error.fieldErrors) {
        if (fieldError.field === "email")
          fields.email =
            "Revisa el correo electrónico; por ejemplo, nombre@correo.com.";
        if (fieldError.field === "password")
          fields.password = "Escribe tu contraseña, de hasta 128 caracteres.";
      }
      return {
        message: "Revisa los datos indicados antes de iniciar sesión.",
        fields,
      };
    }
    return {
      message:
        "No pudimos iniciar sesión por el momento. Conservamos tus datos para que puedas intentarlo más tarde.",
      fields,
    };
  }
  return {
    message:
      "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo. Conservamos los datos que escribiste.",
    fields,
  };
}
