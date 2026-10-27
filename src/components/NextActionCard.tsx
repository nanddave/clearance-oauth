import type { Answer, NextAction, Who } from "@/lib/next";
import { Day1Chip } from "./PathList";

const WHO: Record<Who, { label: string; style: string }> = {
  do: { label: "🤖 An agent can do this", style: "bg-emerald-50 text-emerald-900 ring-emerald-600/30" },
  draft: { label: "🪄 An agent can prepare this", style: "bg-sky-50 text-sky-900 ring-sky-600/30" },
  you: { label: "🙋 Only you can do this", style: "bg-zinc-100 text-zinc-800 ring-zinc-400/40" },
};

export function NextActionCard({ action }: { action: NextAction | null }) {
  if (!action) return null;
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
      {action.then.length > 0 && <p className="mt-3 text-xs text-zinc-500">After that: {action.then.join(" → ")}</p>}
    </section>
  );
}

const ANSWER_STYLE = (a: string) =>
  a === "unknown" ? "text-zinc-500" : a === "no" ? "text-red-700" : "text-zinc-950";

export function AnswersTable({ answers }: { answers: Answer[] }) {
  return (
    <details className="mt-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm">
      <summary className="cursor-pointer text-zinc-700">What this page can and can&apos;t tell you</summary>
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
