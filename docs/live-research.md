# Live research runs

Clearance researches apps outside its reviewed library on request. These guides were produced on the live site; each is labelled agent-generated and still needs a developer to test a real connection.

| App | Time | Cost | What the agents found |
|---|---|---|---|
| [Notion](https://clearance-oauth.vercel.app/g/notion) | 75 s | $0.46 | The Authorization URL appears only after the public connection is submitted for review, with no published timeline; a Marketplace listing is a separate, optional review. |
| [Calendly](https://clearance-oauth.vercel.app/g/calendly) | 110 s | $0.55 | Self-serve: no source shows a review. Production redirects must use HTTPS, and the client secret is shown only once. |
| [HubSpot](https://clearance-oauth.vercel.app/g/hubspot) | 127 s | $0.80 | Self-serve for your own accounts; optional certification takes about 10 business days to a first reply, up to 60 days of review, and 60 active installs. |

Every wait in these guides either cites a word-for-word quote from the provider's own documentation or says "unknown".

## Limits
- A guide shows whether Composio manages the app's OAuth only when Composio's toolkit lookup succeeds; otherwise it says coverage is unknown.
- A review step needs an official, word-for-word source saying the provider reviews apps. Without one, the step is left out and the open question is shown instead.
- No run used a developer's connected account. Whether a given account can connect and run a tool is confirmed only by the local connection check.
