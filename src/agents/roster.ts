import type { AgentId } from "./types";

export type RosterEntry = {
  label: string;
  model: "code" | "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";
  tools: string[];
  why: string;
};

// Values from spec §7 "Agent roster and model routing".
export const ROSTER: Record<AgentId, RosterEntry> = {
  resolver: { label: "Resolver", model: "code", tools: ["Composio API (read)"], why: "lookup, no judgment" },
  scout: {
    label: "Scout",
    model: "claude-haiku-5-5",
    tools: [],
    why: "cheap: pick the official dev-portal hosts and docs URLs from search hits code already has (no tools; no web tools on Haiku)",
  },
  researcherSetup: {
    label: "Researcher A — setup & scopes",
    model: "claude-sonnet-5-5",
    tools: ["web_search (capped max_uses)", "web_fetch (capped max_uses)"],
    why: "reading docs well, fast; runs in parallel with B",
  },
  researcherApproval: {
    label: "Researcher B — approval & policy",
    model: "claude-sonnet-5-5",
    tools: ["web_search (capped max_uses)", "web_fetch (capped max_uses)"],
    why: "same; parallelism keeps us under the 240 s deadline",
  },
  prober: { label: "Prober", model: "code", tools: ["GET only, official hosts only"], why: "confirms the auth endpoint is reachable; never marks anything \"Tested\"" },
  synthesizer: {
    label: "Synthesizer",
    model: "claude-opus-5-5",
    tools: [],
    why: "the only hard judgment: build the gate/requirement graph, weigh conflicting sources (one call, structured output)",
  },
  verifier: {
    label: "Verifier",
    model: "code",
    tools: [],
    why: "quotes must match captured pages; evidence status set by code",
  },
  readiness: {
    label: "Readiness checker",
    model: "code",
    tools: ["fetch only URLs the user typed (SSRF-guarded)"],
    why: "most checks are string/HTTP facts (v1.1: Haiku 5.5 for fuzzy criteria). Not part of generation.",
  },
};

/** Agents that run during generation (readiness runs separately, on the guide page). */
export const GENERATION_AGENTS: AgentId[] = [
  "resolver",
  "scout",
  "researcherSetup",
  "researcherApproval",
  "prober",
  "synthesizer",
  "verifier",
];
