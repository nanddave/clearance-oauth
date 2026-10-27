import type { Gate, Guide, Requirement } from "./schema";

export type Selection = { toggles: Record<string, string>; have: Set<string> };
export type Clock = { min: number; max: number; unknown: boolean };
export type Plan = {
  tier: "self-serve" | "review" | "gated" | "blocked";
  dev: Clock;
  ideal: Clock;
  yours: Clock;
  topBlocker: Gate | null;
  missing: Requirement[];
  order: { id: string; kind: "gate" | "requirement"; startDay1: boolean }[];
  gates: Gate[];
};

const DAY_HOURS = 6;
const LONG_LEAD_DAYS = 7;
const GATED_DAYS = 21;

type Node = { key: string; min: number; max: number; unknown: boolean; preds: string[] };

export function applies(guide: Guide, sel: Selection, w?: Record<string, string[]>): boolean {
  if (!w) return true;
  return Object.entries(w).every(([tid, opts]) => {
    const chosen = sel.toggles[tid] ?? guide.toggles.find((t) => t.id === tid)?.default;
    return chosen !== undefined && opts.includes(chosen);
  });
}

function node(key: string, effort: [number, number], wait: [number, number] | "unknown", preds: string[]): Node {
  const unknown = wait === "unknown";
  return {
    key,
    min: effort[0] / DAY_HOURS + (unknown ? 0 : wait[0]),
    max: effort[1] / DAY_HOURS + (unknown ? 0 : wait[1]),
    unknown,
    preds,
  };
}

// Longest path (min and max tracked separately); preds outside the set are skipped.
function clock(nodes: Node[]): Clock {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const done = new Map<string, { min: number; max: number }>();
  const visiting = new Set<string>();
  const finish = (k: string): { min: number; max: number } => {
    const hit = done.get(k);
    if (hit) return hit;
    if (visiting.has(k)) throw new Error(`Dependency cycle at ${k}`);
    visiting.add(k);
    const n = byKey.get(k)!;
    let min = 0, max = 0;
    for (const p of n.preds) {
      if (!byKey.has(p)) continue;
      const f = finish(p);
      min = Math.max(min, f.min);
      max = Math.max(max, f.max);
    }
    visiting.delete(k);
    const res = { min: min + n.min, max: max + n.max };
    done.set(k, res);
    return res;
  };
  let min = 0, max = 0;
  for (const n of nodes) {
    const f = finish(n.key);
    min = Math.max(min, f.min);
    max = Math.max(max, f.max);
  }
  // any unknown node sits on some path, so the whole clock is a lower bound
  return { min, max, unknown: nodes.some((n) => n.unknown) };
}

const KIND_RANK: Record<Gate["kind"], number> = { unavailable: 4, partner: 3, legal: 2, review: 1, setup: 0, commercial: 0 };

export function computePlan(guide: Guide, sel: Selection): Plan {
  const gates = guide.gates.filter((x) => applies(guide, sel, x.appliesWhen));
  const reqs = new Map(guide.requirements.filter((x) => applies(guide, sel, x.appliesWhen)).map((x) => [x.id, x]));
  const gateIds = new Set(gates.map((x) => x.id));

  // missing = applicable, not in place, reached from an applicable gate (a requirement in place stops the walk)
  const missingIds = new Set<string>();
  const walk = (id: string) => {
    const q = reqs.get(id);
    if (!q || sel.have.has(id) || missingIds.has(id)) return;
    missingIds.add(id);
    q.dependsOn.forEach(walk);
  };
  gates.forEach((x) => x.requires.forEach(walk));

  const gateNode = (x: Gate, withReqs: boolean) =>
    node(
      "g:" + x.id,
      x.effortHours,
      x.waitDays,
      [
        ...x.dependsOn.filter((d) => gateIds.has(d)).map((d) => "g:" + d),
        ...(withReqs ? x.requires.filter((d) => missingIds.has(d)).map((d) => "r:" + d) : []),
      ],
    );
  const reqNode = (q: Requirement) =>
    node("r:" + q.id, q.acquireEffortHours, q.acquireDays, q.dependsOn.filter((d) => missingIds.has(d)).map((d) => "r:" + d));
  const missingList = [...missingIds].map((id) => reqs.get(id)!);

  const devGates = gates.filter((x) => x.phase === "dev");
  const devReqIds = new Set<string>();
  const walkDev = (id: string) => {
    if (!missingIds.has(id) || devReqIds.has(id)) return;
    devReqIds.add(id);
    reqs.get(id)!.dependsOn.forEach(walkDev);
  };
  devGates.forEach((x) => x.requires.forEach(walkDev));

  const yoursNodes = [...gates.map((x) => gateNode(x, true)), ...missingList.map(reqNode)];
  const yours = clock(yoursNodes); // also detects cycles across every applicable node
  const ideal = clock(gates.map((x) => gateNode(x, false)));
  const devSet = new Set(devGates.map((x) => x.id));
  const dev = clock([
    ...devGates.map((x) => ({ ...gateNode(x, true), preds: gateNode(x, true).preds.filter((p) => p.startsWith("r:") || devSet.has(p.slice(2))) })),
    ...[...devReqIds].map((id) => reqNode(reqs.get(id)!)),
  ]);

  const tier: Plan["tier"] = gates.some((x) => x.kind === "unavailable")
    ? "blocked"
    : gates.some((x) => x.kind === "partner") || ideal.max > GATED_DAYS
      ? "gated"
      : gates.some((x) => x.kind === "review")
        ? "review"
        : "self-serve";

  // #1 blocker: a known max wait > 7 days beats unknown waits (largest known wins); else unknown = largest. Ties by kind rank.
  const knownLong = gates.filter((x) => x.waitDays !== "unknown" && x.waitDays[1] > LONG_LEAD_DAYS);
  const waitOf = (x: Gate) => (x.waitDays === "unknown" ? Infinity : x.waitDays[1]);
  const waiting = knownLong.length ? knownLong : gates.filter((x) => waitOf(x) > 0);
  const topBlocker = waiting.reduce<Gate | null>(
    (best, x) => (!best || waitOf(x) > waitOf(best) || (waitOf(x) === waitOf(best) && KIND_RANK[x.kind] > KIND_RANK[best.kind]) ? x : best),
    null,
  );

  // Kahn's algorithm; among ready nodes long-lead requirements go first, then declaration order
  const longLead = new Set(missingList.filter((q) => q.acquireDays === "unknown" || q.acquireDays[1] > LONG_LEAD_DAYS).map((q) => "r:" + q.id));
  const remaining = new Map(yoursNodes.map((n) => [n.key, new Set(n.preds)]));
  const order: Plan["order"] = [];
  while (remaining.size) {
    const ready = [...remaining].filter(([, ps]) => ps.size === 0).map(([k]) => k);
    const next = ready.find((k) => longLead.has(k)) ?? ready[0];
    order.push({ id: next.slice(2), kind: next[0] === "g" ? "gate" : "requirement", startDay1: longLead.has(next) });
    remaining.delete(next);
    remaining.forEach((ps) => ps.delete(next));
  }

  return { tier, dev, ideal, yours, topBlocker, missing: missingList, order, gates };
}

export function formatClock(c: Clock): string {
  const lo = Math.floor(c.min + 1e-9);
  const hi = Math.ceil(c.max - 1e-9);
  if (c.unknown) return `≥ ${lo} days + unknown`;
  if (c.max < 1) return "same day";
  return lo === hi ? `${hi} ${hi === 1 ? "day" : "days"}` : `${lo}–${hi} days`;
}
