import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { parseStaffAccountActivationLink } from "./staffAccountActivationLink";

function currentActivationLink() {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  return parseStaffAccountActivationLink(window.location.href);
}

export function useStaffAccountActivationLink() {
  const [entry, setEntry] = useState(() => ({
    link: currentActivationLink(),
    revision: 0,
  }));
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const update = () => {
      setEntry((previous) => ({
        link: currentActivationLink(),
        revision: previous.revision + 1,
      }));
    };
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);

  const retireToken = useCallback(() => {
    if (Platform.OS !== "web" || !currentActivationLink()) return;
    // Keep the result visible, but remove all invitation material from the URL.
    window.history.replaceState(null, "", "/activate-account");
  }, []);
  const leaveActivation = useCallback(() => {
    if (Platform.OS === "web" && currentActivationLink())
      window.history.replaceState(null, "", "/");
    setEntry((previous) => ({
      link: undefined,
      revision: previous.revision + 1,
    }));
  }, []);
  return { ...entry, retireToken, leaveActivation };
}
