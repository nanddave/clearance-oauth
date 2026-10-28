import { computePlan, type Selection } from "./engine";
import type { Guide } from "./schema";

/** Every toggle combination of a guide (small: a few toggles with 2–3 options each). */
export function selections(guide: Guide): Selection[] {
  let combos: Record<string, string>[] = [{}];
  for (const t of guide.toggles) combos = combos.flatMap((c) => t.options.map((o) => ({ ...c, [t.id]: o.id })));
  return combos.map((toggles) => ({ toggles, have: new Set<string>() }));
}

/**
 * Problems that make a guide unusable even though its JSON shape is valid: broken references and
 * dependency cycles in any toggle combination. Whether the dependencies themselves are right (installs need
 * the app first) is a data question the reviewed guides answer by hand, with afterGates.
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
  // an "optional" step that always applies would block every developer on something they may not need
  const always = (w?: Record<string, string[]>) => !w || !Object.keys(w).length;
  const optional = (owner: string, name: string, w?: Record<string, string[]>) =>
    ref(!(always(w) && /\boptional\b/i.test(name)), `${owner}: "${name}" is optional but always applies; move it behind a toggle whose default option skips it`);
  for (const g of guide.gates) optional(`gate ${g.id}`, g.title, g.appliesWhen);
  for (const r of guide.requirements) optional(`requirement ${r.id}`, r.label, r.appliesWhen);
  // a provider review sets the tier, so it needs a cited claim that a review exists (Calendly got one from a guess)
  const REVIEW = /\b(review|approv|certif|verif|audit|assessment|vet)/i;
  for (const g of guide.gates.filter((g) => g.kind === "review"))
    ref(
      guide.claims.some((c) => g.claimIds.includes(c.id) && REVIEW.test(c.text) && !/^unknown/i.test(c.text)),
      `gate ${g.id}: a review step needs a cited claim that the provider reviews apps; if no source says so, drop the gate and put the question in a requirement's whatToAsk`,
    );
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
    try {
      computePlan(guide, sel); // throws on a dependency cycle
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : "plan failed"}`);
    }
  }
  return errors;
}
