import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { TIER_STYLE } from "@/components/VerdictCard";
import { ROSTER, GENERATION_AGENTS } from "@/agents/roster";
import { TIER_LABEL, clockLabel } from "@/lib/display";
import { computePlan } from "@/lib/engine";
import { listGuides } from "@/lib/guides";
import { parseSelection } from "@/lib/selection";

export default function Home() {
  const guides = listGuides().map((g) => ({ g, plan: computePlan(g, parseSelection(g, new URLSearchParams())) }));
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">How long until real users can connect your agent to an app?</h1>
      <p className="mt-2 max-w-2xl text-zinc-700">
        OAuth app setup takes minutes; provider approval can take months. Look up an app, check what you are missing, and get a plan you can share.
      </p>
      <SearchBox library={guides.map(({ g }) => ({ slug: g.slug, name: g.name }))} />

      <section aria-labelledby="lib" className="mt-8">
        <h2 id="lib" className="text-lg font-semibold text-zinc-950">Library</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {guides.map(({ g, plan }) => (
            <li key={g.slug} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/g/${g.slug}`} className="text-lg font-semibold text-zinc-950 underline-offset-2 hover:underline">{g.name}</Link>
                <span data-tier={plan.tier} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLE[plan.tier]}`}>{TIER_LABEL[plan.tier]}</span>
                <span className="text-xs text-zinc-600">{g.composio.managed === true ? "Composio-managed" : "Bring your own app"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-zinc-600">Dev</dt><dd className="font-semibold tabular-nums">{clockLabel(plan.dev)}</dd></div>
                <div><dt className="text-xs text-zinc-600">Production (if you had everything)</dt><dd className="font-semibold tabular-nums">{clockLabel(plan.ideal)}</dd></div>
              </dl>
              <p className="mt-2 text-sm text-zinc-700"><span className="font-medium">#1 blocker: </span>{plan.topBlocker?.title ?? "none in your path"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="agents" className="mt-8">
        <h2 id="agents" className="text-lg font-semibold text-zinc-950">How the agents work</h2>
        <p className="mt-1 text-sm text-zinc-700">Only the Synthesizer makes the hard judgment; code does everything it can.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead><tr className="border-b border-zinc-300 text-zinc-700">
              <th scope="col" className="py-2 pr-3 font-medium">Agent</th><th scope="col" className="py-2 pr-3 font-medium">Runs on</th>
              <th scope="col" className="py-2 pr-3 font-medium">Tools</th><th scope="col" className="py-2 font-medium">Why</th>
            </tr></thead>
            <tbody>
              {[...GENERATION_AGENTS, "readiness" as const].map((id) => {
                const a = ROSTER[id];
                return (
                  <tr key={id} className="border-b border-zinc-200 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium text-zinc-900">{a.label}</th>
                    <td className="py-2 pr-3 font-mono text-xs">{a.model}</td>
                    <td className="py-2 pr-3">{a.tools.join(", ") || "none"}</td>
                    <td className="py-2 text-zinc-700">{a.why}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 flex gap-4 border-t border-zinc-200 pt-4 text-sm">
        <Link href="/corrections" className="underline underline-offset-2">Corrections</Link>
        {/* TODO: replace with the real GitHub repo URL */}
        <a href="#" className="underline underline-offset-2">GitHub</a>
      </footer>
    </main>
  );
}
