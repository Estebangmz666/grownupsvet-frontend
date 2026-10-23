import React, { useCallback, useMemo, useState } from "react";
import { StaffMutationActivityContext } from "./staffMutationActivityContext";

/** Navigation waits for the visible staff operation to settle before unmounting it. */
export function StaffMutationActivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [operations, setOperations] = useState<Set<string>>(() => new Set());
  const report = useCallback((id: string, pending: boolean) => {
    setOperations((current) => {
      if (current.has(id) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ pending: operations.size > 0, report }),
    [operations.size, report],
  );
  return (
    <StaffMutationActivityContext.Provider value={value}>
      {children}
    </StaffMutationActivityContext.Provider>
  );
}
