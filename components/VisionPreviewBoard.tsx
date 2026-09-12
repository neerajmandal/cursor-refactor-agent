"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { CuralLogo } from "@/components/CuralLogo";
import {
  CATEGORY_LABEL,
  VISION_AS_IS,
  VISION_BASELINE,
  VISION_FINDINGS,
  VISION_FLOWS,
  VISION_SYSTEM_ASSETS,
  VISION_TO_BE,
  type StructuralFinding,
  type SystemAsset,
} from "@/lib/sample-vision";
import type { Graph } from "@/lib/types";

type VisionView = "architecture" | "system" | "findings" | "evidence";

const VIEWS: { id: VisionView; label: string }[] = [
  { id: "architecture", label: "Architecture" },
  { id: "system", label: "System" },
  { id: "findings", label: "Findings" },
  { id: "evidence", label: "Evidence" },
];

const SEVERITY_CLASS = {
  high: "text-bad",
  medium: "text-[#b45309]",
  low: "text-muted",
} as const;

const STATUS_CLASS = {
  accepted: "text-good",
  deferred: "text-[#b45309]",
  ignored: "text-muted",
} as const;

const BASELINE_CLASS = {
  captured: "text-good",
  weak: "text-[#b45309]",
  missing: "text-bad",
} as const;

export function VisionPreviewBoard() {
  const [view, setView] = useState<VisionView>("architecture");
  const [asIs, setAsIs] = useState<Graph>(VISION_AS_IS);
  const [toBe, setToBe] = useState<Graph>(VISION_TO_BE);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    "unnecessary-pipeline",
  );
  const [findings, setFindings] = useState(VISION_FINDINGS);

  const selectedFinding = findings.find((item) => item.id === selectedFindingId) ?? null;
  const highlightIds = selectedFinding?.asIsNodeIds.length
    ? selectedFinding.asIsNodeIds
    : null;

  const acceptedCount = findings.filter(
    (item) => item.kind === "structural" && item.status === "accepted",
  ).length;
  const structuralCount = findings.filter((item) => item.kind === "structural").length;

  function move(pane: "asIs" | "toBe", id: string, x: number, y: number) {
    const setter = pane === "asIs" ? setAsIs : setToBe;
    setter((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === id ? { ...node, x, y } : node,
      ),
    }));
  }

  function setFindingStatus(
    id: string,
    status: StructuralFinding["status"],
  ) {
    setFindings((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  return (
    <div className="relative flex h-svh min-h-0 flex-col bg-paper">
      <header className="shrink-0 border-b border-line bg-white">
        <div className="flex min-h-14 items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <CuralLogo className="h-[18px] w-[18px]" />
            <span className="text-[17px] font-semibold tracking-tight">Cural</span>
          </Link>
          <p className="hidden text-[13px] text-muted sm:block">
            Vision preview · map → baseline → diagnose → redesign
          </p>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12px] text-muted md:inline">
              {structuralCount} structural · {acceptedCount} accepted
            </span>
            <Link
              href="/preview"
              className="text-[13px] text-muted no-underline hover:text-ink"
            >
              Current preview
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-cta px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink"
            >
              Freeze baseline <span aria-hidden>→</span>
            </button>
          </div>
        </div>
        <div className="flex gap-6 px-4">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`border-b-2 py-2.5 text-[13px] font-medium transition-colors ${
                view === item.id
                  ? "border-[#7c3aed] text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div
        key={view}
        className="vision-fade flex min-h-0 flex-1 flex-col"
      >
        {view === "architecture" ? (
          <ArchitectureView
            asIs={asIs}
            toBe={toBe}
            highlightIds={highlightIds}
            findings={findings}
            selectedFindingId={selectedFindingId}
            onSelectFinding={setSelectedFindingId}
            onMove={move}
            onOpenFindings={() => setView("findings")}
          />
        ) : null}
        {view === "system" ? <SystemView /> : null}
        {view === "findings" ? (
          <FindingsView
            findings={findings}
            selectedFindingId={selectedFindingId}
            onSelect={setSelectedFindingId}
            onStatus={setFindingStatus}
            onShowOnDiagram={() => setView("architecture")}
          />
        ) : null}
        {view === "evidence" ? <EvidenceView /> : null}
      </div>
    </div>
  );
}

function ArchitectureView({
  asIs,
  toBe,
  highlightIds,
  findings,
  selectedFindingId,
  onSelectFinding,
  onMove,
  onOpenFindings,
}: {
  asIs: Graph;
  toBe: Graph;
  highlightIds: string[] | null;
  findings: StructuralFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
  onMove: (pane: "asIs" | "toBe", id: string, x: number, y: number) => void;
  onOpenFindings: () => void;
}) {
  const strip = findings.filter((item) => item.kind === "structural");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <ArchitecturePane
          pane="asIs"
          title="Current"
          subtitle="Story diagram · queues & stores live on System"
          graph={asIs}
          selectable={false}
          selectedId={null}
          nodeStatus={{}}
          highlightIds={highlightIds}
          onSelect={() => undefined}
          onMove={(id, x, y) => onMove("asIs", id, x, y)}
        />
        <div className="w-px bg-line" />
        <ArchitecturePane
          pane="toBe"
          title="Target"
          subtitle="Driven by accepted findings"
          graph={toBe}
          selectable={false}
          selectedId={null}
          nodeStatus={{}}
          onSelect={() => undefined}
          onMove={(id, x, y) => onMove("toBe", id, x, y)}
        />
      </div>
      <div className="shrink-0 border-t border-line bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Findings on this path
          </p>
          <button
            type="button"
            onClick={onOpenFindings}
            className="text-[12px] text-muted hover:text-ink"
          >
            Open findings →
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {strip.map((finding) => {
            const active = finding.id === selectedFindingId;
            return (
              <button
                key={finding.id}
                type="button"
                onClick={() =>
                  onSelectFinding(active ? null : finding.id)
                }
                className={`shrink-0 rounded-md border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[#7c3aed] bg-[#f3e8ff]"
                    : "border-line bg-paper hover:border-[#c4b5fd]"
                }`}
              >
                <p className="max-w-[220px] truncate text-[12px] font-medium text-ink">
                  {finding.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  <span className={SEVERITY_CLASS[finding.severity]}>
                    {finding.severity}
                  </span>
                  {" · "}
                  <span className={STATUS_CLASS[finding.status]}>
                    {finding.status}
                  </span>
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SystemView() {
  const grouped = useMemo(() => {
    const map = new Map<SystemAsset["category"], SystemAsset[]>();
    for (const asset of VISION_SYSTEM_ASSETS) {
      const list = map.get(asset.category) ?? [];
      list.push(asset);
      map.set(asset.category, list);
    }
    return map;
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            System map
          </p>
          <h2 className="mt-2 font-serif text-4xl tracking-tight">
            What the system actually does
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Full inventory lives here. The Architecture tab projects one request
            story into a 5–7 node tree — buses and stores stay off the whiteboard
            unless they are the story.
          </p>

          <div className="mt-10 space-y-10">
            {[...grouped.entries()].map(([category, assets]) => (
              <div key={category}>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  {CATEGORY_LABEL[category]}
                </h3>
                <div className="mt-3 border-t border-line">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="grid gap-1 border-b border-line py-3 md:grid-cols-[200px_1fr]"
                    >
                      <p className="text-[13px] font-medium text-ink">{asset.name}</p>
                      <p className="text-[13px] leading-5 text-muted">{asset.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Runtime flows
          </h3>
          <div className="mt-3 border-t border-line">
            {VISION_FLOWS.map((flow) => (
              <div key={flow.id} className="border-b border-line py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink">{flow.title}</p>
                  {flow.primary ? (
                    <span className="text-[11px] text-[#7c3aed]">Primary</span>
                  ) : null}
                </div>
                <p className="mt-2 font-mono text-[11px] leading-5 text-muted">
                  {flow.path.join(" → ")}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function FindingsView({
  findings,
  selectedFindingId,
  onSelect,
  onStatus,
  onShowOnDiagram,
}: {
  findings: StructuralFinding[];
  selectedFindingId: string | null;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: StructuralFinding["status"]) => void;
  onShowOnDiagram: () => void;
}) {
  const selected = findings.find((item) => item.id === selectedFindingId) ?? findings[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Diagnosis
        </p>
        <h2 className="mt-2 font-serif text-4xl tracking-tight">
          Architectural problems, not cosmetics
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Accept findings that should reshape the target. Cosmetic noise stays
          ignored and never drives the to-be diagram.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-t border-line">
            {findings.map((finding) => {
              const active = finding.id === selected.id;
              return (
                <button
                  key={finding.id}
                  type="button"
                  onClick={() => onSelect(finding.id)}
                  className={`flex w-full flex-col border-b border-line py-4 text-left transition-colors ${
                    active ? "bg-[#faf5ff]" : "hover:bg-paper-2/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 px-1">
                    <div>
                      <p className="text-[14px] font-medium text-ink">{finding.title}</p>
                      <p className="mt-1 text-[12px] text-muted">
                        <span className={SEVERITY_CLASS[finding.severity]}>
                          {finding.severity}
                        </span>
                        {" · "}
                        {finding.kind}
                        {" · "}
                        <span className={STATUS_CLASS[finding.status]}>
                          {finding.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Selected finding
            </p>
            <h3 className="mt-2 text-xl font-medium tracking-tight text-ink">
              {selected.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted">{selected.summary}</p>
            <ul className="mt-4 space-y-2 text-[13px] text-muted">
              {selected.evidence.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-[#7c3aed]" aria-hidden>
                    ·
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] leading-5 text-ink">
              <span className="text-muted">To-be implication: </span>
              {selected.toBeImplication}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(["accepted", "deferred", "ignored"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatus(selected.id, status)}
                  className={`rounded-md border px-3 py-1.5 text-[12px] capitalize transition-colors ${
                    selected.status === status
                      ? "border-[#7c3aed] bg-[#f3e8ff] text-ink"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            {selected.asIsNodeIds.length ? (
              <button
                type="button"
                onClick={onShowOnDiagram}
                className="mt-4 text-[13px] text-[#7c3aed] hover:text-ink"
              >
                Highlight on as-is diagram →
              </button>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function EvidenceView() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Behavioral baseline
        </p>
        <h2 className="mt-2 font-serif text-4xl tracking-tight">
          Prove what “correct” means first
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Captured before redesign. Later parity runs compare the target against
          this frozen baseline — not against prose similarity.
        </p>

        <div className="mt-10 border-t border-line">
          {VISION_BASELINE.map((check) => (
            <div
              key={check.id}
              className="grid gap-2 border-b border-line py-4 md:grid-cols-[240px_1fr_90px]"
            >
              <p className="text-[13px] font-medium text-ink">{check.label}</p>
              <p className="text-[13px] leading-5 text-muted">{check.detail}</p>
              <p
                className={`text-[12px] font-medium capitalize md:text-right ${BASELINE_CLASS[check.status]}`}
              >
                {check.status}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-12">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Frozen journey
          </h3>
          <div className="mt-3 border-t border-line py-5">
            <p className="text-[15px] font-medium text-ink">Ask a question</p>
            <p className="mt-2 text-[13px] text-muted">
              Actor: Customer · Required · Linked to ChatController path
            </p>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              <BaselineColumn
                title="Steps"
                items={["Enter a question", "Submit", "Wait for answer"]}
              />
              <BaselineColumn
                title="Outcomes"
                items={[
                  "200 ChatResponse with answer text",
                  "generation_status=ok|failed",
                  "History row written",
                ]}
              />
              <BaselineColumn
                title="Normalization"
                items={["omit:requestId", "omit:correlation_id", "ISO-date => <timestamp>"]}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function BaselineColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink">{title}</p>
      <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
