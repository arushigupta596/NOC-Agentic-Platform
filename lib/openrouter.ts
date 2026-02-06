import { z } from "zod";
import fs from "fs";
import path from "path";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Load a system prompt from the prompts/ directory.
 */
export function loadPrompt(filename: string): string {
  const filePath = path.join(process.cwd(), "prompts", filename);
  return fs.readFileSync(filePath, "utf-8").trim();
}

/**
 * Call OpenRouter chat completions API.
 */
async function callOpenRouter(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const {
    model = "anthropic/claude-sonnet-4",
    temperature = 0.2,
    maxTokens = 1024,
  } = options;

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://noc-agentic.vercel.app",
      "X-Title": "NOC Agentic Platform",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Call OpenRouter and parse + validate the JSON response with a Zod schema.
 * Retries once with a stricter prompt on parse failure.
 */
export async function callWithSchema<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>,
  options: OpenRouterOptions = {}
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const raw = await callOpenRouter(messages, options);

  // Try to parse the JSON response
  try {
    const parsed = JSON.parse(raw);
    const validated = schema.parse(parsed);
    return validated;
  } catch (firstError) {
    // Retry with stricter instruction
    const retryMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          "Your previous response was not valid JSON conforming to the required schema. Please output ONLY a valid JSON object with no extra text.",
      },
    ];

    const retryRaw = await callOpenRouter(retryMessages, options);
    try {
      const parsed = JSON.parse(retryRaw);
      return schema.parse(parsed);
    } catch {
      throw new Error(
        `OpenRouter response failed schema validation after retry. Raw: ${retryRaw.slice(0, 500)}`
      );
    }
  }
}
