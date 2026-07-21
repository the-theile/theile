"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Meeting } from "@/lib/types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function Sidebar({
  meetings,
  onNew,
  query,
  onQueryChange,
}: {
  meetings: Meeting[];
  onNew: () => void;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const pathname = usePathname();
  const filtered = meetings.filter((m) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.notes.toLowerCase().includes(q) ||
      m.enhancedNotes.toLowerCase().includes(q) ||
      m.transcript.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-stone-200/80 bg-[#f7f4ef]">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-700 text-white shadow-sm">
          <BirdIcon />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-stone-900">
            Dictabird
          </div>
          <div className="text-[11px] text-stone-500">AI notepad · no bots</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.99]"
        >
          <PlusIcon />
          New meeting
        </button>
      </div>

      <div className="px-3 pb-2">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-lg border border-stone-200 bg-white/80 px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-600/40 focus:ring-2 focus:ring-amber-600/10"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-stone-400">
            {meetings.length === 0
              ? "No meetings yet. Start one."
              : "No matches."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((m) => {
              const active = pathname === `/dictabird/meeting/${m.id}`;
              return (
                <li key={m.id}>
                  <Link
                    href={`/dictabird/meeting/${m.id}`}
                    className={`block rounded-lg px-3 py-2.5 transition ${
                      active
                        ? "bg-white shadow-sm ring-1 ring-stone-200/80"
                        : "hover:bg-white/60"
                    }`}
                  >
                    <div className="truncate text-sm font-medium text-stone-800">
                      {m.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-500">
                      <span>{relativeTime(m.updatedAt)}</span>
                      {m.status === "recording" && (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                          live
                        </span>
                      )}
                      {m.enhancedNotes && (
                        <span className="text-amber-700/80">enhanced</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-stone-200/80 px-4 py-3 text-[11px] text-stone-400">
        Private by default · stored in this browser
      </div>
    </aside>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
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
      <circle cx="9.5" cy="11.5" r="1" fill="currentColor" opacity="0.9" />
      <path
        d="M4 14c-.5 1.5-1 3 .5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
