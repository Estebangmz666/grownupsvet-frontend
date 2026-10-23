import { useContext } from "react";
import { AuthenticationContext } from "./authentication-context";
export function useAuthentication() {
  const context = useContext(AuthenticationContext);
  if (!context)
    throw new Error(
      "useAuthentication debe usarse dentro de AuthenticationProvider.",
    );
  return context;
}
