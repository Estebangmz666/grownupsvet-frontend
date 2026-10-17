/// <reference types="expo/types" />

import { Platform } from "react-native";

/**
 * Base URL de la API.
 *
 * Web usa una ruta **relativa**: el navegador pide a `/api/v1` sobre su propio
 * origen y el gateway (`proxy/`) reenvía al backend. Como la petición es de
 * mismo origen, el navegador no envía `Origin` cross-site y las reglas CORS
 * del backend nunca se evalúan, por lo que `CORS_ALLOWED_ORIGINS` puede quedar
 * vacío.
 *
 * Nativo conserva una URL absoluta porque no comparte origen con el backend.
 *
 * Para desarrollo con HMR (Metro en 8081) apunta la variable al gateway,
 * p. ej. `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`.
 */
const RELATIVE_API_BASE_URL = "/api/v1";
const LOCAL_BACKEND = "http://localhost:8080/api/v1";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === "web" ? RELATIVE_API_BASE_URL : LOCAL_BACKEND);
