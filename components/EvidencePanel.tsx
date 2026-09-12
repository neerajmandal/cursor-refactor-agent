"use client";

import type {
  EvaluationReport,
  EvaluationVideo,
  Journey,
  RunBranch,
  WorkItem,
} from "@/lib/types";

const STATUS_TEXT = {
  pending: "Queued",
  running: "Running",
  done: "Implemented",
  error: "Needs work",
} as const;

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

function artifactSrc(
  path: string,
  archiveId?: string,
  agentId?: string,
): string | null {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (archiveId) {
    return `/api/archives/${encodeURIComponent(archiveId)}/artifacts?path=${encodeURIComponent(path)}`;
  }
  if (agentId) {
    return `/api/agents/${agentId}/artifacts?path=${encodeURIComponent(path)}`;
  }
  return null;
}

function videoSrc(
  video: EvaluationVideo,
  agentId?: string,
  archiveId?: string,
): string | null {
  if (video.url) return video.url;
  return artifactSrc(video.path, archiveId, agentId);
}

export function EvidencePanel({
  workItems,
  report,
  videos = [],
  evaluationAgentId,
  branches,
  journeys,
  archiveId,
}: {
  workItems: Record<string, WorkItem>;
  report: EvaluationReport | null;
  videos?: EvaluationVideo[];
  evaluationAgentId?: string;
  branches: RunBranch[];
  journeys: Journey[];
  archiveId?: string;
}) {
  const items = Object.values(workItems);
  const walkthroughs = videos.length
    ? videos
    : report?.videos ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              End-to-end user testing
            </p>
            <h2 className="mt-2 font-serif text-4xl tracking-tight">
              {report
                ? report.status === "passed"
                  ? "E2E user testing passed"
                  : "Behavior differs"
                : "Evidence pending"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {report?.summary ||
                "Cural will compare frozen end-user outcomes after the Cursor VM walks both apps."}
            </p>

            {walkthroughs.length ? (
              <div className="mt-8 border-t border-line pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  VM walkthrough videos
                </h3>
                <div className="mt-4 space-y-5">
                  {walkthroughs.map((video) => {
                    const src = videoSrc(video, evaluationAgentId, archiveId);
                    return (
                      <figure key={video.path} className="space-y-2">
                        <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                          <span className="font-medium">{video.label}</span>
                          {video.journeyId ? (
                            <span className="font-mono text-[11px] text-muted">
                              {video.journeyId}
                            </span>
                          ) : null}
                        </figcaption>
                        {src ? (
                          <video
                            controls
                            playsInline
                            preload="metadata"
                            className="aspect-video w-full bg-ink/5"
                            src={src}
                          >
                            <a href={src}>Download walkthrough video</a>
                          </video>
                        ) : (
                          <p className="font-mono text-[11px] text-muted">{video.path}</p>
                        )}
                      </figure>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-8 border-t border-line">
              {report?.journeys.map((journey) => (
                <section key={journey.journeyId} className="border-b border-line py-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-medium">{journey.journeyId}</h3>
                    <span className={journey.status === "passed" ? "text-good" : "text-bad"}>
                      {journey.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Components: {
                      journeys.find((item) => item.id === journey.journeyId)
                        ?.componentIds.join(", ") || "Not linked"
                    }
                  </p>
                  <div className="mt-4 space-y-5">
                    {journey.checks.map((check) => (
                      <div key={check.name} className="grid gap-2 text-[13px] md:grid-cols-[180px_1fr]">
                        <p className="font-medium">{check.name}</p>
                        <div className="space-y-1 text-muted">
                          <p><span className="text-ink">Legacy:</span> {check.legacy}</p>
                          <p><span className="text-ink">Target:</span> {check.target}</p>
                          {check.difference ? <p className="text-bad">{check.difference}</p> : null}
                          {check.evidence.length ? (
                            <div className="space-y-2">
                              {check.evidence.map((item) => {
                                const src = artifactSrc(item, archiveId, evaluationAgentId);
                                if (src && isImagePath(item)) {
                                  return (
                                    <img
                                      key={item}
                                      src={src}
                                      alt={check.name}
                                      className="max-h-64 rounded-md border border-line"
                                    />
                                  );
                                }
                                if (src) {
                                  return (
                                    <a
                                      key={item}
                                      href={src}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block font-mono text-[11px] text-accent hover:underline"
                                    >
                                      {item}
                                    </a>
                                  );
                                }
                                return (
                                  <p key={item} className="font-mono text-[11px]">
                                    {item}
                                  </p>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )) ?? (
                <p className="py-6 text-sm text-muted">No end-to-end user testing report yet.</p>
              )}
            </div>
          </section>

          <aside>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Component work
            </h3>
            <div className="mt-3 border-t border-line">
              {items.map((item) => (
                <div key={item.componentId} className="border-b border-line py-3">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-medium">{item.label}</span>
                    <span className={
                      item.status === "done"
                        ? "text-good"
                        : item.status === "error"
                          ? "text-bad"
                          : "text-muted"
                    }>
                      {STATUS_TEXT[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">Attempt {item.attempts}</p>
                  {item.summary ? <p className="mt-2 text-xs leading-5 text-muted">{item.summary}</p> : null}
                  {item.agentId ? (
                    <p className="mt-1 truncate font-mono text-[10px] text-muted" title={`${item.agentId} / ${item.runId}`}>
                      {item.agentId} · {item.runId}
                    </p>
                  ) : null}
                </div>
              ))}
              {!items.length ? <p className="py-4 text-sm text-muted">No execution started.</p> : null}
            </div>

            {branches.length ? (
              <div className="mt-8">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  Branch evidence
                </h3>
                <div className="mt-3 space-y-2 text-xs">
                  {branches.map((branch) => (
                    <div key={`${branch.repoUrl}-${branch.branch}`} className="border-t border-line pt-2">
                      <p className="truncate font-mono text-muted">{branch.branch || branch.repoUrl}</p>
                      {branch.prUrl ? (
                        <a href={branch.prUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accent hover:underline">
                          Open pull request
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
