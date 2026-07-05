"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (!hasSupabaseBrowserConfig()) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 py-12 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="text-2xl font-black">Set your password</CardTitle>
          <p className="text-sm text-zinc-400">
            Choose a password so you can sign in with email and password next time.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <label className="grid gap-1 text-sm font-semibold text-zinc-300">
              New password
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="bg-zinc-950"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-300">
              Confirm password
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={6}
                className="bg-zinc-950"
              />
            </label>
            <Button type="submit" disabled={loading} className="font-bold">
              Save password
            </Button>
          </form>
          {message ? <p className="mt-4 text-sm text-amber-200">{message}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
