"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

const STEPS = [
  "Connect systems",
  "Review architecture",
  "Execute until the goal holds",
] as const;

export function SetupForm() {
  const router = useRouter();
  const [envName, setEnvName] = useState("inds-support-agent");
  const [legacyRepo, setLegacyRepo] = useState(
    "https://github.com/neerajmandal/legacy-industrial-support",
  );
  const [targetRepo, setTargetRepo] = useState(
    "https://github.com/neerajmandal/modern-industrial-support-agent",
  );
  const [legacyRef, setLegacyRef] = useState("");
  const [targetRef, setTargetRef] = useState("");
  const [prompt, setPrompt] = useState(
    "Migrate the legacy industrial support app into the modern industrial support agent. Move away from the service bus. Operator questions must go through OpenAI, and answers must persist in Neon, while keeping end-user outcomes equivalent.",
  );
  const [legacyBaseUrl, setLegacyBaseUrl] = useState("");
  const [targetBaseUrl, setTargetBaseUrl] = useState("");
  const [fixtureCommand, setFixtureCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
    <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-6 py-6 md:px-8 md:py-8">
      <header className="flex shrink-0 items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-serif text-[32px] leading-none tracking-tight text-ink">
            Set up your migration
          </h1>
        </div>
      </header>

      <ol className="mt-4 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        {STEPS.map((label, index) => {
          const active = index === 0;
          return (
            <li key={label} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="hidden h-px w-5 bg-line sm:block" aria-hidden />
              ) : null}
              <span className="flex items-center gap-1.5">
                <span
                  className={
                    active
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink"
                      : "flex h-5 w-5 items-center justify-center rounded-full border border-line bg-node text-[10px] font-medium text-muted"
                  }
                  aria-current={active ? "step" : undefined}
                >
                  {index + 1}
                </span>
                <span
                  className={
                    active
                      ? "text-[12px] font-medium text-ink"
                      : "text-[12px] text-muted"
                  }
                >
                  {label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <form onSubmit={onSubmit} className="mt-5 flex min-w-0 flex-col gap-3">
        <section className="setup-card setup-card-compact flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-[140px] shrink-0">
            <h2 className="text-[13px] font-semibold text-ink">
              Cursor cloud environment
            </h2>
            <p className="mt-0.5 text-[11px] leading-4 text-muted">
              Optional named env, or leave blank to clone URLs.
            </p>
          </div>
          <input
            value={envName}
            onChange={(event) => setEnvName(event.target.value)}
            placeholder="e.g. acme-modernization"
            className="card-input min-w-0 flex-1"
            aria-label="Environment name"
          />
          <a
            href="https://cursor.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Manage in Cursor
          </a>
        </section>

        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <SystemCard
            tone="legacy"
            title="Legacy system"
            icon={<GitHubIcon />}
            repo={legacyRepo}
            onRepoChange={setLegacyRepo}
            branch={legacyRef}
            onBranchChange={setLegacyRef}
            ready={Boolean(legacyRepo.trim())}
          />
          <div className="hidden items-center self-center justify-center lg:flex" aria-hidden>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-node text-sm text-muted">
              →
            </span>
          </div>
          <SystemCard
            tone="target"
            title="Target system"
            icon={<SparkleIcon />}
            repo={targetRepo}
            onRepoChange={setTargetRepo}
            branch={targetRef}
            onBranchChange={setTargetRef}
            ready={Boolean(targetRepo.trim())}
          />
        </div>

        <section className="setup-card setup-card-compact flex flex-col gap-2">
          <div className="flex shrink-0 items-baseline justify-between gap-3">
            <label htmlFor="migration-prompt" className="text-[13px] font-semibold text-ink">
              Migration prompt
            </label>
            <details className="relative">
              <summary className="cursor-pointer list-none text-[12px] font-medium text-muted outline-none hover:text-ink">
                Parity options
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-[min(100vw-3rem,22rem)] rounded-xl border border-line bg-node p-3 shadow-sm">
                <p className="text-[11px] leading-4 text-muted">
                  Optional. Used during execute so the agent can start both apps and prove the goal.
                </p>
                <div className="mt-2 space-y-2">
                  <input
                    value={legacyBaseUrl}
                    onChange={(event) => setLegacyBaseUrl(event.target.value)}
                    placeholder="Legacy base URL"
                    aria-label="Legacy base URL"
                    className="card-input"
                  />
                  <input
                    value={targetBaseUrl}
                    onChange={(event) => setTargetBaseUrl(event.target.value)}
                    placeholder="Target base URL"
                    aria-label="Target base URL"
                    className="card-input"
                  />
                  <input
                    value={fixtureCommand}
                    onChange={(event) => setFixtureCommand(event.target.value)}
                    placeholder="Fixture/reset command"
                    aria-label="Fixture/reset command"
                    className="card-input font-mono text-[12px]"
                  />
                </div>
              </div>
            </details>
          </div>
          <textarea
            id="migration-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            required
            rows={2}
            placeholder="Split the monolith into a Next.js app and a Go API. Keep auth, drop the SOAP adapter."
            className="max-h-40 min-h-[6.5rem] w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-[13px] leading-5 outline-none focus:border-ink"
          />
        </section>

        {submitError ? (
          <p role="alert" className="shrink-0 text-sm text-bad">
            {submitError}
          </p>
        ) : null}

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line pt-3">
          <p className="hidden text-[12px] leading-4 text-muted sm:block">
            Next: analyze → review on the board → execute until the goal holds.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="ml-auto rounded-xl bg-cta px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Opening board…" : "Analyze architecture →"}
          </button>
        </footer>
      </form>
    </main>
  );
}

function SystemCard({
  tone,
  title,
  icon,
  repo,
  onRepoChange,
  branch,
  onBranchChange,
  ready,
}: {
  tone: "legacy" | "target";
  title: string;
  icon: React.ReactNode;
  repo: string;
  onRepoChange: (value: string) => void;
  branch: string;
  onBranchChange: (value: string) => void;
  ready: boolean;
}) {
  return (
    <section
      className={
        tone === "target"
          ? "setup-card setup-card-compact min-w-0 overflow-hidden bg-accent-soft/50"
          : "setup-card setup-card-compact min-w-0 overflow-hidden"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">{icon}</span>
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        </div>
        {ready ? null : (
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-line" aria-hidden />
            Waiting
          </span>
        )}
      </div>

      <div className="mt-2.5 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
        <label className="block min-w-0">
          <span className="sr-only">Repository URL</span>
          <input
            type="url"
            value={repo}
            onChange={(event) => onRepoChange(event.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/org/repo"
            className="card-input min-w-0"
          />
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Default branch</span>
          <input
            value={branch}
            onChange={(event) => onBranchChange(event.target.value)}
            placeholder="main"
            title="Optional branch, tag, or commit SHA"
            className="card-input min-w-0 font-mono text-[12px]"
          />
        </label>
      </div>
    </section>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.4 5.2L18.5 9.5 13.4 11 12 16.5 10.6 11 5.5 9.5l5.1-1.3L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
