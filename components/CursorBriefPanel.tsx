"use client";

import { useState } from "react";
import {
  cursorDesktopUrl,
  cursorWebUrl,
  formatCursorChatIdea,
} from "@/lib/cursor-links";
import { isCloudAgentId } from "@/lib/types";

export type CursorChat = {
  label: string;
  detail: string;
  id: string;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={!text.trim()}
      className="text-[12px] font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function ChatRow({ chat }: { chat: CursorChat }) {
  if (!chat.id) {
    return (
      <div className="border-b border-line py-5">
        <p className="text-sm font-medium">{chat.label}</p>
        <p className="mt-1 text-[13px] text-muted">{chat.detail}</p>
        <p className="mt-2 text-[13px] text-muted">Not started yet.</p>
      </div>
    );
  }
  if (chat.id === "pending") {
    return (
      <div className="border-b border-line py-5">
        <p className="text-sm font-medium">{chat.label}</p>
        <p className="mt-1 text-[13px] text-muted">{chat.detail}</p>
        <p className="mt-2 text-[13px] text-muted">Starting…</p>
      </div>
    );
  }
  if (!isCloudAgentId(chat.id)) {
    return (
      <div className="border-b border-line py-5">
        <p className="text-sm font-medium">{chat.label}</p>
        <p className="mt-1 text-[13px] text-muted">{chat.detail}</p>
        <p className="mt-2 font-mono text-[12px] text-muted">{chat.id}</p>
      </div>
    );
  }

  return (
    <div className="border-b border-line py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{chat.label}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <a href={cursorDesktopUrl(chat.id)} className="font-medium text-accent hover:underline">
            Open in Cursor
          </a>
          <a
            href={cursorWebUrl(chat.id)}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-ink"
          >
            Open on web
          </a>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted">{chat.detail}</p>
      <p className="mt-2 truncate font-mono text-[12px] text-muted" title={chat.id}>
        {chat.id}
      </p>
    </div>
  );
}

export function CursorBriefPanel({
  prompt,
  envName,
  legacyRepo,
  targetRepo,
  chats,
}: {
  prompt: string;
  envName?: string;
  legacyRepo?: string;
  targetRepo?: string;
  chats: CursorChat[];
}) {
  const idea = formatCursorChatIdea({ prompt, envName, legacyRepo, targetRepo });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Chat idea for Cursor
        </p>
        <h2 className="mt-2 font-serif text-4xl tracking-tight">
          {envName?.trim() || "Migration idea"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          The brief sent to Cursor agents. Copy it for a new chat, or open the
          existing agent conversations.
        </p>

        <section className="mt-8 border-t border-line pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Idea
            </h3>
            <CopyButton text={idea} label="Copy for Cursor" />
          </div>
          {prompt.trim() ? (
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-ink">
              {prompt.trim()}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">No migration prompt was saved.</p>
          )}
          {(legacyRepo || targetRepo) ? (
            <dl className="mt-6 space-y-2 text-[13px]">
              {legacyRepo ? (
                <div className="grid gap-1 md:grid-cols-[88px_1fr]">
                  <dt className="text-muted">Legacy</dt>
                  <dd className="break-all font-mono text-[12px]">{legacyRepo}</dd>
                </div>
              ) : null}
              {targetRepo ? (
                <div className="grid gap-1 md:grid-cols-[88px_1fr]">
                  <dt className="text-muted">Target</dt>
                  <dd className="break-all font-mono text-[12px]">{targetRepo}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>

        <section className="mt-10 border-t border-line pt-6">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Cursor chats
          </h3>
          <div className="mt-2">
            {chats.map((chat) => (
              <ChatRow key={chat.label} chat={chat} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
