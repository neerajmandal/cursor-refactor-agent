"use client";

import { useState } from "react";
import { writeIdentity, type Identity } from "@/lib/identity";

export function NameGate({ onReady }: { onReady: (identity: Identity) => void }) {
  const [name, setName] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onReady(writeIdentity(name));
  }

  return (
    <main className="flex min-h-full flex-col justify-end px-8 py-10 md:px-16 md:py-14">
      <p className="font-serif text-4xl tracking-tight">Cural</p>
      <form onSubmit={onSubmit} className="mt-16 max-w-sm">
        <label className="block text-[13px] font-medium">Your name on this board</label>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field-input mt-2"
          placeholder="Neeraj"
        />
        <button
          type="submit"
          className="mt-8 bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
        >
          Join
        </button>
      </form>
    </main>
  );
}
