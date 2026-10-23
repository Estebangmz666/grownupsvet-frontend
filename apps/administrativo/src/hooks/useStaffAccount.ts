import { useCallback, useEffect, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { getAdministrator, getVeterinarian } from "@api-client/staff.api";
import {
  staffOperationError,
  type StaffAccount,
  type StaffAccountKind,
  type StaffOperationError,
} from "../staffManagement";

export function useStaffAccount(kind: StaffAccountKind, id: string) {
  const [revision, setRevision] = useState(0);
  const [account, setAccount] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffOperationError | null>(null);
  useEffect(() => {
    const context = getApiRequestContext();
    const controller = new AbortController();
    let mounted = true;
    setLoading(true);
    setAccount(null);
    setError(null);
    const load = kind === "administrators" ? getAdministrator : getVeterinarian;
    void load(id, { signal: controller.signal }, context)
      .then((value) => {
        if (mounted && isApiRequestContextCurrent(context)) {
          setAccount(value);
          setLoading(false);
        }
      })
      .catch((failure: unknown) => {
        if (mounted && isApiRequestContextCurrent(context)) {
          setError(staffOperationError(failure));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [id, kind, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { account, setAccount, loading, error, refresh };
}
