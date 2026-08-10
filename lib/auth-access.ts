export type AccessMembership = { role?: string };

export function isSuperadmin(memberships: AccessMembership[]) {
  return memberships.some(({ role }) => role === "superadmin");
}

export function defaultDestination(memberships: AccessMembership[]) {
  if (isSuperadmin(memberships)) return "/superadmin";
  if (memberships.length > 0) return "/admin";
  return "/passenger";
}

export function safeReturnTo(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  try {
    const base = "https://vango.local";
    const parsed = new URL(raw, base);
    if (parsed.origin !== base) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function destinationFor(memberships: AccessMembership[], requested?: string | null) {
  const returnTo = safeReturnTo(requested);
  if (!returnTo) return defaultDestination(memberships);

  if (returnTo === "/passenger" || returnTo.startsWith("/passenger/")) return returnTo;
  if ((returnTo === "/admin" || returnTo.startsWith("/admin/")) && memberships.length > 0) return returnTo;
  if ((returnTo === "/superadmin" || returnTo.startsWith("/superadmin/")) && isSuperadmin(memberships)) return returnTo;
  return defaultDestination(memberships);
}
