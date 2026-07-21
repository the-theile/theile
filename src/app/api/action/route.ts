import { NextRequest, NextResponse } from "next/server";
import { formatAiError, getAiClient } from "@/lib/ai";

type ActionKind = "actions" | "follow-up" | "project-plan";

const PROMPTS: Record<ActionKind, string> = {
  actions: `Extract a clear checklist of action items from the meeting.
Format as markdown:
## Action items
- [ ] **Owner** — task (deadline if known)

Only include items that were actually agreed or assigned. If owner is unclear, use "TBD".`,
  "follow-up": `Write a professional follow-up email summarizing the meeting.
Include:
- Brief thank you / context
- Key decisions
- Action items with owners
- Proposed next steps
Use a ready-to-send tone. Subject line on the first line as "Subject: ..."`,
  "project-plan": `Draft a short project plan based on what was discussed.
Sections:
## Goal
## Scope
## Milestones
## Owners
## Open questions
Stay faithful to the meeting content; mark unknowns clearly.`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      kind = "actions",
      notes = "",
      enhancedNotes = "",
      transcript = "",
      title = "Meeting",
    } = body as {
      kind?: ActionKind;
      notes?: string;
      enhancedNotes?: string;
      transcript?: string;
      title?: string;
    };

    if (!PROMPTS[kind]) {
      return NextResponse.json({ error: "Unknown action kind." }, { status: 400 });
    }

    const { client, model } = getAiClient();
    const material = `
Meeting: ${title}

=== ENHANCED NOTES ===
${enhancedNotes || "(none)"}

=== USER NOTES ===
${notes || "(none)"}

=== TRANSCRIPT ===
${transcript || "(none)"}
`.trim();

    if (material.replace(/\s/g, "").length < 40) {
      return NextResponse.json(
        { error: "Not enough meeting content yet." },
        { status: 400 }
      );
    }

    const resp = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You help busy people finish post-meeting admin. ${PROMPTS[kind]}`,
        },
        { role: "user", content: material },
      ],
      temperature: 0.35,
    });

    const result =
      resp.choices[0]?.message?.content?.trim() || "Nothing generated.";

    return NextResponse.json({ result });
  } catch (err) {
    const message = formatAiError(err);
    const status =
      message.includes("API key") || message.includes("No AI API") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
