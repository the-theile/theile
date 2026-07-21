"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMeetingsContext } from "@/lib/MeetingsContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { TEMPLATES } from "@/lib/templates";
import type { ChatMessage, Meeting, MeetingTemplateId } from "@/lib/types";
import { Markdown } from "./Markdown";

function uid() {
  return crypto.randomUUID();
}

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
  const notesRef = useRef<HTMLTextAreaElement>(null);
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
    // keep status in sync with listening
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
      <div className="flex h-full flex-col items-center justify-center gap-3 text-stone-500">
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

  const displayError = error || speechError;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200/80 bg-white/60 px-5 py-3 backdrop-blur">
        <input
          value={meeting.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-400"
          placeholder="Meeting title"
        />
        <select
          value={meeting.templateId}
          onChange={(e) =>
            patch({ templateId: e.target.value as MeetingTemplateId })
          }
          className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-amber-600/40"
          title="Note template"
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleRecord}
          disabled={!supported && !listening}
          className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
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
          className="rounded-full bg-sky-700 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-800 disabled:opacity-60"
        >
          {busy === "enhance" ? "Enhancing…" : "Enhance notes"}
        </button>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
        >
          Ask
        </button>
        <button
          type="button"
          onClick={copyNotes}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          title="Copy notes"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-full px-2 py-1.5 text-sm text-stone-400 hover:text-red-600"
          title="Delete meeting"
        >
          Delete
        </button>
      </header>

      {displayError && (
        <div className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">
          {displayError}
          {displayError.includes("XAI_API_KEY") && (
            <span className="ml-1">
              Create <code className="rounded bg-red-100 px-1">.env.local</code>{" "}
              with your key from{" "}
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
        <div className="border-b border-amber-100 bg-amber-50/80 px-5 py-2 text-xs text-amber-900">
          Live speech isn&apos;t supported here (use Chrome/Edge). You can still
          type notes and paste a transcript below.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Notepad */}
        <section className="flex min-w-0 flex-1 flex-col border-r border-stone-200/70">
          <div className="flex items-center gap-1 border-b border-stone-100 px-5 py-2">
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
              <span className="ml-auto text-xs text-stone-400">
                Listening… jot ideas freely
              </span>
            )}
          </div>

          {meeting.viewMode === "notes" ? (
            <textarea
              ref={notesRef}
              value={meeting.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Write as much or as little as you like…&#10;&#10;Dictabird will weave your notes with the transcript when you enhance."
              className="min-h-0 flex-1 resize-none bg-transparent px-6 py-5 font-[family-name:var(--font-note)] text-[15px] leading-7 text-stone-800 outline-none placeholder:text-stone-400"
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <Markdown content={meeting.enhancedNotes} />
            </div>
          )}

          {/* Post-meeting actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-3">
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
            <div className="max-h-48 overflow-y-auto border-t border-stone-100 bg-white/70 px-6 py-4">
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

        {/* Transcript panel */}
        <aside className="flex w-[340px] shrink-0 flex-col bg-white/40">
          <div className="border-b border-stone-100 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-stone-400">
            Transcript
            {listening && (
              <span className="ml-2 font-normal normal-case text-red-600">
                live
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-stone-600">
            {meeting.transcript || interim ? (
              <>
                <p className="whitespace-pre-wrap">
                  {meeting.transcript}
                  {interim && (
                    <span className="text-stone-400"> {interim}</span>
                  )}
                </p>
                <div ref={transcriptEndRef} />
              </>
            ) : (
              <p className="text-stone-400 italic">
                Press Transcribe to capture audio from your mic, or paste a
                transcript below.
              </p>
            )}
          </div>
          <div className="border-t border-stone-100 p-3">
            <label className="mb-1 block text-[11px] text-stone-400">
              Edit / paste transcript
            </label>
            <textarea
              value={meeting.transcript}
              onChange={(e) => patch({ transcript: e.target.value })}
              rows={4}
              className="w-full resize-none rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-700 outline-none focus:border-amber-600/40"
              placeholder="Paste transcript from Zoom, Meet, etc."
            />
          </div>
        </aside>

        {/* Chat drawer */}
        {chatOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
              <span className="text-sm font-medium text-stone-800">
                Ask anything
              </span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {meeting.chat.length === 0 && (
                <p className="text-xs text-stone-400">
                  e.g. “What decisions were made?” or “Who owns the follow-ups?”
                </p>
              )}
              {meeting.chat.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2 text-sm ${
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
            <div className="flex gap-2 border-t border-stone-100 p-3">
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
                className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-600/40"
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={!!busy || !chatInput.trim()}
                className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {busy === "chat" ? "…" : "Send"}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
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
      className={`rounded-md px-3 py-1 text-sm transition disabled:opacity-40 ${
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
