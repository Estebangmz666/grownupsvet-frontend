import type { ApiRequestContext } from "@grownupsvet/api-client";

export interface StaffMutationEnvironment {
  captureContext: () => ApiRequestContext;
  isContextCurrent: (context: ApiRequestContext) => boolean;
}

/** One write at a time. A cancelled wait cannot undo a server-side mutation. */
export function createStaffMutationRunner(
  environment: StaffMutationEnvironment,
) {
  let pending = false;
  let generation = 0;
  return {
    cancel() {
      generation += 1;
      pending = false;
    },
    async run<T>(operation: {
      write: (context: ApiRequestContext) => Promise<T>;
      onStarted: () => void;
      onResolved: (value: T, context: ApiRequestContext) => void;
      onRejected: (error: unknown) => void;
      onFinished: () => void;
    }): Promise<void> {
      if (pending) return;
      const context = environment.captureContext();
      if (!environment.isContextCurrent(context)) return;
      pending = true;
      const requestGeneration = ++generation;
      const current = () =>
        generation === requestGeneration &&
        environment.isContextCurrent(context);
      operation.onStarted();
      try {
        const value = await operation.write(context);
        if (current()) operation.onResolved(value, context);
      } catch (error) {
        if (current()) operation.onRejected(error);
      } finally {
        if (requestGeneration === generation) {
          pending = false;
          if (current()) operation.onFinished();
        }
      }
    },
  };
}
