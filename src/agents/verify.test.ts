import { describe, expect, it } from "vitest";
import { getGuide } from "../lib/guides";
import type { Guide } from "../lib/schema";
import { extractJson, priceOf } from "./llm";
import { isOfficial, verify } from "./verify";

const base = (): Guide => {
  const g = structuredClone(getGuide("docusign")!);
  g.claims = [
    { id: "a", text: "Go-Live review takes up to 2 days", status: "official", sources: [{ url: "https://developers.docusign.com/go-live/", quote: "typically completed within 48 hours", checkedAt: "x" }] },
    { id: "b", text: "Fetched from a forum", status: "official", sources: [{ url: "https://reddit.com/r/x", quote: "two days", checkedAt: "x" }] },
    { id: "c", text: "Never fetched", status: "official", sources: [{ url: "https://made.up/page", quote: "zzz", checkedAt: "x" }] },
  ];
  g.gates = g.gates.map((x) => (x.id === "go_live" ? { ...x, claimIds: ["c"], waitDays: [0, 2] } : x));
  return g;
};

describe("verify", () => {
  const captured = new Map([
    ["https://developers.docusign.com/go-live", "Reviews are typically completed within 48 hours or less."],
    ["https://reddit.com/r/x", "it took two days for me"],
  ]);

  it("sets status from captured URLs and official hosts, never from the model", () => {
    const { guide, stats } = verify(base(), captured, ["developers.docusign.com"]);
    const by = Object.fromEntries(guide.claims.map((c) => [c.id, c]));
    expect(by.a.status).toBe("official");
    expect(by.a.sources[0].verbatim).toBe(true);
    expect(by.b.status).toBe("reported");
    expect(by.c.status).toBe("unknown");
    expect(by.c.sources).toEqual([]);
    expect(stats.droppedLinks).toBe(1);
  });

  it("a provider page only listed by search, never fetched, is reported, not official", () => {
    const { guide } = verify(base(), new Map([["https://developers.docusign.com/go-live", ""]]), ["developers.docusign.com"]);
    expect(guide.claims.find((c) => c.id === "a")!.status).toBe("reported");
  });

  it("turns a wait backed only by unverified claims into unknown, with a question", () => {
    const { guide } = verify(base(), captured, ["developers.docusign.com"]);
    const g = guide.gates.find((x) => x.id === "go_live")!;
    expect(g.waitDays).toBe("unknown");
    expect(g.whatToAsk).toBeTruthy();
  });

  it("makes every requirement self-checked", () => {
    const { guide } = verify(structuredClone(getGuide("gmail")!), new Map(), []);
    expect(guide.requirements.every((r) => r.check.kind === "self")).toBe(true);
  });
});

describe("isOfficial", () => {
  it("accepts subdomains and same apex, not shared platforms", () => {
    expect(isOfficial("https://support.docusign.com/x", ["developers.docusign.com"])).toBe(true);
    expect(isOfficial("https://evil.github.io/x", ["acme.github.io"])).toBe(false);
    expect(isOfficial("not a url", ["a.com"])).toBe(false);
  });
});

describe("llm helpers", () => {
  it("prices tokens and searches", () => {
    expect(priceOf("claude-opus-5-5", { input_tokens: 1e6, output_tokens: 0 })).toBeCloseTo(4);
    expect(priceOf("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 1e5, server_tool_use: { web_search_requests: 3 } })).toBeCloseTo(1.03);
  });

  it("extracts JSON from prose or fences", () => {
    expect(extractJson('Here:\n```json\n{"a":[1]}\n```')).toEqual({ a: [1] });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("stricter evidence", () => {
  it("a provider page whose text doesn't contain the quote is reported, not official", () => {
    const pages = new Map([["https://developers.docusign.com/go-live", "This page says something else entirely."]]);
    const g = base();
    const { guide } = verify(g, pages, ["developers.docusign.com"]);
    expect(guide.claims.find((c) => c.id === "a")!.status).toBe("reported");
  });

  it("a wait backed only by an unmatched quote becomes unknown", () => {
    const g = base();
    g.gates = g.gates.map((x) => (x.id === "go_live" ? { ...x, claimIds: ["b"] } : x)); // forum quote "two days" does match...
    g.claims.find((c) => c.id === "b")!.sources[0].quote = "a quote that is not on the page";
    const { guide } = verify(g, new Map([["https://reddit.com/r/x", "it took two days for me"]]), ["developers.docusign.com"]);
    expect(guide.gates.find((x) => x.id === "go_live")!.waitDays).toBe("unknown");
  });

  it("co.uk sites don't share an apex just by being .co.uk", () => {
    expect(isOfficial("https://evil.co.uk/x", ["developer.acme.co.uk"])).toBe(false);
    expect(isOfficial("https://help.acme.co.uk/x", ["developer.acme.co.uk"])).toBe(true);
  });
});
