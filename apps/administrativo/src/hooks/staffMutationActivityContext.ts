import { createContext, useContext } from "react";

export const StaffMutationActivityContext = createContext<{
  pending: boolean;
  report: (id: string, pending: boolean) => void;
} | null>(null);

export function useStaffMutationActivity() {
  return useContext(StaffMutationActivityContext);
}
