import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, isAdminSessionCookie } from "@/lib/auth";
import { fetchWithTimeout } from "@/lib/supabase/fetch-with-timeout";

function hasSupabaseAuthCookies(request: NextRequest) {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
}

function isTransientAuthError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { name?: string; status?: number; message?: string };
  if (candidate.name === "AbortError") {
    return true;
  }
  if (candidate.status === 0) {
    return true;
  }
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    message.includes("aborted") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout")
  );
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
      response.cookies.delete(cookie.name);
    }
  }
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

function unauthenticatedResponse(request: NextRequest, isAuthPath: boolean) {
  if (isAuthPath) {
    return NextResponse.next();
  }

  const response = redirectToLogin(request);
  clearSupabaseAuthCookies(request, response);
  return response;
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuthPath = path.startsWith("/login") || path.startsWith("/auth");
  const hasAdminSession = isAdminSessionCookie(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (hasAdminSession) {
    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return unauthenticatedResponse(request, isAuthPath);
  }

  if (!hasSupabaseAuthCookies(request)) {
    return unauthenticatedResponse(request, isAuthPath);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithTimeout,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  let user: { id: string } | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isTransientAuthError(error)) {
        return supabaseResponse;
      }
      return unauthenticatedResponse(request, isAuthPath);
    }
    user = data.user;
  } catch (error) {
    if (isTransientAuthError(error)) {
      return supabaseResponse;
    }
    return unauthenticatedResponse(request, isAuthPath);
  }

  if (!user) {
    return unauthenticatedResponse(request, isAuthPath);
  }

  if (path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
