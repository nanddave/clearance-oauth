import Anthropic from "@anthropic-ai/sdk";
import type { RosterEntry } from "./roster";

type Model = Exclude<RosterEntry["model"], "code">;

// $ per million tokens, input/output (claude-api skill, models.md, 2026-10-28). Haiku is the ≤100K-prompt rate.
const PRICE: Record<Model, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
const WEB_SEARCH_USD = 10 / 1000;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number } | null;
};

export function priceOf(model: Model, u: Usage): number {
  const [i, o] = PRICE[model];
  // shortcut: cache reads/writes priced as plain input (overstates cost slightly); we don't cache prompts yet.
  const input = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return (input * i + u.output_tokens * o) / 1e6 + (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
}

/** Pages the web tools actually returned: url → fetched text ("" for search hits we only saw listed). */
export type Captured = Map<string, string>;

export type CallResult = { text: string; costUsd: number };

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 2, timeout: 150_000 }));

/** One model turn, resuming pause_turn up to twice. Web results are recorded into `captured`. */
export async function callClaude(opts: {
  model: Model;
  system: string;
  prompt: string;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  web?: { maxUses: number };
  captured?: Captured;
  signal?: AbortSignal;
}): Promise<CallResult> {
  const tools = opts.web
    ? [
        { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: opts.web.maxUses },
        { type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: opts.web.maxUses },
      ]
    : undefined;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.prompt }];
  let costUsd = 0;
  let text = "";
  for (let turn = 0; turn < 3; turn++) {
    const msg = await anthropic().messages.create(
      {
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages,
        ...(tools && { tools }),
        ...(opts.effort && { output_config: { effort: opts.effort } }),
      },
      { signal: opts.signal },
    );
    costUsd += priceOf(opts.model, msg.usage);
    for (const b of msg.content) {
      if (b.type === "text") text += b.text;
      if (opts.captured && b.type === "web_search_tool_result" && Array.isArray(b.content))
        for (const r of b.content) if (!opts.captured.has(r.url)) opts.captured.set(r.url, "");
      if (opts.captured && b.type === "web_fetch_tool_result" && b.content.type === "web_fetch_result") {
        const src = b.content.content.source;
        opts.captured.set(b.content.url, src.type === "text" ? src.data : "");
      }
    }
    if (msg.stop_reason === "refusal") throw new Error("model refused");
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
    text = "";
  }
  return { text, costUsd };
}

/** The first {...} or [...] JSON value in a model reply (tolerates prose or code fences around it). */
export function extractJson(text: string): unknown {
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error("no JSON in reply");
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  const end = text.lastIndexOf(close);
  if (end <= start) throw new Error("no JSON in reply");
  return JSON.parse(text.slice(start, end + 1));
}
