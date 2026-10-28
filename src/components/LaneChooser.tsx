import type { Guide } from "@/lib/schema";
import type { routeStatus } from "@/lib/next";

type Lane = "managed" | "own";
type Routes = ReturnType<typeof routeStatus>;

function RouteCard({ selected, onSelect, disabled, title, status, tone }: { selected: boolean; onSelect: () => void; disabled?: boolean; title: string; status: string; tone: "green" | "amber" | "muted" }) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect}
      className={`min-h-18 rounded-xl border p-3 text-left transition-colors ${selected ? "border-2 border-zinc-900 bg-white shadow-sm" : "border-zinc-200 bg-white hover:border-zinc-400"} disabled:cursor-default disabled:bg-zinc-50`}>
      <span className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {title}<span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-zinc-400"}`} />
      </span>
      <span className="mt-1 block text-sm font-semibold leading-5 text-zinc-950">{status}</span>
    </button>
  );
}

export function LaneChooser({ guide, routes, lane, onChange }: { guide: Guide; routes: Routes; lane: Lane; onChange: (lane: Lane) => void }) {
  const managed = routes.managed.state;
  return (
    <section aria-labelledby="routes-title" className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="routes-title" className="text-base font-semibold text-zinc-950">Choose a connection route</h2>
        <p className="text-xs text-zinc-500">Compare the two paths</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <RouteCard title="Composio's app" selected={lane === "managed"} disabled={guide.composio.managed !== true} onSelect={() => onChange("managed")}
          status={routes.managed.label}
          tone={managed === "can_test" ? "green" : managed === "scope_unconfirmed" ? "amber" : "muted"} />
        <RouteCard title="Your own app" selected={lane === "own"} onSelect={() => onChange("own")}
          status={routes.own.label}
          tone={routes.own.state === "reported_complete" || routes.own.state === "in_progress" ? "amber" : "muted"} />
      </div>
    </section>
  );
}
