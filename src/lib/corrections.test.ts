import { describe, expect, it } from "vitest";
import { correctionsSchema, corrections } from "./corrections";

describe("corrections", () => {
  it("parses with https sources", () => {
    expect(corrections.entries.length).toBeGreaterThanOrEqual(5);
    for (const e of corrections.entries) for (const s of e.sources) expect(s.startsWith("https://")).toBe(true);
  });
  it("rejects a sourceless entry unless unknown, and http urls", () => {
    const base = { app: "A", oldClaim: "x", currentFact: "y", status: "official" };
    expect(correctionsSchema.safeParse({ entries: [{ ...base, sources: [] }], unverified: [] }).success).toBe(false);
    expect(correctionsSchema.safeParse({ entries: [{ ...base, status: "unknown", sources: [] }], unverified: [] }).success).toBe(true);
    expect(correctionsSchema.safeParse({ entries: [{ ...base, sources: ["http://a.b"] }], unverified: [] }).success).toBe(false);
  });
});
