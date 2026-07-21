"use client";

import { useRouter } from "next/navigation";
import { useMeetingsContext } from "@/lib/MeetingsContext";

export default function DictabirdHomePage() {
  const { meetings, addMeeting } = useMeetingsContext();
  const router = useRouter();

  const start = () => {
    const m = addMeeting();
    router.push(`/dictabird/meeting/${m.id}`);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-700 text-white shadow-md">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
            <circle cx="9.5" cy="11.5" r="1.2" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          The AI notepad for back-to-back meetings
        </h1>
        <p className="mt-3 text-stone-500 leading-relaxed">
          Write sparse notes while you listen. Dictabird transcribes from your
          mic (no meeting bot), then enhances your notes with the transcript —
          like <span className="text-stone-700">Granola.ai</span>, local and
          yours.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800"
          >
            Start a meeting
          </button>
          {meetings[0] && (
            <button
              type="button"
              onClick={() => router.push(`/dictabird/meeting/${meetings[0].id}`)}
              className="rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Open latest
            </button>
          )}
        </div>

        <ul className="mt-12 grid gap-3 text-left text-sm text-stone-600 sm:grid-cols-3">
          <li className="rounded-xl border border-stone-200/80 bg-white/70 p-4">
            <div className="font-medium text-stone-800">No bots</div>
            <p className="mt-1 text-xs text-stone-500 leading-relaxed">
              Captures your microphone in the browser. Works with any call app.
            </p>
          </li>
          <li className="rounded-xl border border-stone-200/80 bg-white/70 p-4">
            <div className="font-medium text-stone-800">Human notes first</div>
            <p className="mt-1 text-xs text-stone-500 leading-relaxed">
              Your scratchpad stays the backbone; AI weaves in transcript detail.
            </p>
          </li>
          <li className="rounded-xl border border-stone-200/80 bg-white/70 p-4">
            <div className="font-medium text-stone-800">After-meeting admin</div>
            <p className="mt-1 text-xs text-stone-500 leading-relaxed">
              Action lists, follow-up emails, and chat over your memory.
            </p>
          </li>
        </ul>

        <p className="mt-10 text-xs text-stone-400">
          <a href="/" className="underline hover:text-stone-600">
            ← Back to Theile
          </a>
        </p>
      </div>
    </div>
  );
}
