import type { Kit } from "@/lib/kits";
import type { Answer, NextAction, OwnState, RouteStatus, Who } from "@/lib/next";
import { KitList } from "./Kits";
import { Day1Chip } from "./PathList";

const WHO: Record<Who, { label: string; style: string }> = {
  do: { label: "Agent pre-filled · you confirm", style: "bg-emerald-50 text-emerald-900 ring-emerald-600/30" },
  draft: { label: "Agent prepared", style: "bg-sky-50 text-sky-900 ring-sky-600/30" },
  you: { label: "You take over", style: "bg-zinc-100 text-zinc-800 ring-zinc-400/40" },
};

export function NextActionCard({ action, kits, onDone, own }: { action: NextAction | null; kits: Kit[]; onDone: (() => void) | null; own?: RouteStatus<OwnState> }) {
  if (!action && own && own.state !== "reported_complete")
    return (
      <section aria-labelledby="next" className="mt-4 rounded-xl border border-zinc-300 bg-white p-5">
        <h2 id="next" className="text-lg font-semibold text-zinc-950">{own.label || "No steps in this plan"}</h2>
        <p className="mt-1 text-sm text-zinc-700">{own.reason}</p>
      </section>
    );
  if (!action)
    return (
      <section aria-labelledby="next" className="mt-4 rounded-xl border-2 border-emerald-700 bg-emerald-50 p-5">
        <h2 id="next" className="text-lg font-semibold text-emerald-950">
          Setup reported complete · connection unverified
        </h2>
        <p className="mt-1 text-sm text-emerald-900">You&apos;ve ticked every step in this plan; we haven&apos;t checked any of them. Run the Composio setup script once to confirm a real user can connect and a tool works.</p>
      </section>
    );
  const who = WHO[action.who];
  return (
    <section aria-labelledby="next" className="mt-4 rounded-xl border-2 border-zinc-900 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="next" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your next step
        </h2>
        <span data-who={action.who} className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${who.style}`}>
          {who.label}
        </span>
        {action.startDay1 && <Day1Chip />}
      </div>
      <p className="mt-2 text-lg font-semibold text-zinc-950">{action.title}</p>
      <p className="mt-1 max-w-3xl text-sm text-zinc-700">{action.step}</p>
      {action.wait && <p className="mt-2 text-sm text-zinc-700">Then the provider takes: {action.wait}.</p>}
      {action.whatToAsk && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Nobody publishes this. </span>
          {action.whatToAsk}
        </p>
      )}
      {kits.length > 0 && (
        <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-900">Show prepared setup and commands</summary>
          <KitList kits={kits} />
        </details>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {onDone && (
          <button type="button" onClick={onDone} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
            {action.kind === "gate" ? "Mark done" : "I have this"}
          </button>
        )}
        {action.then.length > 0 && <p className="text-xs text-zinc-500">After that: {action.then.join(" → ")}</p>}
      </div>
    </section>
  );
}

const ANSWER_STYLE = (a: string) =>
  a === "unknown" ? "text-zinc-500" : a === "no" ? "text-red-700" : "text-zinc-950";

export function AnswersTable({ answers }: { answers: Answer[] }) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-zinc-900">What this guide can and cannot confirm</summary>
      <dl className="mt-2 divide-y divide-zinc-100">
        {answers.map((a) => (
          <div key={a.id} data-answer={a.id} className="grid gap-1 py-2 sm:grid-cols-[1fr_auto]">
            <dt className="text-zinc-800">
              {a.question}
              <span className="block text-xs text-zinc-500">{a.detail}</span>
            </dt>
            <dd className={`font-semibold ${ANSWER_STYLE(a.answer)}`}>{a.answer}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
