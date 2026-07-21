import OpenAI from "openai";

export type AiProvider = "groq" | "gemini" | "xai";

interface ProviderConfig {
  id: AiProvider;
  name: string;
  envKey: string;
  baseURL: string;
  defaultModel: string;
  free: boolean;
  signupUrl: string;
}

/**
 * OpenAI-compatible providers. Free tiers first — Dictabird will auto-pick
 * the first available key unless AI_PROVIDER is set explicitly.
 */
const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    name: "Groq",
    envKey: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    free: true,
    signupUrl: "https://console.groq.com/keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.5-flash",
    free: true,
    signupUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    envKey: "XAI_API_KEY",
    baseURL: "https://api.x.ai/v1",
    defaultModel: "grok-4.5",
    free: false,
    signupUrl: "https://console.x.ai",
  },
];

function resolveProvider(): ProviderConfig {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  if (forced) {
    const match = PROVIDERS.find((p) => p.id === forced);
    if (!match) {
      throw new Error(
        `Unknown AI_PROVIDER="${forced}". Use: groq | gemini | xai`
      );
    }
    if (!process.env[match.envKey]) {
      throw new Error(
        `AI_PROVIDER=${match.id} but ${match.envKey} is missing. Get a key: ${match.signupUrl}`
      );
    }
    return match;
  }

  // Auto: prefer free providers
  for (const p of PROVIDERS) {
    if (process.env[p.envKey]) return p;
  }

  // Also accept GOOGLE_API_KEY as alias for Gemini
  if (process.env.GOOGLE_API_KEY) {
    return PROVIDERS.find((p) => p.id === "gemini")!;
  }

  throw new Error(
    "No AI API key configured. For free use, add GROQ_API_KEY (https://console.groq.com/keys) or GEMINI_API_KEY (https://aistudio.google.com/apikey) in Vercel env vars. Paid option: XAI_API_KEY."
  );
}

function apiKeyFor(provider: ProviderConfig): string {
  if (provider.id === "gemini") {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ""
    );
  }
  return process.env[provider.envKey] || "";
}

function modelFor(provider: ProviderConfig): string {
  // Shared override, then provider-specific, then default
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  if (provider.id === "groq" && process.env.GROQ_MODEL) {
    return process.env.GROQ_MODEL;
  }
  if (provider.id === "gemini" && process.env.GEMINI_MODEL) {
    return process.env.GEMINI_MODEL;
  }
  if (provider.id === "xai" && process.env.XAI_MODEL) {
    return process.env.XAI_MODEL;
  }
  return provider.defaultModel;
}

export function getAiClient(): {
  client: OpenAI;
  model: string;
  provider: AiProvider;
  providerName: string;
} {
  const provider = resolveProvider();
  const apiKey = apiKeyFor(provider);
  if (!apiKey) {
    throw new Error(
      `Missing ${provider.envKey}. Get a free key at ${provider.signupUrl}`
    );
  }

  return {
    client: new OpenAI({
      apiKey,
      baseURL: provider.baseURL,
    }),
    model: modelFor(provider),
    provider: provider.id,
    providerName: provider.name,
  };
}

/** Friendly message for API errors (credits, rate limits, etc.) */
export function formatAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("credit") ||
    lower.includes("billing") ||
    lower.includes("payment") ||
    lower.includes("quota") ||
    lower.includes("insufficient") ||
    lower.includes("license")
  ) {
    return `${raw} — Tip: switch to a free provider. Set GROQ_API_KEY (https://console.groq.com/keys) or GEMINI_API_KEY (https://aistudio.google.com/apikey) in Vercel, remove or keep XAI_API_KEY, and redeploy. Optional: AI_PROVIDER=groq`;
  }

  return raw;
}
