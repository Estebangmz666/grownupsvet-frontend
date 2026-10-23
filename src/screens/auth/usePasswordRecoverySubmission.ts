import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { createPasswordRecoverySubmissionGuard } from "./passwordRecoveryForm";

/** A hidden screen cannot navigate or apply an earlier request to a later visit. */
export function usePasswordRecoverySubmission() {
  const guard = useRef(createPasswordRecoverySubmissionGuard());
  const [submitting, setSubmitting] = useState(false);
  const [interrupted, setInterrupted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (guard.current.focus()) setInterrupted(true);
      setSubmitting(false);
      return () => {
        guard.current.blur();
      };
    }, []),
  );

  const begin = () => {
    const attempt = guard.current.begin();
    if (attempt === undefined) return undefined;
    setSubmitting(true);
    return attempt;
  };
  const finish = (attempt: number) => {
    if (guard.current.finish(attempt)) setSubmitting(false);
  };

  return {
    submitting,
    interrupted,
    begin,
    isCurrent: (attempt: number) => guard.current.isCurrent(attempt),
    finish,
    isBusy: () => guard.current.isBusy(),
  };
}
