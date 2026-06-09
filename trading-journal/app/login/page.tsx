"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signInAsAdmin } from "@/app/actions/auth";
import { authConfirmUrl } from "@/lib/auth-redirect";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type AuthView = "sign-in" | "sign-up" | "forgot-password" | "otp-code";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [view, setView] = useState<AuthView>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorMessage = params.get("message");
    if (error === "auth" && errorMessage) {
      setMessage(decodeURIComponent(errorMessage));
      return;
    }
    if (error) {
      setMessage(
        error === "missing_code" || error === "missing_token"
          ? "Sign-in link was invalid or expired. Request a new magic link below."
          : "Authentication failed. Try a magic link or reset your password.",
      );
    }
  }, []);

  function redirectTarget() {
    return authConfirmUrl(window.location.origin);
  }

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

    if (view === "sign-up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTarget(),
        },
      });
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage(
        "Account created. Check your email to confirm, then sign in with your password or a magic link.",
      );
      setView("sign-in");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        setMessage(
          "Invalid email or password. If you signed up with a magic link only, use “Email me a link” below or set a password via “Forgot password?”.",
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
    if (!email) {
      setLoading(false);
      setMessage("Enter your email address first.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTarget(),
        shouldCreateUser: view === "sign-up",
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      "Magic link sent. Open the link in your inbox on this device. If the link fails, enter the 6-digit code from the email below.",
    );
    setView("otp-code");
  }

  async function onForgotPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Supabase is not configured here.");
      return;
    }
    if (!email) {
      setLoading(false);
      setMessage("Enter your email address first.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTarget(),
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      "Password reset email sent. Open the link to set a password, or use the magic link in that email to sign in.",
    );
    setView("sign-in");
  }

  async function onVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!hasSupabaseBrowserConfig()) {
      setLoading(false);
      setMessage("Supabase is not configured here.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const showPasswordFields = view === "sign-in" || view === "sign-up";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 py-12 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="text-2xl font-black">TradeRoad</CardTitle>
          <p className="text-sm text-zinc-400">
            {view === "forgot-password"
              ? "We will email you a link to set or reset your password."
              : view === "otp-code"
                ? "Enter the 6-digit code from your email."
                : "Sign in with a magic link (recommended) or email and password. Google sign-in is not enabled."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          {view === "otp-code" ? (
            <form className="grid gap-3" onSubmit={onVerifyOtp}>
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
                6-digit code
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  required
                  minLength={6}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="bg-zinc-950 tracking-[0.3em]"
                />
              </label>
              <Button type="submit" disabled={loading} className="font-bold">
                Verify code
              </Button>
              <button
                type="button"
                className="text-left text-xs font-semibold text-cyan-300 hover:underline"
                onClick={() => setView("sign-in")}
              >
                Back to sign in
              </button>
            </form>
          ) : view === "forgot-password" ? (
            <form className="grid gap-3" onSubmit={onForgotPassword}>
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
                Send reset link
              </Button>
              <button
                type="button"
                className="text-left text-xs font-semibold text-cyan-300 hover:underline"
                onClick={() => setView("sign-in")}
              >
                Back to sign in
              </button>
            </form>
          ) : (
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
                {showPasswordFields ? (
                  <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                    Password
                    <Input
                      type="password"
                      autoComplete={view === "sign-up" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required={view === "sign-up"}
                      minLength={6}
                      className="bg-zinc-950"
                    />
                  </label>
                ) : null}
                {view === "sign-in" ? (
                  <Button type="submit" disabled={loading || !password} className="font-bold">
                    Sign in with password
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} className="font-bold">
                    Create account with password
                  </Button>
                )}
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <button
                  type="button"
                  className="font-semibold text-cyan-300 hover:underline"
                  onClick={() => setView(view === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {view === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
                </button>
                {view === "sign-in" ? (
                  <button
                    type="button"
                    className="font-semibold text-cyan-300 hover:underline"
                    onClick={() => setView("forgot-password")}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>

              <form onSubmit={onMagicLink} className="grid gap-2 border-t border-white/10 pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Passwordless sign-in
                </p>
                <p className="text-xs text-zinc-500">
                  Use this if you signed up with Gmail but never set a password.
                </p>
                <Button
                  type="submit"
                  disabled={loading}
                  className="border border-white/20 bg-transparent font-bold"
                >
                  Email me a magic link
                </Button>
              </form>
            </>
          )}

          <form action={signInAsAdmin} className="grid gap-2 border-t border-white/10 pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Admin demo access
            </p>
            <Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              Login as admin
            </Button>
          </form>

          {message ? <p className="text-sm text-amber-200">{message}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
