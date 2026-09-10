"use client";

import { useState } from "react";
import {
  parseSpec,
  specEquals,
  skimLines,
  skimPurpose,
  wordCount,
  clampWords,
  PURPOSE_WORD_LIMIT,
  SPEC_FIELDS,
  type ComponentSpec,
  type SpecFieldKey,
} from "@/lib/spec";

export function SpecPanel({
  title,
  spec,
  onSave,
  onClose,
}: {
  title: string;
  spec: unknown;
  onSave: (spec: ComponentSpec) => void;
  onClose: () => void;
}) {
  const saved = parseSpec(spec);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ComponentSpec>(saved);

  const dirty = editing && !specEquals(draft, saved);
  const purposeWords = wordCount(draft.purpose);

  function save() {
    onSave({ ...draft, purpose: clampWords(draft.purpose) });
    setEditing(false);
  }

  function cancel() {
    setDraft(saved);
    setEditing(false);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-line bg-paper-2 md:w-[380px] md:border-l md:border-t-0">
      <div className="flex h-11 shrink-0 items-center gap-3 px-4">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</p>
        {editing ? (
          <>
            <button
              type="button"
              onClick={cancel}
              className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="bg-accent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-accent-ink disabled:opacity-40"
            >
              Save
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {editing ? (
          <div className="space-y-5">
            {SPEC_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    {field.label}
                  </span>
                  {field.key === "purpose" ? (
                    <span
                      className={`text-[11px] tabular-nums ${
                        purposeWords > PURPOSE_WORD_LIMIT ? "text-bad" : "text-muted"
                      }`}
                    >
                      {purposeWords} / {PURPOSE_WORD_LIMIT}
                    </span>
                  ) : null}
                </span>
                <textarea
                  value={draft[field.key]}
                  rows={field.key === "purpose" ? 5 : field.key === "doneWhen" ? 5 : 3}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={
                    field.key === "purpose"
                      ? "2–3 sentences. What this component is for."
                      : field.key === "interface"
                        ? "One symbol per line"
                        : "One item per line"
                  }
                  className="mt-1.5 w-full resize-y bg-transparent text-[13px] leading-5 outline-none placeholder:text-muted/70"
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {SPEC_FIELDS.map((field) => {
              const value = saved[field.key].trim();
              if (!value) return null;
              return (
                <section key={field.key}>
                  <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    {field.label}
                  </h3>
                  <FieldBody field={field.key} value={value} />
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function FieldBody({ field, value }: { field: SpecFieldKey; value: string }) {
  if (field === "purpose") {
    const { lead, steps, notes } = skimPurpose(value);
    return (
      <div className="mt-1.5 space-y-2.5">
        {lead ? <p className="text-[13px] leading-5 text-ink">{lead}</p> : null}
        {steps.length > 0 ? (
          <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-5 text-ink">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
        {notes.map((note) => (
          <p key={note} className="text-[12px] leading-5 text-muted">
            {note}
          </p>
        ))}
      </div>
    );
  }

  const lines = skimLines(value);
  if (field === "interface") {
    return (
      <pre className="mt-1.5 font-mono text-[12px] leading-5 text-ink">
        {lines.join("\n")}
      </pre>
    );
  }

  if (lines.length > 1) {
    return (
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-5 text-ink">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }

  return <p className="mt-1.5 text-[13px] leading-5 text-ink">{value}</p>;
}
