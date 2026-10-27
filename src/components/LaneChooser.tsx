import type { Plan } from "@/lib/engine";
import type { Guide } from "@/lib/schema";
import { TIER_LABEL, clockLabel, safeHref, waitLabel } from "@/lib/display";
import { TIER_STYLE } from "./VerdictCard";

type Lane = "managed" | "own";

function Card({ selected, onSelect, disabled, title, children }: { selected: boolean; onSelect: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex flex-col items-start rounded-xl border p-4 text-left text-sm ${
        selected ? "border-2 border-zinc-900 bg-white" : "border-zinc-200 bg-white hover:border-zinc-400"
      } disabled:cursor-default disabled:bg-zinc-50 disabled:hover:border-zinc-200`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</span>
      {children}
    </button>
  );
}

/** The first decision: Composio's managed app (live today) or your own OAuth app (the provider's approval path). */
export function LaneChooser({ guide, plan, lane, note, placeholder, onChange }: { guide: Guide; plan: Plan; lane: Lane; note: string | null; placeholder: boolean; onChange: (l: Lane) => void }) {
  const m = guide.composio.managed;
  const b = plan.topBlocker;
  const guideUrl = safeHref(guide.composio.guideUrl);
  return (
    <section aria-label="Choose how to connect" className="mt-4 grid gap-3 sm:grid-cols-2">
      <Card title="Composio's app" selected={lane === "managed"} disabled={m !== true} onSelect={() => onChange("managed")}>
        <span className={`mt-1 text-base font-semibold ${m === true ? "text-emerald-800" : "text-zinc-600"}`}>
          {m === true ? "Available now" : m === false ? "Not available" : "Not confirmed"}
        </span>
        <span className="mt-1 text-zinc-700">
          {m === true && "Per Composio's managed-auth list. "}
          {note ?? (m === true ? "Composio already has an approved app; users see Composio's name." : m === false ? `Composio doesn't hold an OAuth app for ${guide.name}; you need your own.` : "We couldn't confirm Composio coverage for this app.")}
        </span>
      </Card>
      <Card title="Your own app" selected={lane === "own"} onSelect={() => onChange("own")}>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${placeholder ? "bg-zinc-200 text-zinc-600" : TIER_STYLE[plan.tier]}`}>{TIER_LABEL[plan.tier]}</span>
          <span className="text-base font-semibold text-zinc-950">{clockLabel(plan.yours)}</span>
        </span>
        <span className="mt-1 text-zinc-700">
          {b ? `Slowest step: ${b.title} (${waitLabel(b.waitDays)}).` : "No provider review in your path."}
          {plan.unknownWaits.length > 0 && ` Unknown: ${plan.unknownWaits.map((g) => g.title).join(", ")}.`} Your name on the consent screen.
        </span>
        {guideUrl && <span className="mt-1 text-xs text-zinc-500">Composio has a setup guide; it stops at a working test connection.</span>}
      </Card>
    </section>
  );
}
