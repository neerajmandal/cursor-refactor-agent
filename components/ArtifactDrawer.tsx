"use client";

import type {
  ImplementationReport,
  RunBranch,
  WorkflowDocument,
} from "@/lib/types";

export function ArtifactDrawer({
  open,
  onClose,
  documents,
  implementation,
  branches,
  urlFor,
}: {
  open: boolean;
  onClose: () => void;
  documents: Record<string, WorkflowDocument>;
  implementation: ImplementationReport | null;
  branches: RunBranch[];
  urlFor: (path: string) => string | null;
}) {
  if (!open) return null;
  const evidence = [
    ...new Set(
      implementation?.observations.flatMap((item) => item.evidence) ?? [],
    ),
  ];
  return (
    <div className="absolute inset-0 z-50 flex justify-end bg-black/15" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Saved artifacts"
        className="h-full w-full max-w-sm overflow-y-auto border-l border-line bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">Saved artifacts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifacts"
            className="rounded-md px-2 py-1 text-muted hover:bg-paper-2 hover:text-ink"
          >
            ×
          </button>
        </div>

        <ArtifactSection
          title="Documents"
          items={Object.values(documents).map((document) => ({
            label: document.filename,
            detail: document.artifactPath,
            href: urlFor(document.artifactPath),
          }))}
        />
        <ArtifactSection
          title="Verification"
          items={[
            ...(implementation?.recording
              ? [{
                  label: implementation.recording.label,
                  detail: implementation.recording.path,
                  href: urlFor(implementation.recording.path),
                }]
              : []),
            ...evidence
              .filter((path) => path !== implementation?.recording?.path)
              .map((path) => ({
                label: path.split("/").pop() || path,
                detail: path,
                href: urlFor(path),
              })),
          ]}
        />
        <ArtifactSection
          title="Branches"
          items={branches.map((branch) => ({
            label: branch.branch || "Target repository",
            detail: branch.repoUrl,
            href: branch.prUrl ?? null,
          }))}
        />
      </aside>
    </div>
  );
}

function ArtifactSection({
  title,
  items,
}: {
  title: string;
  items: { label: string; detail: string; href: string | null }[];
}) {
  return (
    <section className="mt-7">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
        {title}
      </h3>
      <div className="mt-2 divide-y divide-line border-t border-line">
        {items.map((item) =>
          item.href ? (
            <a
              key={`${item.label}-${item.detail}`}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="block py-3 hover:bg-paper-2/70"
            >
              <p className="text-[12px] font-medium text-ink">{item.label}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-muted">{item.detail}</p>
            </a>
          ) : (
            <div key={`${item.label}-${item.detail}`} className="py-3">
              <p className="text-[12px] font-medium text-ink">{item.label}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-muted">{item.detail}</p>
            </div>
          ),
        )}
        {!items.length ? <p className="py-3 text-[12px] text-muted">None yet.</p> : null}
      </div>
    </section>
  );
}
