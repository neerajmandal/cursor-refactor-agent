"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PHASE_LABEL } from "@/lib/types";
import type { ArchiveSummary } from "@/lib/archive/types";

function repoName(value: string): string {
  return value.split("/").filter(Boolean).slice(-1)[0] || value || "Untitled";
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ProjectList({ archives }: { archives: ArchiveSummary[] }) {
  return (
    <ul className="mt-10 divide-y divide-line border-t border-line">
      {archives.map((archive) => (
        <ProjectRow key={archive.id} archive={archive} />
      ))}
    </ul>
  );
}

function ProjectRow({ archive }: { archive: ArchiveSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = archive.envName || repoName(archive.legacyRepo);

  async function remove() {
    if (
      !window.confirm(
        `Delete “${title}”? This removes the saved refactor and its evidence.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/archives/${encodeURIComponent(archive.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete project");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete project");
      setBusy(false);
    }
  }

  return (
    <li>
      <div className="flex items-start gap-3 py-5 md:items-center">
        <Link
          href={`/p/${archive.id}`}
          className="flex min-w-0 flex-1 flex-col gap-2 no-underline hover:bg-paper-2/60 md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-ink">{title}</p>
            <p className="mt-1 truncate text-[13px] text-muted">
              {repoName(archive.legacyRepo)} → {repoName(archive.targetRepo)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 text-[12px]">
            <span className="text-muted">{PHASE_LABEL[archive.phase]}</span>
            {archive.verificationStatus === "passed" ? (
              <span className="text-good">Verification passed</span>
            ) : archive.verificationStatus === "failed" ? (
              <span className="text-bad">Verification failed</span>
            ) : null}
            <span className="text-muted">{formatWhen(archive.updatedAt)}</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="mt-0.5 shrink-0 rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-paper-2 hover:text-bad disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="pb-4 text-[12px] text-bad">
          {error}
        </p>
      ) : null}
    </li>
  );
}
