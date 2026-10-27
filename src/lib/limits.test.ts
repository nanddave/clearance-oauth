import { describe, expect, it } from "vitest";
import { kvGet, kvSet } from "./kv";
import { addSpend, rateLimit, spentToday } from "./limits";

describe("kv (memory backend)", () => {
  it("round-trips JSON and expires", async () => {
    await kvSet("t:a", { x: 1 }, 60);
    expect(await kvGet("t:a")).toEqual({ x: 1 });
    await kvSet("t:b", 1, -1);
    expect(await kvGet("t:b")).toBeUndefined();
  });
});

describe("limits", () => {
  it("allows max calls per window, then blocks", async () => {
    const ip = `ip-${Math.random()}`;
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await rateLimit("t", ip, 3, 3600));
    expect(r).toEqual([true, true, true, false]);
  });

  it("adds spend", async () => {
    const before = await spentToday();
    await addSpend(0.25);
    expect(await spentToday()).toBeCloseTo(before + 0.25);
  });
});
