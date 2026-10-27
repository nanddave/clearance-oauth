import { computePlan, type Selection } from "./engine";
import type { Guide } from "./schema";

/** Every toggle combination of a guide (small: a few toggles with 2–3 options each). */
export function selections(guide: Guide): Selection[] {
  let combos: Record<string, string>[] = [{}];
  for (const t of guide.toggles) combos = combos.flatMap((c) => t.options.map((o) => ({ ...c, [t.id]: o.id })));
  return combos.map((toggles) => ({ toggles, have: new Set<string>() }));
}

/**
 * Problems that make a guide unusable even though its JSON shape is valid: broken references,
 * dependency cycles, and any combination whose fastest order puts a step before something it needs.
 */
export function validateGuide(guide: Guide): string[] {
  const errors: string[] = [];
  const gates = new Set(guide.gates.map((g) => g.id));
  const reqs = new Set(guide.requirements.map((r) => r.id));
  const claims = new Set(guide.claims.map((c) => c.id));
  const toggles = new Map(guide.toggles.map((t) => [t.id, new Set(t.options.map((o) => o.id))]));
  const ref = (ok: boolean, what: string) => ok || errors.push(what);

  if (new Set(guide.gates.map((g) => g.id)).size !== guide.gates.length) errors.push("duplicate gate ids");
  for (const t of guide.toggles) ref(toggles.get(t.id)!.has(t.default), `toggle ${t.id}: default ${t.default} is not an option`);
  const checkWhen = (owner: string, w?: Record<string, string[]>) =>
    Object.entries(w ?? {}).forEach(([tid, opts]) => opts.forEach((o) => ref(!!toggles.get(tid)?.has(o), `${owner}: appliesWhen ${tid}=${o} unknown`)));
  for (const g of guide.gates) {
    checkWhen(`gate ${g.id}`, g.appliesWhen);
    g.dependsOn.forEach((d) => ref(gates.has(d), `gate ${g.id}: dependsOn ${d} missing`));
    g.requires.forEach((d) => ref(reqs.has(d), `gate ${g.id}: requires ${d} missing`));
    g.claimIds.forEach((d) => ref(claims.has(d), `gate ${g.id}: claim ${d} missing`));
  }
  for (const r of guide.requirements) {
    checkWhen(`requirement ${r.id}`, r.appliesWhen);
    r.dependsOn.forEach((d) => ref(reqs.has(d), `requirement ${r.id}: dependsOn ${d} missing`));
    (r.afterGates ?? []).forEach((d) => ref(gates.has(d), `requirement ${r.id}: afterGates ${d} missing`));
    r.claimIds.forEach((d) => ref(claims.has(d), `requirement ${r.id}: claim ${d} missing`));
  }
  if (errors.length) return errors;

  for (const sel of selections(guide)) {
    const label = JSON.stringify(sel.toggles);
    let plan;
    try {
      plan = computePlan(guide, sel);
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : "plan failed"}`);
      continue;
    }
    const pos = new Map(plan.order.map((o, i) => [`${o.kind[0]}:${o.id}`, i]));
    const before = (a: string, b: string) => !pos.has(a) || !pos.has(b) || pos.get(a)! < pos.get(b)!;
    for (const g of plan.gates) {
      for (const d of g.dependsOn) if (!before(`g:${d}`, `g:${g.id}`)) errors.push(`${label}: ${g.id} is ordered before ${d}`);
      for (const d of g.requires) if (!before(`r:${d}`, `g:${g.id}`)) errors.push(`${label}: ${g.id} is ordered before ${d}`);
    }
    for (const r of plan.missing) {
      for (const d of r.dependsOn) if (!before(`r:${d}`, `r:${r.id}`)) errors.push(`${label}: ${r.id} is ordered before ${d}`);
      for (const d of r.afterGates ?? []) if (!before(`g:${d}`, `r:${r.id}`)) errors.push(`${label}: ${r.id} is ordered before ${d}`);
    }
  }
  return errors;
}
