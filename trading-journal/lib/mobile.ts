/**
 * Mobile layout reference: iPhone 14 logical viewport (CSS pixels).
 * Detection uses max-width below the desktop sidebar breakpoint (`lg` / 1024).
 */
export const IPHONE_14 = {
  width: 390,
  height: 844,
  safeAreaTop: 47,
  safeAreaBottom: 34,
} as const;

/** Matches Tailwind `lg` — sidebar shows at this width and above. */
export const MOBILE_BREAKPOINT_PX = 1024;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

/** Primary tabs in the mobile bottom nav (≤5 including More). */
export const MOBILE_PRIMARY_VIEWS = [
  "Dashboard",
  "Journal",
  "Portfolio",
  "Charts",
] as const;

export type MobilePrimaryView = (typeof MOBILE_PRIMARY_VIEWS)[number];
