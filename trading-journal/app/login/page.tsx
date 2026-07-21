"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signInAsAdmin } from "@/app/actions/auth";
import { getAuthRedirectUrl } from "@/lib/auth/site-url";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type LoginMode = "sign-in" | "sign-up" | "forgot-password";

function formatAuthError(error: string) {
  if (error === "missing_auth_params") {
    return "The sign-in link was incomplete. Request a new magic link or password reset email.";
  }

  if (error === "auth" || error === "Authentication failed.") {
    return "Authentication failed. Request a new link and make sure you open it on the same site URL configured for this app.";
  }

  return decodeURIComponent(error);
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setMessage(formatAuthError(error));
    }
  }, []);

  async function onPasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Supabase is not configured here. Use admin demo access.");
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
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        setMessage(
          "Invalid email or password. If you never set a password, use “Email me a link” or “Send password reset email” below.",
        );
        return;
      }
      setMessage(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function onMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Supabase is not configured here. Use admin demo access.");
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
      return;
    }
    setMessage("Magic link sent. Open your inbox and click the link on this same device/browser.");
  }

  async function onPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Supabase is not configured here. Use admin demo access.");
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
      return;
    }
    setMessage("Password reset email sent. Use the link to set a password, then sign in normally.");
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
              : "Email and password, magic link, or password reset."}
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
                    className="bg-zinc-950"
                  />
                </label>
                <Button type="submit" disabled={loading} className="font-bold">
                  {mode === "sign-in" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <button
                  type="button"
                  className="font-semibold text-cyan-300 hover:underline"
                  onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
                </button>
                <button
                  type="button"
                  className="font-semibold text-cyan-300 hover:underline"
                  onClick={() => setMode("forgot-password")}
                >
                  No password? Reset it
                </button>
              </div>

              <form onSubmit={onMagicLink} className="grid gap-2 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-zinc-500">
                  Magic link (no password needed)
                </p>
                <p className="text-xs text-zinc-500">
                  Use this if your account was created without a password.
                </p>
                <Button type="submit" disabled={loading} className="border border-white/20 bg-transparent font-bold">
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
                  className="bg-zinc-950"
                />
              </label>
              <Button type="submit" disabled={loading} className="font-bold">
                Send password reset email
              </Button>
              <button
                type="button"
                className="text-left text-xs font-semibold text-cyan-300 hover:underline"
                onClick={() => setMode("sign-in")}
              >
                Back to sign in
              </button>
            </form>
          )}

          <form action={signInAsAdmin} className="grid gap-2 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold text-zinc-500">Admin demo access</p>
            <p className="text-xs text-zinc-500">
              Offline preview only. With Supabase + database configured, sign in above to save
              trades.
            </p>
            <Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              Login as admin
            </Button>
          </form>

          {message ? <p className="text-sm text-amber-200">{message}</p> : null}

          <p className="text-xs text-zinc-500">
            Auth links must match your app URL. Current redirect base:{" "}
            <span className="font-mono text-zinc-300">{getAuthRedirectUrl("/auth/callback")}</span>
            . Add this URL in Supabase → Authentication → URL Configuration → Redirect URLs.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
