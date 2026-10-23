import { useEffect, useId, useRef, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { createStaffMutationRunner } from "./staffMutation";
import { useStaffMutationActivity } from "./staffMutationActivityContext";

export function useStaffMutation() {
  const activity = useStaffMutationActivity();
  const reportActivity = activity?.report;
  const operationId = useId();
  const runner = useRef(
    createStaffMutationRunner({
      captureContext: getApiRequestContext,
      isContextCurrent: isApiRequestContextCurrent,
    }),
  );
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const current = runner.current;
    return () => {
      current.cancel();
      reportActivity?.(operationId, false);
    };
  }, [operationId, reportActivity]);
  return {
    pending,
    run: <T>(operation: Parameters<typeof runner.current.run<T>>[0]) =>
      runner.current.run({
        ...operation,
        onStarted: () => {
          setPending(true);
          reportActivity?.(operationId, true);
          operation.onStarted();
        },
        onFinished: () => {
          setPending(false);
          reportActivity?.(operationId, false);
          operation.onFinished();
        },
      }),
  };
}
