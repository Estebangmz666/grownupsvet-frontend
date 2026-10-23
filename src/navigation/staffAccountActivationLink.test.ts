import { describe, expect, it } from "vitest";
import { parseStaffAccountActivationLink } from "./staffAccountActivationLink";

const token = "aB_-".repeat(10) + "aB_";

describe("public staff activation entry", () => {
  it.each(["https://clinic.test", "http://localhost:8788"])(
    "reads only the invitation parameter from %s without consuming it",
    (origin) => {
      expect(
        parseStaffAccountActivationLink(
          `${origin}/activate-account?token=${token}&redirect=https://untrusted.test`,
        ),
      ).toEqual({ kind: "valid", token });
      expect(
        parseStaffAccountActivationLink(
          `${origin}/activate-account/?token=${token}`,
        ),
      ).toEqual({ kind: "valid", token });
    },
  );
  it.each([
    "https://clinic.test/",
    `https://clinic.test/not-activate-account?token=${token}`,
    `https://clinic.test/activate-account/other?token=${token}`,
    `javascript:activate-account?token=${token}`,
    "not a URL",
  ])("keeps unrelated locations out of activation: %s", (address) => {
    expect(parseStaffAccountActivationLink(address)).toBeUndefined();
  });
  it.each([
    "",
    "?token=",
    "?token=short",
    `?token=${token}&token=${token}`,
    `?token=${"a".repeat(44)}`,
    `?token=${"a".repeat(42)}%2B`,
    `?token=${token}%20`,
    `#token=${token}`,
  ])("requires one complete base64url token: %s", (query) => {
    expect(
      parseStaffAccountActivationLink(
        `https://clinic.test/activate-account${query}`,
      ),
    ).toEqual({ kind: "invalid" });
  });
});
