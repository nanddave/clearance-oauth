import { describe, expect, it } from "vitest";
import { parseGuide } from "../lib/schema";
import { runGeneration } from "./pipeline";
import { toSlug } from "./slug";
import { GENERATION_AGENTS, ROSTER } from "./roster";
import { makeStubs } from "./stubs";
import type { AgentEvent } from "./types";

const fast = () => makeStubs(async () => {});

describe("runGeneration", () => {
  it("emits at least one event from every generation agent, with roster models", async () => {
    const events: AgentEvent[] = [];
    await runGeneration("Notion", (e) => events.push(e), fast());
    for (const a of GENERATION_AGENTS) {
      const mine = events.filter((e) => e.agent === a);
      expect(mine.length, a).toBeGreaterThan(0);
      expect(mine.every((e) => e.model === ROSTER[a].model && e.message.endsWith("(stub)"))).toBe(true);
    }
  });

  it("starts both researchers before either finishes", async () => {
    let started = 0;
    let release!: () => void;
    const bothStarted = new Promise<void>((r) => (release = r));
    const researcher = async () => {
      if (++started === 2) release();
      await bothStarted; // would deadlock if run sequentially
      return [];
    };
    const deps = { ...fast(), researcherSetup: researcher, researcherApproval: researcher };
    await runGeneration("Notion", () => {}, deps);
    expect(started).toBe(2);
  });

  it("returns a schema-valid generated guide", async () => {
    const g = await runGeneration("https://www.notion.so/", () => {}, fast());
    expect(parseGuide(g)).toEqual(g);
    expect(g.origin).toBe("generated");
    expect(g.slug).toBe("notion");
  });
});

describe("toSlug", () => {
  it.each([
    ["https://www.notion.so/", "notion"],
    ["notion.so", "notion"],
    ["https://app.slack.com/a/b?c=1", "slack"],
    ["Google  Calendar!", "google-calendar"],
    ["  -Foo_Bar- ", "foo-bar"],
  ])("%s -> %s", (q, s) => expect(toSlug(q)).toBe(s));
  it("caps at 60 chars", () => expect(toSlug("a".repeat(80)).length).toBe(60));
});

describe("toSlug suffixes", () => {
  it("names co.uk-style sites by their own label", () => {
    expect(toSlug("https://www.example.co.uk/pricing")).toBe("example");
    expect(toSlug("docs.acme.com")).toBe("acme");
  });
});
