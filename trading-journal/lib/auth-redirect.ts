/** Canonical app origin for Supabase email redirects (magic link, signup, recovery). */
export function getAuthRedirectOrigin(fallbackOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return fallbackOrigin?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function authConfirmUrl(origin?: string) {
  return `${getAuthRedirectOrigin(origin)}/auth/confirm`;
}

export function authCallbackUrl(origin?: string) {
  return `${getAuthRedirectOrigin(origin)}/auth/callback`;
}
