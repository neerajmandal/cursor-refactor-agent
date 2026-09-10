"use client";

import { useState } from "react";
import { isCloudAgentId } from "@/lib/types";

export function AgentIdLink({
  label,
  id,
}: {
  label: string;
  id: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!id) return null;
  if (id === "pending") {
    return (
      <p className="text-[11px] text-muted">
        {label} starting…
      </p>
    );
  }
  if (!isCloudAgentId(id)) return null;

  const webUrl = `https://cursor.com/agents/${id}`;
  const desktopUrl = `cursor://anysphere.cursor-deeplink/background-agent?bcId=${id}`;

  async function copyId() {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4">
      <span className="shrink-0 text-muted">{label}</span>
      <code className="truncate font-mono text-[11px] text-ink" title={id}>
        {id}
      </code>
      <a href={desktopUrl} className="shrink-0 text-accent hover:underline">
        Open in Cursor
      </a>
      <a
        href={webUrl}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-muted hover:text-ink"
      >
        Web
      </a>
      <button
        type="button"
        onClick={() => void copyId()}
        className="shrink-0 text-muted hover:text-ink"
      >
        {copied ? "Copied" : "Copy id"}
      </button>
    </div>
  );
}
