# Phase 2: Real Agents Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans), then audited before phase 3.

**Goal:** Replace stub agents with real ones, persist jobs, and cap abuse and spend, while degrading to stubs when no key is set.

**Architecture:** One small Claude wrapper (`src/agents/llm.ts`) prices every call and captures fetched pages. `makeRealAgents()` builds per-run agents that share captured pages, so the code-only Verifier can check URLs and quotes. Jobs and counters live in a tiny KV (`src/lib/kv.ts`): Upstash REST when env is set, an in-memory Map otherwise.

**Tech Stack:** `@anthropic-ai/sdk` 1.3, Upstash REST via `fetch` (no extra dependency).

**Spec:** `docs/superpowers/specs/2026-10-28-clearance-prd.md` §7, §11 P2.

## Global Constraints
- Models: Scout `claude-haiku-5-5`, Researchers `claude-sonnet-5-5`, Synthesizer `claude-opus-5-5` (one call; one Sonnet repair call allowed if JSON fails validation).
- Prices per MTok in/out: Haiku 0.10/0.50, Sonnet 2/10, Opus 4/20; web search $10 per 1,000.
- Web tools: `web_search_20260209` + `web_fetch_20260209`, `max_uses` 4 each per researcher; resume `pause_turn` at most 2 times.
- Whole run deadline 240 s (Vercel 300 s limit).
- Evidence status is set by code: official only if the source URL was actually captured by a tool AND its host is official; otherwise reported; no sources → unknown. Quote found in fetched text → `verbatim: true`.
- Limits: `/api/generate` 3 per IP per hour; `/api/check` 20 per IP per hour; global daily spend cap `DAILY_BUDGET_USD` (default 10). Over limit → 429 with a plain message.
- No `ANTHROPIC_API_KEY` → stub agents (existing behaviour). No `COMPOSIO_API_KEY` → resolver says unknown.
- Secrets only from env; never logged.

## Review Focus
1. Model returns non-JSON or schema-invalid guide → one repair, then a failed job with a clear log line (not a crash).
2. Two lambdas: generation runs in `after()`, polling reads from another instance → job must be read from KV, not memory.
3. Budget race: many jobs at once can overshoot the cap by at most one job's cost; acceptable, documented.
4. Researcher cites a URL it never fetched → claim downgraded, never "official".
5. App not in Composio (404) or slug mismatch (`google-calendar` vs `googlecalendar`) → try both, then unknown.

## Tasks
1. **KV + limits.** `kv.ts` (`kvGet`, `kvSet(key, value, ttlSec)`, `kvIncr(key, ttlSec)`), `limits.ts` (`rateLimit(bucket, ip, max, windowSec)`, `addSpend(usd)`, `spentToday()`). Tests on the memory backend.
2. **Async jobs on KV.** `getJob`/`startJob` async, persisted on every event; routes and page awaiting. Existing job tests adapted.
3. **LLM wrapper + pricing.** `callClaude()` returns text, cost, captured pages; `priceOf(model, usage)` tested.
4. **Real agents.** Resolver (Composio API), Scout (Haiku JSON), Researchers (Sonnet + web tools, JSON findings), Prober (safe GET), Synthesizer (Opus → `parseGuide`, Sonnet repair), Verifier (code). Pure `verify()` unit-tested.
5. **Wire up.** Pipeline picks real vs stub; events carry `costUsd`; LiveLog shows per-line cost and total; `/api/generate` and `/api/check` rate-limited and budget-checked.
6. **Verify.** Tests, typecheck, lint, build; one live run when keys exist.
