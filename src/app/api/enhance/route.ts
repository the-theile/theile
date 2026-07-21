import { NextRequest, NextResponse } from "next/server";
import { getTemplate } from "@/lib/templates";
import { DEFAULT_MODEL, getXaiClient } from "@/lib/xai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      notes = "",
      transcript = "",
      title = "Meeting",
      templateId = "auto",
    } = body as {
      notes?: string;
      transcript?: string;
      title?: string;
      templateId?: string;
    };

    if (!notes.trim() && !transcript.trim()) {
      return NextResponse.json(
        { error: "Add some notes or a transcript before enhancing." },
        { status: 400 }
      );
    }

    const template = getTemplate(templateId);
    const client = getXaiClient();

    const system = `You are Dictabird, an AI notepad that enhances human meeting notes (like Granola).

Rules:
- The user's handwritten notes are the backbone. Expand and organize them using the transcript.
- If notes are sparse, build a clear structured summary from the transcript.
- Use markdown: ## headers, bullets, bold for names/decisions.
- Never invent facts not present in notes or transcript.
- Prefer scannable bullets over long paragraphs.
- End with ## Next steps when actions exist (Owner — task — deadline if known).
- Template guidance: ${template.prompt}`;

    const user = `Meeting title: ${title}

=== USER NOTES (scratchpad) ===
${notes.trim() || "(empty)"}

=== TRANSCRIPT ===
${transcript.trim() || "(empty)"}

Produce enhanced meeting notes now.`;

    const resp = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    });

    const enhanced =
      resp.choices[0]?.message?.content?.trim() ||
      "Could not generate enhanced notes.";

    return NextResponse.json({ enhanced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enhance failed";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
