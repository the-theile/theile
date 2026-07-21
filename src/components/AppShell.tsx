"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  MeetingsProvider,
  useMeetingsContext,
} from "@/lib/MeetingsContext";
import { Sidebar } from "./Sidebar";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { meetings, ready, addMeeting } = useMeetingsContext();
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Close mobile drawer on navigation
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  const handleNew = () => {
    const m = addMeeting();
    setNavOpen(false);
    router.push(`/dictabird/meeting/${m.id}`);
  };

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#faf8f5] text-stone-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[#faf8f5] text-stone-900">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-stone-200/80 bg-[#f7f4ef]/95 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-800 shadow-sm"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <button
          type="button"
          onClick={() => router.push("/dictabird")}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-700 text-white">
            <BirdIcon />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            Dictabird
          </span>
        </button>
        <button
          type="button"
          onClick={handleNew}
          className="inline-flex h-10 items-center rounded-xl bg-stone-900 px-3 text-sm font-medium text-white"
        >
          New
        </button>
      </div>

      {/* Backdrop */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-stone-900/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <Sidebar
        meetings={meetings}
        onNew={handleNew}
        query={query}
        onQueryChange={setQuery}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-[calc(3.25rem+env(safe-area-inset-top))] md:pt-0">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <MeetingsProvider>
      <ShellInner>{children}</ShellInner>
    </MeetingsProvider>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BirdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14c2-1 4-2 6-1 1.5.7 2.5 2 4 2.5 2 .7 4-.2 6-1.5-1 2.5-3.2 4.5-6 5-2.2.4-4-.3-5.5-1.5C6.5 16 5 15 4 14Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M14 8c1.5-2 3.5-3.2 6-3.5-.5 2-1.5 3.5-3 4.5L14 8Z"
        fill="currentColor"
        opacity="0.7"
      />
      <circle cx="9.5" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}
