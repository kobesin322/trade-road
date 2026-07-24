"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/modal";
import { getAuthRedirectUrl } from "@/lib/auth/site-url";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type LoginMode = "sign-in" | "sign-up" | "forgot-password";

function formatAuthError(error: string) {
  if (error === "missing_auth_params") {
    return "The sign-in link was incomplete. Request a new magic link or password reset email.";
  }

  if (error === "auth" || error === "Authentication failed.") {
    return "Authentication failed. Request a new link and try again.";
  }

  return decodeURIComponent(error);
}

function resolvePostLoginPath() {
  if (typeof window === "undefined") {
    return "/app";
  }
  const next = new URLSearchParams(window.location.search).get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/app";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null,
  );
  const [redirecting, setRedirecting] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/app");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setMessage(formatAuthError(error));
    }
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function beginSuccessfulRedirect(path = resolvePostLoginPath()) {
    setRedirectPath(path);
    setRedirecting(true);
    setToast({ message: "Login successful. Opening Trade Road…", tone: "success" });

    // Hard navigation after a short success beat so auth cookies settle and
    // the heavy /app RSC load is clearly intentional (avoids "stuck" soft nav).
    window.setTimeout(() => {
      window.location.assign(path);
    }, 900);
  }

  async function onPasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Sign-in is unavailable right now. Check Supabase configuration and try again.");
      setToast({ message: "Sign-in is unavailable.", tone: "error" });
      return;
    }

    const supabase = createClient();

    if (mode === "sign-up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/auth/callback"),
        },
      });
      setLoading(false);
      if (error) {
        setMessage(error.message);
        setToast({ message: error.message, tone: "error" });
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      setToast({ message: "Account created — confirm your email to continue.", tone: "info" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        const text =
          "Invalid email or password. If you never set a password, use “Email me a link” or “Send password reset email” below.";
        setMessage(text);
        setToast({ message: "Invalid email or password.", tone: "error" });
        return;
      }
      setMessage(error.message);
      setToast({ message: error.message, tone: "error" });
      return;
    }

    beginSuccessfulRedirect();
  }

  async function onMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Sign-in is unavailable right now. Check Supabase configuration and try again.");
      return;
    }
    if (!email.trim()) {
      setLoading(false);
      setMessage("Enter your email first.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthRedirectUrl("/auth/callback"),
        shouldCreateUser: false,
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      setToast({ message: error.message, tone: "error" });
      return;
    }
    setMessage("Magic link sent. Open your inbox and click the link on this same device/browser.");
    setToast({ message: "Magic link sent — check your email.", tone: "success" });
  }

  async function onPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Sign-in is unavailable right now. Check Supabase configuration and try again.");
      return;
    }
    if (!email.trim()) {
      setLoading(false);
      setMessage("Enter your email first.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl("/auth/callback?next=/auth/update-password"),
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      setToast({ message: error.message, tone: "error" });
      return;
    }
    setMessage("Password reset email sent. Use the link to set a password, then sign in normally.");
    setToast({ message: "Password reset email sent.", tone: "success" });
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-12 text-white">
      <div className="app-shell-bg pointer-events-none fixed inset-0" />
      <div className="app-grain" aria-hidden />

      <Card className="relative w-full max-w-md border-white/10">
        <CardHeader>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-200/75 uppercase">
            Trade Road
          </p>
          <CardTitle className="mt-2 text-2xl font-bold tracking-tight">Sign in</CardTitle>
          <p className="mt-1.5 max-w-[40ch] text-sm leading-relaxed text-zinc-400">
            {mode === "forgot-password"
              ? "Set or reset your password with a one-time email link."
              : "Email and password, or a magic link if you prefer."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          {mode !== "forgot-password" ? (
            <>
              <form className="grid gap-3" onSubmit={onPasswordSubmit}>
                <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                  Email
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={loading || redirecting}
                    className="bg-zinc-950"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                  Password
                  <Input
                    type="password"
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    disabled={loading || redirecting}
                    className="bg-zinc-950"
                  />
                </label>
                <Button type="submit" disabled={loading || redirecting} className="font-bold">
                  {loading && !redirecting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === "sign-in" ? "Signing in…" : "Creating account…"}
                    </span>
                  ) : mode === "sign-in" ? (
                    "Sign in"
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <button
                  type="button"
                  className="font-semibold text-cyan-300 hover:underline disabled:opacity-50"
                  disabled={loading || redirecting}
                  onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
                </button>
                <button
                  type="button"
                  className="font-semibold text-cyan-300 hover:underline disabled:opacity-50"
                  disabled={loading || redirecting}
                  onClick={() => setMode("forgot-password")}
                >
                  Forgot password?
                </button>
              </div>

              <form onSubmit={onMagicLink} className="grid gap-2 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-zinc-500">Magic link (no password needed)</p>
                <p className="text-xs text-zinc-500">
                  Use this if your account was created without a password.
                </p>
                <Button
                  type="submit"
                  disabled={loading || redirecting}
                  className="border border-white/20 bg-transparent font-bold"
                >
                  Email me a link
                </Button>
              </form>
            </>
          ) : (
            <form className="grid gap-3" onSubmit={onPasswordReset}>
              <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                Email
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={loading || redirecting}
                  className="bg-zinc-950"
                />
              </label>
              <Button type="submit" disabled={loading || redirecting} className="font-bold">
                Send password reset email
              </Button>
              <button
                type="button"
                className="text-left text-xs font-semibold text-cyan-300 hover:underline disabled:opacity-50"
                disabled={loading || redirecting}
                onClick={() => setMode("sign-in")}
              >
                Back to sign in
              </button>
            </form>
          )}

          {message ? <p className="text-sm text-amber-200">{message}</p> : null}
        </CardContent>
      </Card>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />

      {redirecting ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="login-success-modal w-full max-w-sm rounded-3xl border border-emerald-300/25 bg-[#0b1220] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/15 text-emerald-200">
              <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">You&apos;re in</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Login successful. Taking you to the dashboard…
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-cyan-100">
              <Route className="h-4 w-4 animate-pulse" />
              <span>Opening {redirectPath}</span>
              <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
            </div>
            <button
              type="button"
              className="mt-5 text-xs font-semibold text-cyan-300 hover:underline"
              onClick={() => window.location.assign(redirectPath)}
            >
              Continue now
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
