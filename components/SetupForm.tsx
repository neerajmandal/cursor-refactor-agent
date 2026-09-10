"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { setupStorageKey } from "@/lib/identity";

export function SetupForm() {
  const router = useRouter();
  const [envName, setEnvName] = useState("");
  const [legacyRepo, setLegacyRepo] = useState("");
  const [targetRepo, setTargetRepo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [repoError, setRepoError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/repos");
      const data = (await response.json()) as { repos?: string[]; error?: string };
      if (cancelled) return;
      setRepos(data.repos ?? []);
      setRepoError(data.error ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!legacyRepo.trim() || !targetRepo.trim() || !prompt.trim()) return;
    setBusy(true);
    const id = nanoid(10);
    sessionStorage.setItem(
      setupStorageKey(id),
      JSON.stringify({
        envName: envName.trim(),
        legacyRepo: legacyRepo.trim(),
        targetRepo: targetRepo.trim(),
        prompt: prompt.trim(),
      }),
    );
    router.push(`/b/${id}`);
  }

  return (
    <main className="min-h-full px-8 py-10 md:px-16 md:py-14">
      <p className="font-serif text-4xl tracking-tight text-ink">Cural</p>
      <p className="mt-3 max-w-md text-[15px] leading-6 text-muted">
        Map the legacy system, agree on the target, then start Cursor cloud
        agents from the board.
      </p>

      <form onSubmit={onSubmit} className="mt-14 max-w-xl space-y-8">
        <Field
          label="Cursor cloud environment"
          hint="Optional. Named snapshot from the Cloud Agents dashboard. Leave blank to clone the repos into a default cloud VM."
        >
          <input
            value={envName}
            onChange={(event) => setEnvName(event.target.value)}
            placeholder="e.g. acme-monolith"
            className="field-input"
          />
        </Field>

        <Field
          label="Legacy repo"
          hint={repoError ? `${repoError}. Paste a GitHub URL.` : "Connected Cursor repos, or paste a URL."}
        >
          <input
            value={legacyRepo}
            onChange={(event) => setLegacyRepo(event.target.value)}
            list="cural-repos"
            required
            placeholder="https://github.com/org/legacy"
            className="field-input"
          />
        </Field>

        <Field
          label="New empty repo"
          hint="Must already exist. Agents will write the migrated code here."
        >
          <input
            value={targetRepo}
            onChange={(event) => setTargetRepo(event.target.value)}
            list="cural-repos"
            required
            placeholder="https://github.com/org/new"
            className="field-input"
          />
        </Field>

        <datalist id="cural-repos">
          {repos.map((url) => (
            <option key={url} value={url} />
          ))}
        </datalist>

        <Field label="Migration prompt">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            required
            rows={6}
            placeholder="Split the monolith into a Next.js app and a Go API. Keep auth, drop the SOAP adapter."
            className="field-input min-h-36 resize-y"
          />
        </Field>

        <button
          type="submit"
          disabled={busy}
          className="bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Opening board" : "Open board"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium tracking-wide text-ink">{label}</span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-2 block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}
