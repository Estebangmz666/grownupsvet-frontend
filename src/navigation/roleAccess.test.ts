import { describe, expect, it } from "vitest";
import type { AuthenticatedUser, UserRole } from "@grownupsvet/api-client";
import { resolveApplicationArea } from "./roleAccess";

function user(role: UserRole, permissions: string[]): AuthenticatedUser {
  return { id: "test-user", email: "user@example.test", role, permissions };
}
describe("role-specific application entry", () => {
  it.each([
    ["OWNER", "PET_READ_SELF", "owner"],
    ["SUPER_ADMIN", "ADMINISTRATOR_MANAGE", "administrators"],
    ["ADMINISTRATOR", "VETERINARIAN_MANAGE", "veterinarians"],
    ["VETERINARIAN", "APPOINTMENT_READ_ASSIGNED", "assignedAppointments"],
  ] as const)(
    "routes %s only with its actual permission",
    (role, permission, area) => {
      expect(resolveApplicationArea(user(role, [permission]))).toBe(area);
      expect(resolveApplicationArea(user(role, []))).toBeNull();
      expect(
        resolveApplicationArea(user(role, ["UNKNOWN_FUTURE_PERMISSION"])),
      ).toBeNull();
    },
  );
  it("does not grant owner screens or inherit another role's area", () => {
    expect(
      resolveApplicationArea(
        user("SUPER_ADMIN", ["PET_READ_SELF", "VETERINARIAN_MANAGE"]),
      ),
    ).toBeNull();
    expect(
      resolveApplicationArea(user("VETERINARIAN", ["APPOINTMENT_READ_ALL"])),
    ).toBeNull();
  });
  it("fails closed for missing identity or an unknown future role", () => {
    expect(resolveApplicationArea(null)).toBeNull();
    expect(
      resolveApplicationArea({
        ...user("OWNER", ["PET_READ_SELF"]),
        role: "FUTURE_ROLE" as UserRole,
      }),
    ).toBeNull();
  });
});
