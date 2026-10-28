import { describe, expect, it } from "vitest";
import { score } from "./evalScore";
import { getGuide } from "./guides";

describe("eval score", () => {
  it("a reviewed guide scored against itself is clean", () => {
    const g = getGuide("xero")!;
    expect(score(g, g)).toMatchObject({ falseGreen: false, tierMatch: true, nextActionUsable: true });
  });

  it("flags a false green and a wait with no checked source", () => {
    const ref = getGuide("docusign")!;
    const gen = structuredClone(ref);
    gen.composio = { managed: true };
    gen.claims = gen.claims.map((c) => ({ ...c, sources: c.sources.map((s) => ({ ...s, verbatim: false })) }));
    const s = score(gen, ref);
    expect(s.falseGreen).toBe(true);
    expect(s.unsupportedWaits.length).toBeGreaterThan(0);
  });

  it("without a reference, accuracy fields are null", () => {
    expect(score(getGuide("gusto")!)).toMatchObject({ reference: false, falseGreen: null, tierMatch: null });
  });
});
