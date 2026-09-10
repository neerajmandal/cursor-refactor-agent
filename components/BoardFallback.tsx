"use client";

import { Component, useEffect, useState, type ReactNode } from "react";

export function BoardFallback() {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(true), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="px-8 py-10">
      <p className="font-serif text-3xl text-muted">Cural</p>
      {hint ? (
        <p className="mt-4 max-w-md text-sm leading-6 text-muted">
          Still connecting to the board. Copy `.env.example` to `.env.local` and
          set `LIVEBLOCKS_SECRET_KEY` plus `CURSOR_API_KEY`, then restart the
          server.
        </p>
      ) : null}
    </div>
  );
}

export class BoardErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="px-8 py-10">
          <p className="font-serif text-3xl">Cural</p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            {this.state.message}. Copy `.env.example` to `.env.local` and set
            `LIVEBLOCKS_SECRET_KEY` plus `CURSOR_API_KEY`.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
