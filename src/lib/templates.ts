import type { MeetingTemplate } from "./types";

export const TEMPLATES: MeetingTemplate[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Let AI choose the best structure",
    prompt: `Structure the meeting notes in the most useful way based on content.
Use clear section headers, bullet points for key discussion, and a "Next steps" section with owners and deadlines when mentioned.
Keep the user's original notes as the backbone — expand them with transcript details, don't replace their voice.`,
  },
  {
    id: "one-on-one",
    name: "1:1",
    description: "Manager / report check-in",
    prompt: `Format as a 1:1 meeting note with sections:
- Wins & updates
- Challenges / blockers
- Feedback exchanged
- Career / growth (if discussed)
- Action items (owner + due date if mentioned)
Preserve the user's notes and enrich with transcript detail.`,
  },
  {
    id: "standup",
    name: "Stand-up",
    description: "Daily team sync",
    prompt: `Format as a stand-up with:
- Yesterday / done
- Today / planned
- Blockers
- Action items
Group by person when possible. Keep it scannable.`,
  },
  {
    id: "interview",
    name: "Interview",
    description: "Candidate interview notes",
    prompt: `Format as interview notes with:
- Candidate signals (strengths / concerns)
- Questions asked & key answers
- Skills demonstrated
- Culture / collaboration notes
- Overall assessment & recommended next step
Be factual; separate observation from inference.`,
  },
  {
    id: "sales",
    name: "Sales call",
    description: "Discovery or demo call",
    prompt: `Format as a sales call note with:
- Context & attendees
- Pain points & goals
- Product interest / objections
- Competitors or alternatives mentioned
- Budget / timeline / decision process
- Next steps & owner
Flag any buying signals or risks.`,
  },
  {
    id: "retro",
    name: "Retro",
    description: "Sprint retrospective",
    prompt: `Format as a retrospective with:
- What went well
- What didn't go well
- Ideas / experiments
- Action items (owner + when)
Keep tone constructive and specific.`,
  },
];

export function getTemplate(id: string): MeetingTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
