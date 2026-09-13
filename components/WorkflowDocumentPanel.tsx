"use client";

import type {
  Graph,
  ImplementationPlanReport,
  ImplementationReport,
  Phase,
  ResearchReport,
  WorkflowBlocker,
  WorkflowDocument,
} from "@/lib/types";
import { parseSpec } from "@/lib/spec";

export function WorkflowDocumentPanel({
  phase,
  documents,
  selectedFilename,
  onSelectDocument,
  selectedComponentId,
  graph,
  research,
  plan,
  implementation,
  blockers,
  artifactUrl,
}: {
  phase: Phase;
  documents: Record<string, WorkflowDocument>;
  selectedFilename: string;
  onSelectDocument: (filename: string) => void;
  selectedComponentId: string | null;
  graph: Graph;
  research: ResearchReport | null;
  plan: ImplementationPlanReport | null;
  implementation: ImplementationReport | null;
  blockers: WorkflowBlocker[];
  artifactUrl?: (path: string) => string | null;
}) {
  const document = documents[selectedFilename];
  const node = graph.nodes.find((item) => item.id === selectedComponentId);
  const available = Object.values(documents);
  const relatedFindings =
    research?.findings.filter((item) =>
      selectedComponentId ? item.componentIds.includes(selectedComponentId) : false,
    ) ?? [];
  const relatedSteps =
    plan?.phases.flatMap((item) =>
      item.steps.filter((step) =>
        selectedComponentId ? step.componentIds.includes(selectedComponentId) : false,
      ),
    ) ?? [];
  const decision = plan?.decisions.find(
    (item) => item.componentId === selectedComponentId,
  );
  const currentStep =
    phase === "implement"
      ? plan?.phases
          .flatMap((item) => item.steps)
          .find((step) => step.status === "running" || step.status === "error")
          ?.title ?? "Review verification"
      : phase === "plan"
        ? "Review target architecture and steps"
        : "Document legacy behavior";

  return (
    <aside className="flex min-h-[38svh] w-full shrink-0 flex-col border-t border-line bg-white lg:min-h-0 lg:w-[410px] lg:border-l lg:border-t-0">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
              Current step
            </p>
            <p className="mt-1 text-[13px] font-medium text-ink">{currentStep}</p>
          </div>
          {blockers.length ? (
            <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-medium text-bad">
              {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-medium text-good">
              No blockers
            </span>
          )}
        </div>
        {blockers.map((blocker) => (
          <p key={blocker.id} role="alert" className="mt-2 text-[12px] leading-5 text-bad">
            {blocker.message}
          </p>
        ))}
      </div>

      {node ? (
        <section className="max-h-[42%] overflow-y-auto border-b border-line px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            Selected component
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-ink">{node.label}</h2>
            {decision ? (
              <span className="text-[11px] font-medium capitalize text-accent">
                {decision.action}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] leading-5 text-muted">
            {parseSpec(node.spec).purpose || "No responsibility recorded."}
          </p>
          {decision ? (
            <p className="mt-2 text-[12px] leading-5 text-ink">{decision.rationale}</p>
          ) : null}
          <ConnectionList graph={graph} nodeId={node.id} />
          {relatedFindings.length ? (
            <DetailList
              title="Research findings"
              items={relatedFindings.map((item) => `${item.title} — ${item.summary}`)}
            />
          ) : null}
          {relatedSteps.length ? (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Implementation steps
              </p>
              <div className="mt-2 divide-y divide-line border-t border-line">
                {relatedSteps.map((step) => (
                  <div key={step.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <p className="text-[12px] font-medium text-ink">{step.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{step.changes}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] capitalize ${statusClass(step.status)}`}>
                      {step.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2">
        {available.map((item) => (
          <button
            key={item.filename}
            type="button"
            onClick={() => onSelectDocument(item.filename)}
            className={`shrink-0 rounded-md px-2 py-1.5 font-mono text-[10px] ${
              item.filename === selectedFilename
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-paper-2 hover:text-ink"
            }`}
          >
            {item.filename}
          </button>
        ))}
        {!available.length ? (
          <p className="px-1 text-[11px] text-muted">Document will appear when this phase finishes.</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {document ? (
          <>
            <MarkdownDocument content={document.content} />
            {artifactUrl?.(document.artifactPath) ? (
              <a
                href={artifactUrl(document.artifactPath)!}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-block text-[12px] font-medium text-accent hover:underline"
              >
                Open saved artifact ↗
              </a>
            ) : null}
          </>
        ) : (
          <EmptyDocument phase={phase} />
        )}
      </div>

      {phase === "implement" && implementation?.recording ? (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Verification recording
          </p>
          {artifactUrl?.(implementation.recording.path) ? (
            <video
              controls
              playsInline
              preload="metadata"
              className="mt-2 aspect-video w-full rounded-md bg-paper"
              src={artifactUrl(implementation.recording.path)!}
            />
          ) : (
            <p className="mt-1 font-mono text-[10px] text-muted">
              {implementation.recording.path}
            </p>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function ConnectionList({ graph, nodeId }: { graph: Graph; nodeId: string }) {
  const incoming = graph.edges
    .filter((edge) => edge.to === nodeId)
    .map((edge) => graph.nodes.find((node) => node.id === edge.from)?.label)
    .filter(Boolean);
  const outgoing = graph.edges
    .filter((edge) => edge.from === nodeId)
    .map((edge) => graph.nodes.find((node) => node.id === edge.to)?.label)
    .filter(Boolean);
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
      <div>
        <p className="font-medium text-ink">Receives from</p>
        <p className="mt-1 text-muted">{incoming.join(", ") || "Entry point"}</p>
      </div>
      <div>
        <p className="font-medium text-ink">Connects to</p>
        <p className="mt-1 text-muted">{outgoing.join(", ") || "Terminal component"}</p>
      </div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarkdownDocument({ content }: { content: string }) {
  const lines = content.split("\n").reduce<{
    inCode: boolean;
    values: { line: string; code: boolean; fence: boolean }[];
  }>(
    (state, line) =>
      line.trim().startsWith("```")
        ? {
            inCode: !state.inCode,
            values: [...state.values, { line, code: false, fence: true }],
          }
        : {
            inCode: state.inCode,
            values: [
              ...state.values,
              { line, code: state.inCode, fence: false },
            ],
          },
    { inCode: false, values: [] },
  ).values;
  return (
    <article className="space-y-2 text-[13px] leading-6 text-muted">
      {lines.map(({ line, code, fence }, index) => {
        if (fence) return null;
        if (code) {
          return (
            <pre key={index} className="overflow-x-auto bg-paper px-3 py-0.5 font-mono text-[11px] text-ink">
              {line || " "}
            </pre>
          );
        }
        if (line.startsWith("# ")) {
          return <h1 key={index} className="pb-2 font-serif text-2xl leading-tight text-ink">{line.slice(2)}</h1>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={index} className="pt-4 text-[15px] font-semibold text-ink">{line.slice(3)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={index} className="pt-3 text-[13px] font-semibold text-ink">{line.slice(4)}</h3>;
        }
        if (/^[-*] /.test(line)) {
          return <p key={index} className="pl-3 before:mr-2 before:text-accent before:content-['·']">{line.slice(2)}</p>;
        }
        if (/^\d+\. /.test(line)) {
          return <p key={index} className="pl-3 text-ink">{line}</p>;
        }
        return line.trim() ? <p key={index}>{line}</p> : <div key={index} className="h-1" />;
      })}
    </article>
  );
}

function EmptyDocument({ phase }: { phase: Phase }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center text-center">
      <div>
        <p className="font-serif text-xl text-ink capitalize">{phase}</p>
        <p className="mt-2 max-w-56 text-[12px] leading-5 text-muted">
          The phase document and component findings will stay accessible here.
        </p>
      </div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "done") return "text-good";
  if (status === "error") return "text-bad";
  if (status === "running") return "text-accent";
  return "text-muted";
}
