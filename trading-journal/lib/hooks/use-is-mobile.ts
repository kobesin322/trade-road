"use client";

import { useEffect, useState } from "react";

import { MOBILE_MEDIA_QUERY } from "@/lib/mobile";

/**
 * Auto-detects mobile layout (default design target: iPhone 14 @ 390px).
 * Returns `false` during SSR / first paint to avoid hydration mismatch;
 * CSS `max-lg:` classes still apply immediately.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);

    const sync = () => setIsMobile(media.matches);
    sync();

    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
