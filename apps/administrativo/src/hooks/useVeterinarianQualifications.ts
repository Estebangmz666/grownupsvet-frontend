import { useCallback, useEffect, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import {
  getVeterinarianQualification,
  listVeterinarianQualifications,
} from "@api-client/veterinarianQualifications.api";
import type { VeterinarianQualificationResponseDTO } from "@api-client/staff.types";
import {
  veterinarianQualificationOperationError,
  type VeterinarianQualificationOperationError,
} from "../veterinarianQualificationsPresentation";

interface QualificationReadState {
  readKey: string;
  qualifications: VeterinarianQualificationResponseDTO[] | null;
  qualification: VeterinarianQualificationResponseDTO | null;
  loading: boolean;
  error: VeterinarianQualificationOperationError | null;
}

export function useVeterinarianQualifications(
  veterinarianId: string,
  qualificationId?: string,
) {
  const [revision, setRevision] = useState(0);
  const readKey = `${veterinarianId}:${qualificationId ?? "list"}:${revision}`;
  const empty = {
    readKey,
    qualifications: null,
    qualification: null,
    loading: true,
    error: null,
  };
  const [state, setState] = useState<QualificationReadState>(empty);
  useEffect(() => {
    const context = getApiRequestContext();
    const controller = new AbortController();
    const requestContext = { ...context, signal: controller.signal };
    let mounted = true;
    setState({
      readKey,
      qualifications: null,
      qualification: null,
      loading: true,
      error: null,
    });
    void Promise.all([
      listVeterinarianQualifications(veterinarianId, requestContext),
      qualificationId
        ? getVeterinarianQualification(
            veterinarianId,
            qualificationId,
            requestContext,
          )
        : Promise.resolve(null),
    ])
      .then(([qualifications, qualification]) => {
        if (mounted && isApiRequestContextCurrent(context))
          setState({
            readKey,
            qualifications,
            qualification,
            loading: false,
            error: null,
          });
      })
      .catch((error: unknown) => {
        if (mounted && isApiRequestContextCurrent(context))
          setState({
            readKey,
            qualifications: null,
            qualification: null,
            loading: false,
            error: veterinarianQualificationOperationError(error),
          });
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [qualificationId, readKey, veterinarianId]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { ...(state.readKey === readKey ? state : empty), refresh };
}
