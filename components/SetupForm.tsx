"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

export function SetupForm() {
  const router = useRouter();
  const [envName, setEnvName] = useState("");
  const [legacyRepo, setLegacyRepo] = useState("");
  const [targetRepo, setTargetRepo] = useState("");
  const [legacyRef, setLegacyRef] = useState("");
  const [targetRef, setTargetRef] = useState("");
  const [prompt, setPrompt] = useState("");
  const [legacyBaseUrl, setLegacyBaseUrl] = useState("");
  const [targetBaseUrl, setTargetBaseUrl] = useState("");
  const [fixtureCommand, setFixtureCommand] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [repoError, setRepoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!legacyRepo.trim() || !targetRepo.trim() || !prompt.trim()) return;
    setBusy(true);
    setSubmitError("");
    const id = nanoid(10);
    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: id,
          setup: {
            envName: envName.trim(),
            legacyRepo: legacyRepo.trim(),
            targetRepo: targetRepo.trim(),
            legacyRef: legacyRef.trim(),
            targetRef: targetRef.trim(),
            prompt: prompt.trim(),
            legacyBaseUrl: legacyBaseUrl.trim(),
            targetBaseUrl: targetBaseUrl.trim(),
            fixtureCommand: fixtureCommand.trim(),
          },
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to create board");
      router.push(`/b/${id}`);
    } catch (error) {
      setBusy(false);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create board",
      );
    }
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
          hint="Optional. A named environment must already contain the required repos. Leave blank to clone the repo URLs and apply the revisions below."
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

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Legacy revision" hint="Optional branch, tag, or commit SHA. Used only without a named environment.">
            <input
              value={legacyRef}
              onChange={(event) => setLegacyRef(event.target.value)}
              placeholder="main"
              className="field-input font-mono text-[13px]"
            />
          </Field>
          <Field label="Target revision" hint="Optional branch, tag, or commit SHA. Used only without a named environment.">
            <input
              value={targetRef}
              onChange={(event) => setTargetRef(event.target.value)}
              placeholder="main"
              className="field-input font-mono text-[13px]"
            />
          </Field>
        </div>

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

        <div className="border-t border-line pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Parity environment
          </p>
          <p className="mt-2 max-w-lg text-xs leading-5 text-muted">
            Optional now. These make the post-migration evaluation reproducible.
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Legacy base URL">
              <input
                value={legacyBaseUrl}
                onChange={(event) => setLegacyBaseUrl(event.target.value)}
                placeholder="http://localhost:4000"
                className="field-input"
              />
            </Field>
            <Field label="Target base URL">
              <input
                value={targetBaseUrl}
                onChange={(event) => setTargetBaseUrl(event.target.value)}
                placeholder="http://localhost:5000"
                className="field-input"
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field
              label="Fixture/reset command"
              hint="Runs before parity checks to establish deterministic state."
            >
              <input
                value={fixtureCommand}
                onChange={(event) => setFixtureCommand(event.target.value)}
                placeholder="npm run test:seed"
                className="field-input font-mono text-[13px]"
              />
            </Field>
          </div>
        </div>

        {submitError ? (
          <p role="alert" className="text-sm text-bad">{submitError}</p>
        ) : null}
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
