import type {
  Appointment,
  AuthenticatedUser,
  Page,
} from "@grownupsvet/api-client";
import type {
  AdministratorResponseDTO,
  VeterinarianResponseDTO,
} from "@api-client/staff.types";

export type StaffRole = Exclude<AuthenticatedUser["role"], "OWNER">;

/** Initial page already confirmed by the session loader; never persisted. */
export type InitialStaffData =
  | { role: "SUPER_ADMIN"; page: Page<AdministratorResponseDTO> }
  | { role: "ADMINISTRATOR"; page?: Page<VeterinarianResponseDTO> }
  | { role: "VETERINARIAN"; day: string; page: Page<Appointment> };

export interface StaffAreaProps {
  sessionKey: string;
  user: AuthenticatedUser;
  initialData?: InitialStaffData;
  onLogout: () => void | Promise<void>;
}
