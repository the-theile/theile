import type { CreateMeetingInput, Meeting } from "./types";

const STORAGE_KEY = "dictabird-meetings-v1";
const LEGACY_STORAGE_KEY = "grain-notes-meetings-v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadMeetings(): Meeting[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Meeting[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMeetings(meetings: Meeting[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}

export function createMeeting(input: CreateMeetingInput = {}): Meeting {
  const now = Date.now();
  return {
    id: uid(),
    title: input.title?.trim() || defaultTitle(now),
    createdAt: now,
    updatedAt: now,
    notes: "",
    enhancedNotes: "",
    transcript: "",
    segments: [],
    templateId: input.templateId ?? "auto",
    status: "idle",
    chat: [],
    viewMode: "notes",
  };
}

function defaultTitle(ts: number): string {
  const d = new Date(ts);
  return `Meeting — ${d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function upsertMeeting(meetings: Meeting[], meeting: Meeting): Meeting[] {
  const idx = meetings.findIndex((m) => m.id === meeting.id);
  const next = { ...meeting, updatedAt: Date.now() };
  if (idx === -1) return [next, ...meetings];
  const copy = [...meetings];
  copy[idx] = next;
  return copy.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteMeeting(meetings: Meeting[], id: string): Meeting[] {
  return meetings.filter((m) => m.id !== id);
}

export function getMeeting(meetings: Meeting[], id: string): Meeting | undefined {
  return meetings.find((m) => m.id === id);
}
