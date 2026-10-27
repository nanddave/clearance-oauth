import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computePlan } from "./engine";
import { getGuide, listGuides } from "./guides";
import { parseSelection, toSearchParams } from "./selection";

// strip markdown bold and [X]-style tags so quotes can be clean summaries of the notes
const norm = (x: string) => x.replace(/\*\*/g, "").replace(/\s*\[[^\]]*\]/g, "");
const facts = norm(readFileSync("docs/research/2026-10-27-provider-facts.md", "utf8"));
const sel = (slug: string, q = "") => {
  const g = getGuide(slug)!;
  return computePlan(g, parseSelection(g, new URLSearchParams(q)));
};

describe("showcase guides", () => {
  it("all six guides parse", () => {
    expect(listGuides().map((g) => g.slug).sort()).toEqual(["docusign", "github", "gmail", "gusto", "slack", "xero"]);
    expect(getGuide("nope")).toBeNull();
  });

  it("every claimId, requires and dependsOn reference an existing id", () => {
    for (const g of listGuides()) {
      const claims = new Set(g.claims.map((c) => c.id));
      const gates = new Set(g.gates.map((x) => x.id));
      const reqs = new Set(g.requirements.map((x) => x.id));
      const toggles = new Map(g.toggles.map((t) => [t.id, new Set(t.options.map((o) => o.id))]));
      for (const x of [...g.gates, ...g.requirements]) {
        x.claimIds.forEach((id) => expect(claims.has(id), `${g.slug}:${x.id} claim ${id}`).toBe(true));
        for (const [tid, opts] of Object.entries(x.appliesWhen ?? {}))
          opts.forEach((o) => expect(toggles.get(tid)?.has(o), `${g.slug}:${x.id} appliesWhen ${tid}=${o}`).toBe(true));
      }
      for (const x of g.gates) {
        x.dependsOn.forEach((id) => expect(gates.has(id), `${g.slug}:${x.id} dep ${id}`).toBe(true));
        x.requires.forEach((id) => expect(reqs.has(id), `${g.slug}:${x.id} requires ${id}`).toBe(true));
      }
      for (const x of g.requirements) x.dependsOn.forEach((id) => expect(reqs.has(id)).toBe(true));
      expect(computePlan(g, parseSelection(g, new URLSearchParams())).order.length).toBeGreaterThan(0);
    }
  });

  it("every claim has a source unless unknown, and quotes come from the research notes", () => {
    for (const g of listGuides())
      for (const c of g.claims) {
        if (c.status !== "unknown") expect(c.sources.length, `${g.slug}:${c.id}`).toBeGreaterThan(0);
        if (c.status === "conflicting") expect(c.sources.length).toBeGreaterThanOrEqual(2);
        for (const s of c.sources) {
          expect(s.checkedAt).toBe("2026-10-27");
          expect(s.url, `${g.slug}:${c.id} url`).toMatch(/^https:\/\//);
          expect(facts.includes(norm(s.quote)), `${g.slug}:${c.id} quote`).toBe(true);
        }
      }
  });

  it("gmail read is gated and send is review", () => {
    expect(sel("gmail", "t.uses=read").tier).toBe("gated");
    expect(sel("gmail", "t.uses=send").tier).toBe("review");
    expect(sel("gmail", "t.uses=read&t.audience=internal").tier).toBe("self-serve");
  });

  it("docusign has no 20-call gate", () => {
    const g = getGuide("docusign")!;
    expect(g.gates.some((x) => /20/.test(x.title))).toBe(false);
    expect(g.claims.find((c) => c.id === "d_no20")?.status).toBe("official");
    expect(sel("docusign", "t.integration=public").tier).toBe("gated");
  });

  it("other tiers", () => {
    expect(sel("gusto").tier).toBe("gated");
    expect(sel("slack").tier).toBe("gated");
    expect(sel("github").tier).toBe("self-serve");
    expect(sel("xero").tier).toBe("self-serve");
  });
});

describe("selection", () => {
  const g = getGuide("gmail")!;
  it("parseSelection drops unknown ids and falls back to defaults", () => {
    const s = parseSelection(g, new URLSearchParams("t.uses=bogus&t.zzz=1&have=privacy_policy,nope,homepage"));
    expect(s.toggles).toEqual({ uses: "read", audience: "external" });
    expect([...s.have].sort()).toEqual(["homepage", "privacy_policy"]);
  });
  it("toSearchParams round-trips", () => {
    const s = parseSelection(g, new URLSearchParams("t.uses=send&have=privacy_policy,homepage"));
    expect(toSearchParams(s)).toBe("?t.uses=send&t.audience=external&have=privacy_policy,homepage");
    expect(parseSelection(g, new URLSearchParams(toSearchParams(s)))).toEqual(s);
  });
});
