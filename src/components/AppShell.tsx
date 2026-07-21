"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MeetingsProvider,
  useMeetingsContext,
} from "@/lib/MeetingsContext";
import { Sidebar } from "./Sidebar";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { meetings, ready, addMeeting } = useMeetingsContext();
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleNew = () => {
    const m = addMeeting();
    router.push(`/dictabird/meeting/${m.id}`);
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#faf8f5] text-stone-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8f5] text-stone-900">
      <Sidebar
        meetings={meetings}
        onNew={handleNew}
        query={query}
        onQueryChange={setQuery}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
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
