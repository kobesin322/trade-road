"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setMessage("Authentication failed.");
    }
  }, []);

  async function onPasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "sign-up") {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
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
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Magic link sent. Open your inbox to continue.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 py-12 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="text-2xl font-black">TradeRoad</CardTitle>
          <p className="text-sm text-zinc-400">
            Sign in to your trading journal. Email/password or magic link.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
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

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <button
              type="button"
              className="font-semibold text-cyan-300 hover:underline"
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            >
              {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>
          </div>

          <form onSubmit={onMagicLink} className="grid gap-2 border-t border-white/10 pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Or magic link (email only)</p>
            <Button type="submit" disabled={loading} className="border border-white/20 bg-transparent font-bold">
              Email me a link
            </Button>
          </form>

          {message ? <p className="text-sm text-amber-200">{message}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
