import OpenAI from "openai";

export function getXaiClient() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing XAI_API_KEY. Add it to .env.local — get a key at https://console.x.ai"
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });
}

export const DEFAULT_MODEL = process.env.XAI_MODEL || "grok-4.5";
