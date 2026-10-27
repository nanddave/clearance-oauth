import type { Guide } from "../lib/schema";
import type { Captured } from "./llm";

// Multi-tenant platforms: sharing an apex with these says nothing about who wrote the page.
const SHARED_APEX = new Set(["github.io", "gitbook.io", "readme.io", "medium.com", "notion.site", "vercel.app", "netlify.app", "herokuapp.com", "zendesk.com", "freshdesk.com", "intercom.help", "atlassian.net"]);

// shortcut: last two labels as the apex, wrong for co.uk-style suffixes; upgrade with a public-suffix list.
const apex = (host: string) => host.split(".").slice(-2).join(".");
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
export const normUrl = (url: string) => url.replace(/#.*$/, "").replace(/\/+$/, "");
const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function isOfficial(url: string, officialHosts: string[]): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return officialHosts.some((o) => h === o || h.endsWith("." + o) || (!SHARED_APEX.has(apex(o)) && apex(h) === apex(o)));
}

/**
 * Code, not a model, decides evidence: a source survives only if a web tool really returned that URL;
 * status is official when a surviving source was fetched (not just listed by search) from the provider's hosts,
 * else reported; no sources → unknown.
 * Waits and acquire times that lose all their evidence become "unknown".
 */
export function verify(guide: Guide, captured: Captured, officialHosts: string[]): { guide: Guide; stats: Record<string, number> } {
  const pages = new Map([...captured].map(([u, t]) => [normUrl(u), t]));
  const stats = { official: 0, reported: 0, conflicting: 0, unknown: 0, droppedLinks: 0, verbatim: 0 };
  const claims = guide.claims.map((c) => {
    const sources = c.sources.flatMap((s) => {
      if (!pages.has(normUrl(s.url))) return (stats.droppedLinks++, []);
      const verbatim = s.quote.length >= 12 && squash(pages.get(normUrl(s.url))!).includes(squash(s.quote));
      if (verbatim) stats.verbatim++;
      return [{ ...s, verbatim }];
    });
    const status = !sources.length
      ? "unknown"
      : c.status === "conflicting"
        ? "conflicting"
        : sources.some((s) => pages.get(normUrl(s.url)) && isOfficial(s.url, officialHosts))
          ? "official"
          : "reported";
    stats[status]++;
    return { ...c, status, sources } as Guide["claims"][number];
  });
  const backed = new Set(claims.filter((c) => c.status !== "unknown").map((c) => c.id));
  const ask = "Ask the provider's developer support how long this takes today.";
  const gates = guide.gates.map((g) =>
    g.waitDays !== "unknown" && g.waitDays[1] > 0 && !g.claimIds.some((id) => backed.has(id))
      ? { ...g, waitDays: "unknown" as const, whatToAsk: g.whatToAsk ?? ask }
      : g.waitDays === "unknown" && !g.whatToAsk
        ? { ...g, whatToAsk: ask }
        : g,
  );
  const requirements = guide.requirements.map((r) => ({
    ...r,
    check: { kind: "self" as const }, // /api/check only runs rules for reviewed guides
    ...(r.acquireDays !== "unknown" && r.acquireDays[1] > 0 && !r.claimIds.some((id) => backed.has(id)) && { acquireDays: "unknown" as const }),
  }));
  return { guide: { ...guide, claims, gates, requirements }, stats };
}
