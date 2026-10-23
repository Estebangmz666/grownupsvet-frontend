import { useEffect, useRef, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { createStaffMutationRunner } from "./staffMutation";

export function useStaffMutation() {
  const runner = useRef(
    createStaffMutationRunner({
      captureContext: getApiRequestContext,
      isContextCurrent: isApiRequestContextCurrent,
    }),
  );
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const current = runner.current;
    return () => current.cancel();
  }, []);
  return {
    pending,
    run: <T>(operation: Parameters<typeof runner.current.run<T>>[0]) =>
      runner.current.run({
        ...operation,
        onStarted: () => {
          setPending(true);
          operation.onStarted();
        },
        onFinished: () => {
          setPending(false);
          operation.onFinished();
        },
      }),
  };
}
