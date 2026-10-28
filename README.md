# Clearance

**Live:** https://clearance-oauth.vercel.app · **Repo:** https://github.com/nanddave/clearance-oauth

Composio's managed OAuth apps let developers test many connections without registering an app. Developers may still need their own provider app for branding, scopes, quota, or a toolkit without managed auth. That introduces provider-specific setup, reviews, security checks, and sometimes paid or partner requirements.

Clearance first answers the question most developers actually have: **can I just use Composio's app?** Then, for their own app, it tells them:
- **How hard it is**: Self-serve, Review, Gated or Blocked.
- **How long**: when they can build, and when real users can connect.
- **What blocks them**: the #1 blocker.
- **Where they are now**, and **the one next step**.

For that step it either **does it**, **prepares it**, or says **only you can**. Every fact carries how we know it.

## Review it in five minutes

1. Open the [live site](https://clearance-oauth.vercel.app) and choose Gmail. Select **Read and send** and **Anyone with a Google account**. Compare the managed route (test today, scopes unconfirmed) with your own app (restricted review and an unknown security-assessment wait).
2. Select **Your own app**. The two clocks show when you can test and when your own app may launch. Open a checkpoint in **Journey to launch**, tick a requirement, and watch the next action and share URL update. A tick is labelled as reported progress, never a verified connection.
3. Try [GitHub](https://clearance-oauth.vercel.app/g/github) for an easier route, [Gusto](https://clearance-oauth.vercel.app/g/gusto) for a partner gate, and [DocuSign](https://clearance-oauth.vercel.app/g/docusign) for provider review. Slack and GitHub include prefilled provider setup; the developer confirms the final creation.
4. Type an app outside the reviewed library. The agents research it live, show their work, and label the result **agent-generated, not human-reviewed**. This uses the live research budget, so a daily limit may temporarily stop new runs.
5. Open the [Gmail agent JSON](https://clearance-oauth.vercel.app/api/guides/gmail?t.uses=read_send&t.audience=external&lane=own). Its versioned `decision` distinguishes route availability, reported setup progress, and the still-unknown connection and tool result.

**A useful reviewer prompt for an agent:** “Read the JSON guide for Gmail read-and-send with external users. Can a real user perform both actions now? Name the evidence for your answer, what remains unknown, and the next test or provider step. Do not treat user-reported completion as verification.”

The guide is a decision aid. It cannot access a reviewer’s Composio account or prove their connection without a local test. The setup commands stay on the developer’s machine; paste a non-secret error into **Connection not working?** for known fixes.

## Accuracy check

**Live pilot (2026-10-28):** three apps outside the library, researched on production. Full write-up: [`docs/eval/2026-10-28-live-pilot.md`](docs/eval/2026-10-28-live-pilot.md).

| App | Time | Cost | Official claims | Unsupported waits | Next step usable |
|---|---|---|---|---|---|
| [Notion](https://clearance-oauth.vercel.app/g/notion) | 103 s | $0.49 | 7 of 7 | none | yes |
| [Calendly](https://clearance-oauth.vercel.app/g/calendly) | 69 s | $0.38 | 7 of 8 | none | yes |
| [HubSpot](https://clearance-oauth.vercel.app/g/hubspot) | 83 s | $0.54 | 6 of 6 | none | yes |

The failure was the Composio route: production's Composio key was rejected, so coverage read "unknown" for all three (a missed managed route, never a false green). Calendly may be over-cautious: it adds an unknown review step that no source confirms. `pnpm score:live <apps>` re-scores stored guides at no cost.

`pnpm eval` regenerates guides with the live agents and scores each one (`src/lib/evalScore.ts`):
- **False green:** says "Test today" on Composio's app when the reviewed guide says Composio has no app.
- **Tier match:** same difficulty tier as the human-reviewed guide.
- **Unsupported waits:** a known, non-zero wait with no word-for-word checked source behind it.
- **Next step usable:** there is a concrete next step.

It runs three reviewed apps (Xero, Gusto, Slack; DocuSign is left out because the synthesizer sees it as its example) and three it hasn't seen (Notion, Calendly, HubSpot), stops at `--budget` (default $20), and writes `docs/eval/results.md`.

## Setup
```bash
pnpm install
cp .env.example .env.local   # fill in what you have
pnpm dev
pnpm test
pnpm eval --only notion       # live accuracy check (needs ANTHROPIC_API_KEY); drop --only for all six apps
node scripts/smoke.mjs http://localhost:3000
```

- **No `ANTHROPIC_API_KEY`:** stub agents run. They're clearly labelled, and the generated guide shows a placeholder banner.
- **No `COMPOSIO_API_KEY`:** Composio coverage shows as unknown.
- **No Upstash:** jobs live in memory, which is fine locally. On Vercel, add the Upstash integration (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), so the instance running research and the one answering polls share state.

Stack: Next.js 16 (App Router), TypeScript, Zod, Vitest, `@anthropic-ai/sdk`, Upstash Redis over REST, Vercel.

## More
Key decisions, guardrails and known limitations: [`docs/decisions.md`](docs/decisions.md).

