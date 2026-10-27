import type { AutoCheckRule } from "../schema";
import { checkUrl, safeFetch, type Resolver } from "./safe-fetch";

export type CheckResult = { reqId: string; status: "pass" | "fail" | "unsure"; reason: string; evidenceUrl?: string };
export type Page = { url: string; status: number; html: string };
export type Pages = { homepage: Page | null; homepageError?: string; privacy: Page | null };

const stripWww = (h: string) => h.replace(/^www\./, "");

export function findPrivacyLink(html: string, baseUrl: string): string | null {
  const base = new URL(baseUrl);
  for (const m of html.matchAll(/<a\b[^<>]{0,500}?href\s*=\s*["']([^"'#<>]{1,500})["'][^<>]{0,500}>([^<]{0,500}(?:<[^<]{0,500}){0,5}?)<\/a>/gi)) {
    if (!/privacy/i.test(m[1]) && !/privacy/i.test(m[2].replace(/<[^>]+>/g, ""))) continue;
    try {
      const u = new URL(m[1], base);
      if (u.protocol === "https:" && stripWww(u.hostname) === stripWww(base.hostname)) return u.toString();
    } catch { /* skip malformed href */ }
  }
  return null;
}

// Linear: one regex scan forward + indexOf for the close tag. Works on the lowercased string only
// (output is used for case-insensitive matching; toLowerCase can change length so never mix indices).
function stripBlocks(html: string): string {
  const lower = html.toLowerCase();
  const open = /<(script|style)\b/g;
  let out = "";
  let i = 0;
  for (;;) {
    open.lastIndex = i;
    const m = open.exec(lower);
    if (!m) return out + lower.slice(i);
    out += lower.slice(i, m.index) + " ";
    const end = lower.indexOf("</" + m[1], m.index);
    if (end < 0) return out;
    i = end + 2;
  }
}
const text = (html: string) => stripBlocks(html).replace(/<[^<>]{0,2000}>/g, " ").replace(/\s+/g, " ");

export function evaluateRule(rule: AutoCheckRule, pages: Pages): Omit<CheckResult, "reqId"> {
  const { homepage, privacy } = pages;
  if (rule.type === "homepage_loads") {
    if (!homepage) return { status: "fail", reason: `Homepage could not be loaded${pages.homepageError ? `: ${pages.homepageError}` : ""}` };
    return homepage.status >= 200 && homepage.status < 300
      ? { status: "pass", reason: `Homepage loaded (HTTP ${homepage.status})`, evidenceUrl: homepage.url }
      : { status: "fail", reason: `Homepage returned HTTP ${homepage.status}`, evidenceUrl: homepage.url };
  }
  if (!homepage || homepage.status < 200 || homepage.status >= 300)
    return { status: "unsure", reason: homepage ? `Homepage returned HTTP ${homepage.status}` : "Homepage could not be loaded" };
  switch (rule.type) {
    case "https":
      return new URL(homepage.url).protocol === "https:"
        ? { status: "pass", reason: "Homepage is served over HTTPS", evidenceUrl: homepage.url }
        : { status: "fail", reason: "Homepage is not served over HTTPS", evidenceUrl: homepage.url };
    case "privacy_policy_found":
      return privacy
        ? { status: "pass", reason: "Privacy policy page found and loaded", evidenceUrl: privacy.url }
        : { status: "fail", reason: "No privacy policy link found on the homepage (or it could not be loaded)" };
    case "phrase_present": {
      const page = rule.page === "privacy" ? privacy : homepage;
      if (!page) return { status: "unsure", reason: "Privacy policy page not found, so its wording could not be checked" };
      const body = text(page.html).toLowerCase();
      const hit = rule.anyOf.find((p) => body.includes(p.toLowerCase()));
      return hit
        ? { status: "pass", reason: `Found "${hit}"`, evidenceUrl: page.url }
        : { status: "fail", reason: `None of the expected phrases found (${rule.anyOf.map((p) => `"${p}"`).join(", ")})`, evidenceUrl: page.url };
    }
    case "support_email_on_domain": {
      const domain = stripWww(new URL(homepage.url).hostname).toLowerCase();
      const emails = [homepage, privacy]
        .flatMap((p) => (p ? [...p.html.matchAll(/[a-z0-9._%+-]{1,64}@([a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){1,10})/gi)].map((m) => m[1].toLowerCase()) : []));
      if (!emails.length) return { status: "unsure", reason: "No email address found on the homepage or privacy page" };
      return emails.some((d) => d === domain || d.endsWith("." + domain))
        ? { status: "pass", reason: `Found an email address on ${domain}`, evidenceUrl: homepage.url }
        : { status: "fail", reason: `Only emails on other domains found (${[...new Set(emails)].join(", ")})`, evidenceUrl: homepage.url };
    }
  }
}

export async function runChecks(
  homepageUrl: string,
  rules: { reqId: string; rule: AutoCheckRule }[],
  resolve?: Resolver,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult[]> {
  const pages: Pages = { homepage: null, privacy: null };
  const signal = AbortSignal.timeout(10000); // shared deadline for the whole run
  const home = await safeFetch(homepageUrl, resolve, fetchImpl, signal);
  if ("error" in home) pages.homepageError = home.error;
  else {
    pages.homepage = { url: home.finalUrl, status: home.status, html: home.html };
    const link = !home.ok ? null : findPrivacyLink(home.html, home.finalUrl);
    if (link) {
      const p = await safeFetch(link, resolve, fetchImpl, signal);
      if (!("error" in p) && p.ok) pages.privacy = { url: p.finalUrl, status: p.status, html: p.html };
    }
  }
  return rules.map(({ reqId, rule }) => ({ reqId, ...evaluateRule(rule, pages) }));
}

export { checkUrl };
