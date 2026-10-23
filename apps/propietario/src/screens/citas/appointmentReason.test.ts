import { describe, expect, it } from "vitest";
import { appointmentReasonError } from "./appointmentReason";

describe("appointment reason contract", () => {
  it.each(["", "  ", "\n\t"])("rejects a blank reason %j", (reason) => {
    expect(appointmentReasonError(reason)).toContain("motivo");
  });
  it("matches the required 1000-character boundary after trimming the submitted value", () => {
    expect(appointmentReasonError("a".repeat(1000))).toBeNull();
    expect(appointmentReasonError(` ${"a".repeat(1000)} `)).toBeNull();
    expect(appointmentReasonError("a".repeat(1001))).toContain("1000");
    expect(appointmentReasonError("Control anual de Luna")).toBeNull();
  });
});
