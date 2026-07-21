export type MeetingTemplateId =
  | "auto"
  | "one-on-one"
  | "standup"
  | "interview"
  | "sales"
  | "retro";

export interface MeetingTemplate {
  id: MeetingTemplateId;
  name: string;
  description: string;
  prompt: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  speaker?: string;
  startSec?: number;
  endSec?: number;
}

/** Output of tools/dictabird-processor (*.dictabird.json) */
export interface DictabirdImportFile {
  schemaVersion?: number;
  app?: string;
  title?: string;
  sourceFile?: string;
  transcript?: string;
  diarized?: boolean;
  segments?: {
    speaker?: string;
    start?: number;
    end?: number;
    text?: string;
  }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export type MeetingStatus = "idle" | "recording" | "enhancing" | "done";

export interface Meeting {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** User's live scratchpad notes */
  notes: string;
  /** AI-enhanced notes (markdown) */
  enhancedNotes: string;
  /** Full transcript text */
  transcript: string;
  segments: TranscriptSegment[];
  templateId: MeetingTemplateId;
  status: MeetingStatus;
  chat: ChatMessage[];
  /** Whether to show enhanced vs raw notes */
  viewMode: "notes" | "enhanced";
}

export interface CreateMeetingInput {
  title?: string;
  templateId?: MeetingTemplateId;
}
