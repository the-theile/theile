"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMeetingsContext } from "@/lib/MeetingsContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { TEMPLATES } from "@/lib/templates";
import {
  applyImportToMeeting,
  parseImportFile,
} from "@/lib/importTranscript";
import type { ChatMessage, Meeting, MeetingTemplateId } from "@/lib/types";
import { Markdown } from "./Markdown";

function uid() {
  return crypto.randomUUID();
}

type MobilePanel = "notes" | "transcript" | "chat";

export function MeetingView({ id }: { id: string }) {
  const { getById, updateMeeting, removeMeeting, ready } = useMeetingsContext();
  const meeting = getById(id);
  const router = useRouter();

  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("notes");
  const [moreOpen, setMoreOpen] = useState(false);
  const [morePos, setMorePos] = useState<{ top: number; right: number } | null>(
    null
  );
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const meetingRef = useRef(meeting);

  useEffect(() => {
    meetingRef.current = meeting;
  }, [meeting]);

  const patch = useCallback(
    (partial: Partial<Meeting>) => {
      const current = meetingRef.current;
      if (!current) return;
      updateMeeting({ ...current, ...partial });
    },
    [updateMeeting]
  );

  const onSpeech = useCallback(
    (result: { transcript: string; isFinal: boolean }) => {
      if (!result.transcript) return;
      if (result.isFinal) {
        setInterim("");
        const current = meetingRef.current;
        if (!current) return;
        const segment = {
          id: uid(),
          text: result.transcript,
          timestamp: Date.now(),
          isFinal: true,
        };
        const transcript = [current.transcript, result.transcript]
          .filter(Boolean)
          .join(" ")
          .trim();
        updateMeeting({
          ...current,
          transcript,
          segments: [...current.segments, segment],
        });
      } else {
        setInterim(result.transcript);
      }
    },
    [updateMeeting]
  );

  const { listening, supported, error: speechError, start, stop } =
    useSpeechRecognition(onSpeech);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [meeting?.transcript, interim]);

  useEffect(() => {
    const current = meetingRef.current;
    if (!current) return;
    if (listening && current.status !== "recording") {
      updateMeeting({ ...current, status: "recording" });
    } else if (!listening && current.status === "recording") {
      updateMeeting({ ...current, status: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-stone-400">
        Loading…
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-stone-500">
        <p>Meeting not found.</p>
        <button
          type="button"
          onClick={() => router.push("/dictabird")}
          className="text-sm text-sky-800 underline"
        >
          Back to Dictabird
        </button>
      </div>
    );
  }

  const toggleRecord = () => {
    setError(null);
    if (listening) stop();
    else start();
  };

  const enhance = async () => {
    setBusy("enhance");
    setError(null);
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: meeting.notes,
          transcript: meeting.transcript,
          title: meeting.title,
          templateId: meeting.templateId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      updateMeeting({
        ...meeting,
        enhancedNotes: data.enhanced,
        viewMode: "enhanced",
        status: "done",
      });
      setMobilePanel("notes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enhance failed");
    } finally {
      setBusy(null);
    }
  };

  const runAction = async (kind: "actions" | "follow-up" | "project-plan") => {
    setBusy(kind);
    setError(null);
    setActionResult(null);
    setMoreOpen(false);
    setMorePos(null);
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          notes: meeting.notes,
          enhancedNotes: meeting.enhancedNotes,
          transcript: meeting.transcript,
          title: meeting.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setActionResult(data.result);
      setMobilePanel("notes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: q,
      createdAt: Date.now(),
    };
    const nextChat = [...meeting.chat, userMsg];
    updateMeeting({ ...meeting, chat: nextChat });
    setBusy("chat");
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          notes: meeting.notes,
          enhancedNotes: meeting.enhancedNotes,
          transcript: meeting.transcript,
          title: meeting.title,
          history: nextChat.map((c) => ({ role: c.role, content: c.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.answer,
        createdAt: Date.now(),
      };
      const latest = meetingRef.current || meeting;
      const base = latest.chat.some((c) => c.id === userMsg.id)
        ? latest.chat
        : [...latest.chat, userMsg];
      updateMeeting({
        ...latest,
        chat: [...base, assistantMsg],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    if (!confirm("Delete this meeting? This cannot be undone.")) return;
    stop();
    removeMeeting(meeting.id);
    router.push("/dictabird");
  };

  const copyNotes = async () => {
    const text =
      meeting.viewMode === "enhanced" && meeting.enhancedNotes
        ? meeting.enhancedNotes
        : meeting.notes;
    await navigator.clipboard.writeText(text);
  };

  const openChat = () => {
    setChatOpen(true);
    setMobilePanel("chat");
    setMoreOpen(false);
    setMorePos(null);
  };

  const onImportFile = async (file: File | null) => {
    if (!file || !meetingRef.current) return;
    setError(null);
    try {
      const raw = await file.text();
      const parsed = parseImportFile(raw, file.name);
      const next = applyImportToMeeting(meetingRef.current, parsed, {
        replaceTitle:
          !meetingRef.current.title ||
          meetingRef.current.title.startsWith("Meeting —"),
      });
      updateMeeting(next);
      setMobilePanel("transcript");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  };

  const displayError = error || speechError;
  const showChatPanel = mobilePanel === "chat" || chatOpen;

  const toggleMore = () => {
    if (moreOpen) {
      setMoreOpen(false);
      setMorePos(null);
      return;
    }
    const el = moreBtnRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setMorePos({
        top: r.bottom + 6,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    setMoreOpen(true);
  };

  const closeMore = () => {
    setMoreOpen(false);
    setMorePos(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header — z-index keeps menus above notes panel */}
      <header className="relative z-30 shrink-0 border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-start gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
          <input
            value={meeting.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-400 sm:text-lg"
            placeholder="Meeting title"
          />
          <select
            value={meeting.templateId}
            onChange={(e) =>
              patch({ templateId: e.target.value as MeetingTemplateId })
            }
            className="max-w-[7.5rem] shrink-0 rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-700 outline-none focus:border-sky-600/40 sm:max-w-none sm:px-2.5"
            title="Note template"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Primary actions — no overflow clip so menus can escape */}
        <div className="flex flex-wrap gap-2 px-3 pb-2.5 sm:px-5 sm:pb-3">
          <button
            type="button"
            onClick={toggleRecord}
            disabled={!supported && !listening}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
              listening
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            {listening ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Stop
              </>
            ) : (
              <>
                <MicIcon />
                Transcribe
              </>
            )}
          </button>
          <button
            type="button"
            onClick={enhance}
            disabled={!!busy}
            className="inline-flex shrink-0 items-center rounded-full bg-sky-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-800 disabled:opacity-60"
          >
            {busy === "enhance" ? "Enhancing…" : "Enhance"}
          </button>
          <button
            type="button"
            onClick={openChat}
            className="inline-flex shrink-0 items-center rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Ask
          </button>
          <button
            ref={moreBtnRef}
            type="button"
            onClick={toggleMore}
            className="inline-flex shrink-0 items-center rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-700 hover:bg-stone-50"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            More
          </button>
        </div>
      </header>

      {/* Fixed More menu — escapes header/panel stacking so it isn’t covered */}
      {moreOpen && morePos && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] cursor-default bg-transparent"
            aria-label="Close menu"
            onClick={closeMore}
          />
          <div
            role="menu"
            className="fixed z-[90] w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
            style={{ top: morePos.top, right: morePos.right }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void copyNotes();
                closeMore();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Copy notes
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void runAction("actions")}
              className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              List actions
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void runAction("follow-up")}
              className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Follow-up email
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void runAction("project-plan")}
              className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Project plan
            </button>
            <div className="my-1 border-t border-stone-100" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMore();
                importRef.current?.click();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Import processed transcript
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMore();
                handleDelete();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Delete meeting
            </button>
          </div>
        </>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".json,.md,.txt,application/json,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          void onImportFile(f);
        }}
      />

      {displayError && (
        <div className="shrink-0 border-b border-red-100 bg-red-50 px-3 py-2 text-sm leading-snug text-red-700 sm:px-5">
          {displayError}
          {displayError.includes("XAI_API_KEY") && (
            <span className="mt-1 block sm:ml-1 sm:mt-0 sm:inline">
              Set <code className="rounded bg-red-100 px-1">XAI_API_KEY</code>{" "}
              in Vercel or{" "}
              <a
                className="underline"
                href="https://console.x.ai"
                target="_blank"
                rel="noreferrer"
              >
                console.x.ai
              </a>
              .
            </span>
          )}
        </div>
      )}

      {!supported && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-amber-900 sm:px-5">
          Live speech may be limited on this browser. You can still type notes
          and paste a transcript.
        </div>
      )}

      {/* Body: mobile = single panel; desktop = split */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Notepad */}
        <section
          className={[
            "min-h-0 min-w-0 flex-1 flex-col border-stone-200/70 md:flex md:border-r",
            mobilePanel === "notes" ? "flex" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="flex items-center gap-1 border-b border-stone-100 px-3 py-2 sm:px-5">
            <TabButton
              active={meeting.viewMode === "notes"}
              onClick={() => patch({ viewMode: "notes" })}
            >
              My notes
            </TabButton>
            <TabButton
              active={meeting.viewMode === "enhanced"}
              onClick={() => patch({ viewMode: "enhanced" })}
              disabled={!meeting.enhancedNotes}
            >
              Enhanced
            </TabButton>
            {listening && (
              <span className="ml-auto hidden text-xs text-stone-400 sm:inline">
                Listening…
              </span>
            )}
          </div>

          {meeting.viewMode === "notes" ? (
            <textarea
              ref={notesRef}
              value={meeting.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Write as much or as little as you like…"
              className="min-h-[12rem] flex-1 resize-none bg-transparent px-4 py-4 text-base leading-7 text-stone-800 outline-none placeholder:text-stone-400 sm:min-h-0 sm:px-6 sm:py-5 sm:text-[15px]"
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <Markdown content={meeting.enhancedNotes} />
            </div>
          )}

          {/* Post-meeting actions — desktop only row; mobile uses More menu */}
          <div className="hidden flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-3 md:flex">
            <span className="mr-1 text-xs text-stone-400">After meeting</span>
            <ActionChip
              label={busy === "actions" ? "…" : "List actions"}
              onClick={() => runAction("actions")}
              disabled={!!busy}
            />
            <ActionChip
              label={busy === "follow-up" ? "…" : "Follow-up email"}
              onClick={() => runAction("follow-up")}
              disabled={!!busy}
            />
            <ActionChip
              label={busy === "project-plan" ? "…" : "Project plan"}
              onClick={() => runAction("project-plan")}
              disabled={!!busy}
            />
          </div>

          {actionResult && (
            <div className="max-h-40 shrink-0 overflow-y-auto border-t border-stone-100 bg-white/70 px-4 py-3 sm:max-h-48 sm:px-6 sm:py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Generated
                </span>
                <button
                  type="button"
                  className="text-xs text-stone-500 hover:text-stone-800"
                  onClick={() => setActionResult(null)}
                >
                  Close
                </button>
              </div>
              <Markdown content={actionResult} />
            </div>
          )}
        </section>

        {/* Transcript */}
        <aside
          className={[
            "min-h-0 flex-col bg-white/40 md:flex md:w-[min(340px,36vw)] md:shrink-0",
            mobilePanel === "transcript" ? "flex flex-1" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="border-b border-stone-100 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-stone-400">
            Transcript
            {listening && (
              <span className="ml-2 font-normal normal-case text-red-600">
                live
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 text-[15px] leading-relaxed text-stone-600 sm:text-sm">
            {meeting.transcript || interim ? (
              <>
                <p className="whitespace-pre-wrap break-words">
                  {meeting.transcript}
                  {interim && (
                    <span className="text-stone-400"> {interim}</span>
                  )}
                </p>
                <div ref={transcriptEndRef} />
              </>
            ) : (
              <p className="text-stone-400 italic">
                Press Transcribe for live captions, paste below, or use{" "}
                <strong className="font-medium text-stone-500">
                  More → Import processed transcript
                </strong>{" "}
                after running the desktop processor on a Voice Memo.
              </p>
            )}
          </div>
          <div className="border-t border-stone-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
            <label className="mb-1 block text-[11px] text-stone-400">
              Edit / paste transcript
            </label>
            <textarea
              value={meeting.transcript}
              onChange={(e) => patch({ transcript: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-base text-stone-700 outline-none focus:border-sky-600/40 sm:text-xs"
              placeholder="Paste transcript from Zoom, Meet, etc."
            />
          </div>
        </aside>

        {/* Chat — mobile full panel or desktop side drawer */}
        <aside
          className={[
            "min-h-0 flex-col border-stone-200 bg-white md:border-l",
            showChatPanel ? "flex flex-1" : "hidden",
            chatOpen ? "md:flex md:w-80 md:shrink-0 md:flex-none" : "md:hidden",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
            <span className="text-sm font-medium text-stone-800">
              Ask anything
            </span>
            <button
              type="button"
              onClick={() => {
                setChatOpen(false);
                setMobilePanel("notes");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
            {meeting.chat.length === 0 && (
              <p className="text-xs text-stone-400">
                e.g. “What decisions were made?” or “Who owns the follow-ups?”
              </p>
            )}
            {meeting.chat.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm break-words ${
                  m.role === "user"
                    ? "ml-6 bg-stone-900 text-white"
                    : "mr-4 bg-stone-100 text-stone-800"
                }`}
              >
                {m.role === "assistant" ? (
                  <Markdown content={m.content} />
                ) : (
                  m.content
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-stone-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
              placeholder="Ask about this meeting…"
              className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2.5 text-base outline-none focus:border-sky-600/40 sm:py-2 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => void sendChat()}
              disabled={!!busy || !chatInput.trim()}
              className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm text-white disabled:opacity-50 sm:py-2"
            >
              {busy === "chat" ? "…" : "Send"}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="flex shrink-0 border-t border-stone-200 bg-white pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden">
        <MobileTab
          label="Notes"
          active={mobilePanel === "notes"}
          onClick={() => setMobilePanel("notes")}
        />
        <MobileTab
          label="Transcript"
          active={mobilePanel === "transcript"}
          onClick={() => setMobilePanel("transcript")}
          badge={listening ? "live" : undefined}
        />
        <MobileTab
          label="Ask"
          active={mobilePanel === "chat"}
          onClick={openChat}
        />
      </nav>
    </div>
  );
}

function MobileTab({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium ${
        active ? "text-sky-800" : "text-stone-500"
      }`}
    >
      <span
        className={`h-1 w-8 rounded-full ${active ? "bg-sky-700" : "bg-transparent"}`}
      />
      {label}
      {badge && (
        <span className="absolute right-1/4 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
      )}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm transition disabled:opacity-40 ${
        active
          ? "bg-stone-900 text-white"
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      }`}
    >
      {children}
    </button>
  );
}

function ActionChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
