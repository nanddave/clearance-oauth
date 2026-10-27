import type { Clock } from "./engine";
import { formatClock } from "./engine";
import type { EvidenceStatus, Guide } from "./schema";

/** formatClock, with waits named "working days" and a zero lower bound shown as plain "unknown". */
export function clockLabel(c: Clock): string {
  const s = formatClock(c);
  if (s.startsWith("≥ 0 days")) return "unknown";
  return s === "same day" ? s : s.replace(/^≥ 1 days/, "≥ 1 day").replace(/\b(days?)\b/, "working $1");
}

export function waitLabel(w: [number, number] | "unknown"): string {
  if (w === "unknown") return "unknown";
  if (w[1] === 0) return "none";
  const unit = w[0] === 1 && w[1] === 1 ? "working day" : "working days";
  return w[0] === w[1] ? `${w[1]} ${unit}` : `${w[0]}–${w[1]} ${unit}`;
}

export const hoursLabel = ([a, b]: [number, number]) => (a === b ? `${a} h` : `${a}–${b} h`);

const STRENGTH: EvidenceStatus[] = ["conflicting", "unknown", "reported", "official", "tested"];

/** The weakest status among the cited claims (conservative), or null when nothing is cited. */
export function weakestStatus(guide: Guide, claimIds: string[]): EvidenceStatus | null {
  const found = guide.claims.filter((c) => claimIds.includes(c.id)).map((c) => c.status);
  if (!found.length) return null;
  return found.reduce((a, b) => (STRENGTH.indexOf(b) < STRENGTH.indexOf(a) ? b : a));
}

export const isStub = (guide: Guide) => guide.claims.some((c) => c.text.startsWith("Stub:"));

/** Only https links are rendered; generated guides are LLM output. */
export const safeHref = (url: string | undefined) => (url && url.startsWith("https://") ? url : undefined);

export const TIER_LABEL = { "self-serve": "Self-serve", review: "Review", gated: "Gated", blocked: "Blocked" } as const;

/** Extra working days your missing requirements add to the known part of the clock (max vs max). */
export const planDelta = (ideal: Clock, yours: Clock) => Math.max(0, Math.ceil(yours.max - ideal.max - 1e-9));

/** How the missing requirements change the timeline; unknown acquire times are never shown as zero. */
export function missingImpact(ideal: Clock, yours: Clock, missing: { acquireDays: [number, number] | "unknown" }[]): string {
  const d = planDelta(ideal, yours);
  const unk = missing.some((r) => r.acquireDays === "unknown");
  if (d > 0) return `adds up to ${d} working ${d === 1 ? "day" : "days"}${unk ? " + unknown" : ""}`;
  return unk ? "adds unknown time" : "doesn't extend the known timeline";
}
