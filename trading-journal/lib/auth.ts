import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const ADMIN_SESSION_COOKIE = "traderoad_admin_session";
export const ADMIN_SESSION_VALUE = "admin";

export const adminDemoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@traderoad.local",
};

export function isAdminSessionCookie(value?: string) {
  return value === ADMIN_SESSION_VALUE;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  if (isAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return adminDemoUser;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}
