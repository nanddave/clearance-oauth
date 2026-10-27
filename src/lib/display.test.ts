import { describe, expect, it } from "vitest";
import { clockLabel, isStub, safeHref, waitLabel, weakestStatus } from "./display";
import { getGuide } from "./guides";

describe("display helpers", () => {
  it("labels clocks in working days and hides a zero lower bound", () => {
    expect(clockLabel({ min: 0, max: 0, unknown: true })).toBe("unknown");
    expect(clockLabel({ min: 5, max: 9, unknown: true })).toBe("≥ 5 working days + unknown");
    expect(clockLabel({ min: 1, max: 1, unknown: false })).toBe("1 working day");
    expect(clockLabel({ min: 1, max: 3, unknown: true })).toBe("≥ 1 working day + unknown");
    expect(clockLabel({ min: 2, max: 10, unknown: false })).toBe("2–10 working days");
    expect(clockLabel({ min: 0, max: 0.5, unknown: false })).toBe("same day");
  });
  it("labels waits", () => {
    expect(waitLabel("unknown")).toBe("unknown");
    expect(waitLabel([0, 0])).toBe("none");
    expect(waitLabel([3, 10])).toBe("3–10 working days");
    expect(waitLabel([0, 1])).toBe("0–1 working days");
    expect(waitLabel([1, 1])).toBe("1 working day");
  });
  it("picks the weakest cited status, null when nothing cited", () => {
    const g = getGuide("gmail")!;
    const statuses = g.claims.map((c) => c.status);
    const w = weakestStatus(g, g.claims.map((c) => c.id));
    expect(statuses).toContain(w);
    expect(weakestStatus(g, [])).toBeNull();
    const fake = { ...g, claims: [{ ...g.claims[0], status: "official" as const }, { ...g.claims[1], status: "reported" as const }] };
    expect(weakestStatus(fake, [g.claims[0].id, g.claims[1].id])).toBe("reported");
  });
  it("detects stub guides and unsafe links", () => {
    const g = getGuide("gmail")!;
    expect(isStub(g)).toBe(false);
    expect(isStub({ ...g, claims: [{ ...g.claims[0], text: "Stub: nothing" }] })).toBe(true);
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
    expect(safeHref("https://x.dev")).toBe("https://x.dev");
  });
});

describe("planDelta", async () => {
  const { planDelta } = await import("./display");
  it("rounds the extra known days up and never goes negative", () => {
    expect(planDelta({ min: 10.6, max: 11.6, unknown: true }, { min: 10.8, max: 14.6, unknown: true })).toBe(3);
    expect(planDelta({ min: 1, max: 2, unknown: false }, { min: 1, max: 2, unknown: false })).toBe(0);
  });
});

describe("missingImpact", async () => {
  const { missingImpact } = await import("./display");
  const c = (max: number) => ({ min: 0, max, unknown: true });
  it("never reports an unknown-duration item as adding nothing", () => {
    expect(missingImpact(c(10), c(10), [{ acquireDays: "unknown" }])).toBe("adds unknown time");
    expect(missingImpact(c(10), c(13), [{ acquireDays: "unknown" }])).toBe("adds up to 3 working days + unknown");
    expect(missingImpact(c(10), c(11), [{ acquireDays: [0, 1] }])).toBe("adds up to 1 working day");
    expect(missingImpact(c(10), c(10), [{ acquireDays: [0, 1] }])).toBe("doesn't extend the known timeline");
  });
});
