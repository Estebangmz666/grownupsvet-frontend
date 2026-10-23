export type StaffAccountActivationLink =
  { kind: "valid"; token: string } | { kind: "invalid" };

/** Only the public web entry reads this token; opening it never consumes it. */
export function parseStaffAccountActivationLink(
  address: string,
): StaffAccountActivationLink | undefined {
  let location: URL;
  try {
    location = new URL(address);
  } catch {
    return undefined;
  }
  if (
    !["http:", "https:"].includes(location.protocol) ||
    !/^\/activate-account\/?$/.test(location.pathname)
  )
    return undefined;
  const tokens = location.searchParams.getAll("token");
  if (tokens.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(tokens[0]))
    return { kind: "invalid" };
  return { kind: "valid", token: tokens[0] };
}
