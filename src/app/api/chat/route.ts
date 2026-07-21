import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL, getXaiClient } from "@/lib/xai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      question,
      notes = "",
      enhancedNotes = "",
      transcript = "",
      title = "Meeting",
      history = [],
    } = body as {
      question?: string;
      notes?: string;
      enhancedNotes?: string;
      transcript?: string;
      title?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const client = getXaiClient();

    const system = `You are Dictabird Chat — answer questions about a single meeting using only the provided notes and transcript.
Be concise. Quote or paraphrase evidence when useful. If something isn't in the materials, say so.
Meeting title: ${title}`;

    const context = `=== ENHANCED NOTES ===
${enhancedNotes || "(none)"}

=== USER NOTES ===
${notes || "(none)"}

=== TRANSCRIPT ===
${transcript || "(none)"}`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: system },
      { role: "user", content: context },
      ...history.slice(-8).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: question.trim() },
    ];

    const resp = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.4,
    });

    const answer =
      resp.choices[0]?.message?.content?.trim() || "No answer generated.";

    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
