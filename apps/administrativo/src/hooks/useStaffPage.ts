import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type Page } from "@grownupsvet/api-client";
import { createStaffPageRequestRunner } from "./staffPageRequests";

interface StaffPageState<T> {
  requestKey: string;
  page: Page<T> | null;
  error: string | null;
  loading: boolean;
}

export function useStaffPage<T>(
  queryKey: string,
  load: (signal: AbortSignal) => Promise<Page<T>>,
  initialPage?: Page<T>,
) {
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = `${queryKey}:${retryCount}`;
  const runner = useRef(
    createStaffPageRequestRunner<T>(initialPage ? queryKey : undefined),
  );
  const [state, setState] = useState<StaffPageState<T>>(() => ({
    requestKey,
    page: initialPage ?? null,
    error: null,
    loading: !initialPage,
  }));

  useEffect(() => {
    return runner.current({
      queryKey,
      forceReload: retryCount > 0,
      load,
      onStarted: () =>
        setState({ requestKey, page: null, error: null, loading: true }),
      onResolved: (page) =>
        setState({ requestKey, page, error: null, loading: false }),
      onRejected: (error: unknown) => {
        if (
          error instanceof Error &&
          ["AbortError", "StaleSessionRequestError"].includes(error.name)
        ) {
          return;
        }
        const message =
          error instanceof ApiError && error.status === 403
            ? "No tienes permiso para consultar esta información. Puedes reintentar o cerrar sesión."
            : error instanceof ApiError && error.status === 401
              ? "Tu sesión terminó. Ingresa de nuevo."
              : "No pudimos cargar la información. Revisa tu conexión e intenta de nuevo.";
        setState({ requestKey, page: null, error: message, loading: false });
      },
    });
  }, [load, queryKey, requestKey, retryCount]);

  const retry = useCallback(() => setRetryCount((value) => value + 1), []);
  // Effects run after rendering. A new query must never show the prior page.
  const current: StaffPageState<T> =
    state.requestKey === requestKey
      ? state
      : { requestKey, page: null, error: null, loading: true };
  return { ...current, retry };
}
