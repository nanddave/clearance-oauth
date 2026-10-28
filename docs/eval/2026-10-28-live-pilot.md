# Live research pilot (2026-10-28, production, pipeline 3)

Three apps outside the reviewed library, researched on https://clearance-oauth.vercel.app and scored with `pnpm score:live notion calendly hubspot` (re-scores stored guides; no new spend).

| App | Time | Cost | Claims (official / reported) | Quotes matched word for word | Own-app tier | Unsupported waits | Next step usable | Composio route |
|---|---|---|---|---|---|---|---|---|
| [Notion](https://clearance-oauth.vercel.app/g/notion) | 103 s | $0.49 | 7 / 0 | 12 | Review (wait unknown) | none | yes | unknown: API key rejected |
| [Calendly](https://clearance-oauth.vercel.app/g/calendly) | 69 s | $0.38 | 7 / 1 | 7 | Review (wait unknown) | none | yes | unknown: API key rejected |
| [HubSpot](https://clearance-oauth.vercel.app/g/hubspot) | 83 s | $0.54 | 6 / 0 | 6 | Self-serve; listing and certification behind a toggle | none | yes | unknown: API key rejected |

Total $1.41 for three guides, about 85 s each.

## What held
- No invented Composio facts: the earlier Notion guide carried DocuSign's Composio guide link; the rerun has none (`composio` is now set by code only).
- Optional steps stay optional: Notion's Marketplace listing and HubSpot's listing and certification sit behind a distribution toggle instead of making the default path Gated.
- Notion's real catch survived the rerun: the Authorization URL appears only after you submit the connection for review.
- Every wait has a word-for-word quoted source or says "unknown".

## What failed or is uncertain
- **Composio route missed on all three.** Production's `COMPOSIO_API_KEY` is rejected (HTTP 401), so coverage reads "unknown" and the managed route is never offered. This is a false "unknown", not a false green. Fix: replace the key in Vercel (check it with `curl -H "x-api-key: $KEY" https://backend.composio.dev/api/v3.1/toolkits/gmail` → 200).
- **Calendly may be over-cautious.** No source says Calendly reviews Production apps; the guide adds an unknown-wait "confirm whether Calendly reviews" step, which makes the tier Review. Honest, but possibly a false "slower than reality".
- No reference guides exist for these apps, so tier accuracy is judged by reading, not scored. `pnpm eval` (local, needs keys) regenerates reviewed apps to score tier match and false greens against the human versions; not run yet.
