import { describe, expect, it } from "vitest";
import { getStatusLabel } from "./citaLabels";

describe("owner appointment status labels", () => {
  it("identifies a completed appointment and keeps the neutral unknown-state fallback", () => {
    expect(getStatusLabel("COMPLETED")).toBe("Completada");
    expect(getStatusLabel("UNKNOWN")).toBe("Estado no disponible");
  });
});
