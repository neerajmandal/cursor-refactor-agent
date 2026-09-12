import Link from "next/link";
import { getArchiveStore } from "@/lib/archive/store";
import { PHASE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function ProjectsPage() {
  const archives = await getArchiveStore().list();

  return (
    <main className="px-8 py-10 md:px-12 md:py-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        Projects
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink">
        Saved refactors
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-6 text-muted">
        Every migration snapshot is stored locally or in the online database so you
        can reopen the architecture and evidence later.
      </p>

      {archives.length ? (
        <ul className="mt-10 divide-y divide-line border-t border-line">
          {archives.map((archive) => (
            <li key={archive.id}>
              <Link
                href={`/p/${archive.id}`}
                className="flex flex-col gap-2 py-5 no-underline hover:bg-paper-2/60 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">
                    {archive.envName || repoName(archive.legacyRepo)}
                  </p>
                  <p className="mt-1 truncate text-[13px] text-muted">
                    {repoName(archive.legacyRepo)} → {repoName(archive.targetRepo)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-[12px]">
                  <span className="text-muted">{PHASE_LABEL[archive.phase]}</span>
                  {archive.evaluationStatus === "passed" ? (
                    <span className="text-good">Parity proven</span>
                  ) : archive.evaluationStatus === "failed" ? (
                    <span className="text-bad">Behavior differs</span>
                  ) : null}
                  <span className="text-muted">{formatWhen(archive.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 max-w-md text-sm leading-6 text-muted">
          No saved refactors yet. Start from New refactor — completed and in-progress
          boards will show up here.
        </p>
      )}
    </main>
  );
}
