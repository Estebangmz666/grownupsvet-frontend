import { useCallback, useEffect, useState } from "react";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { getVeterinarianAvailabilitySlot } from "@api-client/veterinarianAvailability.api";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import {
  availabilityOperationError,
  type AvailabilityOperationError,
} from "../availabilityManagement";

export function useAvailabilitySlot(veterinarianId: string, slotId: string) {
  const [revision, setRevision] = useState(0);
  const [slot, setSlot] =
    useState<VeterinarianAvailabilitySlotResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AvailabilityOperationError | null>(null);
  useEffect(() => {
    const context = getApiRequestContext();
    const controller = new AbortController();
    let mounted = true;
    void getVeterinarianAvailabilitySlot(veterinarianId, slotId, {
      ...context,
      signal: controller.signal,
    })
      .then((value) => {
        if (mounted && isApiRequestContextCurrent(context)) {
          setSlot(value);
          setLoading(false);
        }
      })
      .catch((failure: unknown) => {
        if (mounted && isApiRequestContextCurrent(context)) {
          setError(availabilityOperationError(failure));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [veterinarianId, slotId, revision]);
  const refresh = useCallback(() => {
    setSlot(null);
    setError(null);
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);
  return { slot, setSlot, loading, error, refresh };
}
