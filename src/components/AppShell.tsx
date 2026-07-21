"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MeetingsProvider,
  useMeetingsContext,
} from "@/lib/MeetingsContext";
import { AuthGate, signOutDictabird } from "./AuthGate";
import { DictabirdMark } from "./DictabirdLogo";
import { Sidebar } from "./Sidebar";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { meetings, ready, addMeeting } = useMeetingsContext();
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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

  const handleSignOut = async () => {
    setNavOpen(false);
    await signOutDictabird();
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
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sky-800 shadow-sm">
            <DictabirdMark className="h-7 w-7" />
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
        onSignOut={handleSignOut}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-[calc(3.25rem+env(safe-area-inset-top))] md:pt-0">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <MeetingsProvider>
        <ShellInner>{children}</ShellInner>
      </MeetingsProvider>
    </AuthGate>
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


