"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { readIdentity } from "@/lib/identity";

const emptySubscribe = () => () => {};

const NAV = [
  {
    href: "/",
    label: "New refactor",
    icon: IconLayers,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: IconFolder,
  },
  {
    href: "/environments",
    label: "Environments",
    icon: IconStack,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: IconGear,
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const identity = mounted ? readIdentity() : null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-line bg-node px-2.5 py-4">
        <Link href="/" className="px-2.5 font-serif text-[24px] leading-none tracking-tight text-ink">
          Cural
        </Link>

        <nav className="mt-6 flex flex-1 flex-col gap-0.5" aria-label="Primary">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "flex items-center gap-2.5 rounded-lg bg-accent-soft px-2.5 py-2 text-[13px] font-medium text-accent"
                    : "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-paper-2 hover:text-ink"
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line px-1.5 pt-3">
          {identity ? (
            <div className="flex items-center gap-2 px-1 py-1">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ background: identity.color }}
                aria-hidden
              >
                {identity.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-[12px] font-medium text-ink">
                {identity.name}
              </span>
            </div>
          ) : (
            <p className="px-1 py-1 text-[11px] leading-4 text-muted">
              Join a board to set your name.
            </p>
          )}
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-paper">{children}</div>
    </div>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5L20 8l-8 4.5L4 8l8-4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4 12l8 4.5L20 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4 16l8 4.5L20 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l1.6 1.8H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="5"
        width="10"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 15v2.5A1.5 1.5 0 0 0 10.5 19H17a1.5 1.5 0 0 0 1.5-1.5V10.5A1.5 1.5 0 0 0 17 9H15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
