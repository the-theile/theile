"use client";

import { useRouter } from "next/navigation";
import { useMeetingsContext } from "@/lib/MeetingsContext";
import { DictabirdLogo } from "@/components/DictabirdLogo";

export default function DictabirdHomePage() {
  const { meetings, addMeeting } = useMeetingsContext();
  const router = useRouter();

  const start = () => {
    const m = addMeeting();
    router.push(`/dictabird/meeting/${m.id}`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0E2E52] shadow-md ring-2 ring-[#E8A33D]/40 sm:h-24 sm:w-24">
            <DictabirdLogo className="h-16 w-16 sm:h-20 sm:w-20" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Dictabird
          </h1>
          <p className="mt-1 text-sm font-medium text-sky-800/80">
            A prehistoric parrot for modern meetings
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-500 sm:text-base">
            Write sparse notes while you listen. Dictabird transcribes from your
            mic (no meeting bot), then enhances your notes with the transcript —
            like <span className="text-stone-700">Granola.ai</span>, local and
            yours.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={start}
              className="rounded-full bg-stone-900 px-6 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 sm:py-3"
            >
              Start a meeting
            </button>
            {meetings[0] && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/dictabird/meeting/${meetings[0].id}`)
                }
                className="rounded-full border border-stone-200 bg-white px-6 py-3.5 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:py-3"
              >
                Open latest
              </button>
            )}
          </div>
        </div>

        <ul className="mt-10 grid gap-3 text-left text-sm text-stone-600 sm:mt-12 sm:grid-cols-3">
          <li className="rounded-xl border border-stone-200/80 bg-white/70 p-4">
            <div className="font-medium text-stone-800">Live (light)</div>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Browser mic captions + typed notes. One mic at a time — skip
              Voice Memos if you use Transcribe.
            </p>
          </li>
          <li className="rounded-xl border border-stone-200/80 bg-white/70 p-4">
            <div className="font-medium text-stone-800">Offline (deep)</div>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Voice Memo on phone → process on desktop (private) → import{" "}
              <code className="text-[10px]">.dictabird.json</code> here.
            </p>
          </li>
          <li className="rounded-xl border border-stone-200/80 bg-white/70 p-4">
            <div className="font-medium text-stone-800">Enhance</div>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              AI merges your notes with the transcript into actions and
              follow-ups.
            </p>
          </li>
        </ul>

        <p className="mt-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-stone-400 sm:mt-10">
          <a href="/" className="underline hover:text-stone-600">
            ← Back to Theile
          </a>
        </p>
      </div>
    </div>
  );
}
