export function getAuthRedirectUrl(path = "/auth/callback") {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }

  return path;
}
