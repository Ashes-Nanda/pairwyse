// Server-only Lovable AI Gateway helpers. Every call streams (per gateway contract)
// and the final text/object is consumed server-side.
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";

export const AI_MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function provider() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  let runId: string | undefined;
  return createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const body = await res.clone().text();
        throw new AiGatewayError(res.status, body.slice(0, 500));
      }
      return res;
    },
  });
}

export class AiGatewayError extends Error {
  constructor(public status: number, body: string) {
    super(
      status === 402
        ? "AI credits are exhausted. Add credits in Settings → Plans & credits."
        : status === 429
          ? "AI rate limit reached. Try again shortly."
          : `AI request failed (${status}): ${body}`,
    );
  }
}

const providerOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
} as const;

export async function generateStructured<T>(opts: {
  instructions: string;
  prompt: string;
  schema: z.ZodType<T>;
  name: string;
}): Promise<T> {
  const p = provider();
  const result = streamText({
    model: p.responses(AI_MODEL),
    instructions: opts.instructions,
    messages: [{ role: "user", content: opts.prompt }],
    output: Output.object({ schema: opts.schema, name: opts.name }),
    providerOptions,
  });
  return (await result.output) as T;
}

export async function generateTextReply(instructions: string, messages: ModelMessage[]): Promise<string> {
  const p = provider();
  const result = streamText({
    model: p.responses(AI_MODEL),
    instructions,
    messages,
    providerOptions,
  });
  const text = (await result.text).trim();
  if (!text) throw new Error("The model returned an empty reply (possible refusal).");
  return text;
}
