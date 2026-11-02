import { useCallback, useEffect, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { clinicalFailure } from "./clinicalPresentation";

/** Keep clinical data in the current session only; stale reads cannot repopulate a view. */
export function useClinicalRead<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    load: typeof load;
    revision: number;
    loading: boolean;
    data: T | null;
    error: string | null;
  }>({ load, revision, loading: true, data: null, error: null });
  useEffect(() => {
    const context = getApiRequestContext();
    const controller = new AbortController();
    let mounted = true;
    const current = () => mounted && isApiRequestContextCurrent(context);
    setState({ load, revision, loading: true, data: null, error: null });
    void load(controller.signal)
      .then((data) => {
        if (current())
          setState({ load, revision, loading: false, data, error: null });
      })
      .catch((error: unknown) => {
        if (current())
          setState({
            load,
            revision,
            loading: false,
            data: null,
            error: clinicalFailure(error).message,
          });
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [load, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return {
    ...(state.load === load && state.revision === revision
      ? state
      : { loading: true, data: null, error: null }),
    refresh,
  };
}
