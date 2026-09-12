"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CuralLogo } from "@/components/CuralLogo";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Incorrect password");
      }
      const next = searchParams.get("next") || "/projects";
      router.replace(next.startsWith("/") ? next : "/projects");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <CuralLogo className="h-5 w-5" />
          <p className="text-[17px] font-semibold tracking-tight">Cural</p>
        </div>
        <h1 className="mt-6 font-serif text-3xl tracking-tight">Enter password</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          This workspace is private. Use the shared password to continue.
        </p>
        <label className="mt-6 block text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>
        {error ? <p className="mt-3 text-[13px] text-bad">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 w-full rounded-md bg-cta px-3.5 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
