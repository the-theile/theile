import type { Meeting, TranscriptSegment } from "./types";

const SPEAKER_RE = /\bSPEAKER[_\s]?\d+\b/gi;
const SPEAKER_NORM = /^SPEAKER[_\s]?(\d+)$/i;

/** Canonical id e.g. SPEAKER_00 */
export function normalizeSpeakerId(raw: string): string {
  const t = raw.trim();
  const m = SPEAKER_NORM.exec(t.replace(/\s+/g, "_"));
  if (m) {
    return `SPEAKER_${m[1].padStart(2, "0")}`;
  }
  // Already SPEAKER_00 style or custom
  if (/^SPEAKER_\d+$/i.test(t)) {
    const n = t.split("_")[1];
    return `SPEAKER_${n.padStart(2, "0")}`;
  }
  return t;
}

/** Find SPEAKER_XX labels in transcript + segments */
export function extractSpeakerIds(meeting: {
  transcript: string;
  segments: TranscriptSegment[];
}): string[] {
  const set = new Set<string>();

  for (const s of meeting.segments) {
    if (s.speaker && s.speaker !== "SPEAKER") {
      set.add(normalizeSpeakerId(s.speaker));
    }
  }

  const text = meeting.transcript || "";
  const matches = text.match(SPEAKER_RE) || [];
  for (const m of matches) {
    set.add(normalizeSpeakerId(m));
  }

  return [...set].sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, "") || "0", 10);
    const nb = parseInt(b.replace(/\D/g, "") || "0", 10);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

/**
 * Replace speaker labels throughout transcript, segments, and enhanced notes.
 * Map keys should be SPEAKER_00 style; values are display names (e.g. "Theile", "Sarah").
 */
export function applySpeakerNames(
  meeting: Meeting,
  nameMap: Record<string, string>
): Meeting {
  // Build replacement pairs: longest keys first to avoid partial issues
  const pairs: [string, string][] = Object.entries(nameMap)
    .map(([id, name]) => [normalizeSpeakerId(id), name.trim()] as [string, string])
    .filter(([, name]) => name.length > 0)
    .sort((a, b) => b[0].length - a[0].length);

  if (pairs.length === 0) return meeting;

  const replaceAll = (text: string): string => {
    let out = text;
    for (const [id, name] of pairs) {
      // SPEAKER_00 and SPEAKER 00 and speaker_00
      const num = id.replace(/^SPEAKER_/i, "");
      const patterns = [
        new RegExp(`\\bSPEAKER[_\\s]?0*${num}\\b`, "gi"),
        new RegExp(`\\b${escapeRegExp(id)}\\b`, "gi"),
      ];
      for (const re of patterns) {
        out = out.replace(re, name);
      }
    }
    return out;
  };

  const segments = meeting.segments.map((s) => {
    const sid = s.speaker ? normalizeSpeakerId(s.speaker) : "";
    const mapped = sid && nameMap[sid]?.trim() ? nameMap[sid].trim() : s.speaker;
    // Also try without normalize on map keys
    const direct =
      (s.speaker && nameMap[s.speaker]?.trim()) ||
      (sid && nameMap[sid]?.trim()) ||
      mapped;
    return {
      ...s,
      speaker: direct || s.speaker,
      text: replaceAll(s.text),
    };
  });

  return {
    ...meeting,
    transcript: replaceAll(meeting.transcript),
    enhancedNotes: meeting.enhancedNotes
      ? replaceAll(meeting.enhancedNotes)
      : meeting.enhancedNotes,
    segments,
    updatedAt: Date.now(),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
