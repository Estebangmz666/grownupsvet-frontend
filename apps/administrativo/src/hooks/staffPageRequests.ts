import type { Page } from "@grownupsvet/api-client";

interface StaffPageRequest<T> {
  queryKey: string;
  forceReload: boolean;
  load: (signal: AbortSignal) => Promise<Page<T>>;
  onStarted: () => void;
  onResolved: (page: Page<T>) => void;
  onRejected: (error: unknown) => void;
}

/** Coordinates the actual page loads, including repeated requests for one query. */
export function createStaffPageRequestRunner<T>(initialQueryKey?: string) {
  let seedKey = initialQueryKey;
  let generation = 0;
  let cancelCurrent: (() => void) | undefined;

  return (request: StaffPageRequest<T>): (() => void) => {
    // Preserve the confirmed first page through StrictMode's effect replay.
    if (seedKey === request.queryKey && !request.forceReload) return () => {};
    seedKey = undefined;
    cancelCurrent?.();
    const requestGeneration = ++generation;
    const controller = new AbortController();
    const isCurrent = () =>
      generation === requestGeneration && !controller.signal.aborted;
    const cancel = () => {
      controller.abort();
      if (generation === requestGeneration) {
        generation += 1;
        cancelCurrent = undefined;
      }
    };
    cancelCurrent = cancel;
    request.onStarted();
    void Promise.resolve()
      .then(() => (isCurrent() ? request.load(controller.signal) : undefined))
      .then((page) => {
        if (isCurrent() && page) request.onResolved(page);
      })
      .catch((error: unknown) => {
        if (isCurrent()) request.onRejected(error);
      });
    return cancel;
  };
}
