import { useCallback, useEffect, useId, useRef } from "react";
import { Platform } from "react-native";

/** Keep a stable keyboard destination while paginated cards are replaced. */
export function useStaffPageFocus(loading: boolean) {
  const headingId = useId();
  const pending = useRef(false);
  const prepareFocus = useCallback(() => {
    pending.current = true;
  }, []);
  useEffect(() => {
    if (!pending.current || loading) return;
    pending.current = false;
    if (Platform.OS === "web" && typeof document !== "undefined")
      document.getElementById(headingId)?.focus();
  }, [headingId, loading]);
  return { headingId, prepareFocus };
}
