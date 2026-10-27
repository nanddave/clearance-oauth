import type { Plan } from "@/lib/engine";
import type { Guide } from "@/lib/schema";
import { TIER_LABEL, clockLabel, missingImpact, planDelta, waitLabel, weakestStatus } from "@/lib/display";
import { NumberSource } from "./EvidenceBadge";

export const TIER_STYLE: Record<Plan["tier"], string> = {
  "self-serve": "bg-emerald-700 text-white",
  review: "bg-amber-400 text-amber-950",
  gated: "bg-orange-700 text-white",
  blocked: "bg-red-700 text-white",
};

const TIER_HINT: Record<Plan["tier"], string> = {
  "self-serve": "No provider review in your path.",
  review: "The provider reviews your app before production.",
  gated: "Partner programme or a wait longer than 21 working days.",
  blocked: "Not available for your use case.",
};

function Num({ label, value, id, hint }: { label: string; value: string; id: string; hint: React.ReactNode }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3">
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd data-clock={id} className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-950">
        {value}
      </dd>
      <div className="text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

function YoursHint({ guide, plan }: { guide: Guide; plan: Plan }) {
  const n = plan.missing.length;
  if (!n) return <>you have everything listed</>;
  const d = planDelta(plan.ideal, plan.yours);
  const cited = plan.missing.every((r) => r.claimIds.length > 0);
  return (
    <span data-missing={n} data-delta={d}>
      {n} missing · {missingImpact(plan.ideal, plan.yours, plan.missing)}{" "}
      {d > 0 && <NumberSource status={cited ? weakestStatus(guide, plan.missing.flatMap((r) => r.claimIds)) : null} />}
    </span>
  );
}

export function VerdictCard({ guide, plan, placeholder }: { guide: Guide; plan: Plan; placeholder: boolean }) {
  const b = plan.topBlocker;
  return (
    <section aria-labelledby="verdict" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="verdict" className="text-lg font-semibold tracking-tight text-zinc-950">
          Your own {guide.name} app
        </h2>
        <span
          data-tier={plan.tier}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${placeholder ? "bg-zinc-200 text-zinc-600" : TIER_STYLE[plan.tier]}`}
        >
          {TIER_LABEL[plan.tier]}
          {placeholder && " · placeholder"}
        </span>
        {!placeholder && <span className="text-sm text-zinc-600">{TIER_HINT[plan.tier]}</span>}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Num id="dev" label="Dev access" value={clockLabel(plan.dev)} hint="until you can build and test" />
        <Num id="ideal" label="If you had everything" value={clockLabel(plan.ideal)} hint="provider steps only" />
        <Num id="yours" label="Your plan" value={clockLabel(plan.yours)} hint={<YoursHint guide={guide} plan={plan} />} />
      </dl>
      <p className="mt-2 text-xs text-zinc-500">
        Computed from the steps below: provider waits carry their evidence badge; effort hours are our estimate.
      </p>

      <div className="mt-4 space-y-2 text-sm text-zinc-800">
        <p>
          <span className="font-medium">#1 blocker: </span>
          {b ? (
            <>
              {b.title} — wait {waitLabel(b.waitDays)} {b.waitDays !== "unknown" && b.waitDays[1] > 0 && <NumberSource status={weakestStatus(guide, b.claimIds)} />}
            </>
          ) : (
            "nothing — no provider wait in your path"
          )}
        </p>
        {plan.unknownWaits.length > 0 && (
          <p>
            <span className="font-medium">Also unknown: </span>
            {plan.unknownWaits.map((g) => g.title).join(", ")}. Nobody publishes how long; see what to ask below.
          </p>
        )}

      </div>
    </section>
  );
}
