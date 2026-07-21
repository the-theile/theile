import type { DictabirdImportFile, Meeting, TranscriptSegment } from "./types";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse processor JSON (or plain text / markdown) into transcript fields.
 */
export function parseImportFile(
  raw: string,
  fileName: string
): { transcript: string; segments: TranscriptSegment[]; title?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("File is empty.");
  }

  // JSON from desktop processor
  if (trimmed.startsWith("{")) {
    let data: DictabirdImportFile;
    try {
      data = JSON.parse(trimmed) as DictabirdImportFile;
    } catch {
      throw new Error("Could not parse JSON.");
    }
    return fromDictabirdJson(data, fileName);
  }

  // Plain / markdown — use as transcript body
  return {
    transcript: trimmed,
    segments: [
      {
        id: uid(),
        text: trimmed.slice(0, 500),
        timestamp: Date.now(),
        isFinal: true,
      },
    ],
    title: fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
  };
}

function fromDictabirdJson(
  data: DictabirdImportFile,
  fileName: string
): { transcript: string; segments: TranscriptSegment[]; title?: string } {
  const segs = data.segments ?? [];
  const segments: TranscriptSegment[] = segs
    .filter((s) => (s.text || "").trim())
    .map((s) => ({
      id: uid(),
      text: (s.text || "").trim(),
      timestamp: Date.now() + Math.round((s.start || 0) * 1000),
      isFinal: true,
      speaker: s.speaker,
      startSec: s.start,
      endSec: s.end,
    }));

  let transcript = (data.transcript || "").trim();
  if (!transcript && segments.length) {
    const diarized = segments.some(
      (s) => s.speaker && s.speaker !== "SPEAKER"
    );
    transcript = segments
      .map((s) => {
        const t = formatClock(s.startSec || 0);
        if (diarized && s.speaker) {
          return `[${t}] ${s.speaker}: ${s.text}`;
        }
        return `[${t}] ${s.text}`;
      })
      .join("\n");
  }

  if (!transcript) {
    throw new Error("No transcript found in file.");
  }

  return {
    transcript,
    segments,
    title:
      data.title ||
      fileName.replace(/\.dictabird\.json$/i, "").replace(/[_-]+/g, " "),
  };
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Merge import into an existing meeting (replaces transcript; keeps notes). */
export function applyImportToMeeting(
  meeting: Meeting,
  parsed: { transcript: string; segments: TranscriptSegment[]; title?: string },
  opts?: { replaceTitle?: boolean }
): Meeting {
  return {
    ...meeting,
    title:
      opts?.replaceTitle && parsed.title ? parsed.title : meeting.title,
    transcript: parsed.transcript,
    segments: parsed.segments,
    status: "done",
    updatedAt: Date.now(),
  };
}
