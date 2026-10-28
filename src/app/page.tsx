import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { ROSTER, GENERATION_AGENTS } from "@/agents/roster";
import { computePlan } from "@/lib/engine";
import { listGuides } from "@/lib/guides";
import { routeStatus } from "@/lib/next";
import { parseSelection } from "@/lib/selection";

// shortcut: hand-picked from the live research runs (docs/live-research.md); list stored jobs instead once there are more than a handful
const RESEARCHED = [["notion", "Notion"], ["calendly", "Calendly"], ["hubspot", "HubSpot"]] as const;

export default function Home() {
  const guides = listGuides().map((guide) => {
    const selection = parseSelection(guide, new URLSearchParams());
    return { guide, routes: routeStatus(guide, selection, computePlan(guide, selection)) };
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">OAuth launch navigator</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">Know what blocks your OAuth launch.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700">See what you can test today, what must wait, and what to do next.</p>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <SearchBox library={guides.map(({ guide }) => ({ slug: guide.slug, name: guide.name }))} />
        <ol className="mt-6 grid gap-3 border-t border-zinc-100 pt-5 text-sm sm:grid-cols-3">
          <li><span className="mr-2 font-semibold text-emerald-800">01</span> Choose an app and use case</li>
          <li><span className="mr-2 font-semibold text-emerald-800">02</span> See the route and blocker</li>
          <li><span className="mr-2 font-semibold text-emerald-800">03</span> Take the next step</li>
        </ol>
      </div>

      <section aria-labelledby="lib" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="lib" className="text-xl font-semibold text-zinc-950">Start with a reviewed guide</h2>
            <p className="mt-1 text-sm text-zinc-600">These examples show different approval paths. Choose your exact use case inside each guide.</p>
          </div>
          <span className="text-xs text-zinc-500">{guides.length} reviewed apps</span>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {guides.map(({ guide, routes }) => (
            <li key={guide.slug}>
              <Link href={`/g/${guide.slug}`} className="group block h-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-950 group-hover:text-emerald-900">{guide.name}</h3>
                  <span aria-hidden="true" className="text-lg text-zinc-400 group-hover:text-emerald-800">↗</span>
                </div>
                <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 text-sm">
                  <p className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="text-zinc-600">Composio app</span><strong className="font-semibold text-zinc-950">{routes.managed.label}</strong></p>
                  <p className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="text-zinc-600">Your own app</span><strong className="font-semibold text-zinc-950">{routes.own.label}</strong></p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">Shown for each guide&apos;s default use case. Your actions and audience can change the result.</p>
      </section>

      <section aria-labelledby="researched" className="mt-8">
        <h2 id="researched" className="text-lg font-semibold text-zinc-950">Researched live by the agents</h2>
        <p className="mt-1 text-sm text-zinc-600">Not in the library: agents researched these on request (one to two minutes and under $1 each). Labelled agent-generated, with every source.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {RESEARCHED.map(([slug, name]) => (
            <li key={slug}><Link href={`/g/${slug}`} className="inline-block min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50">{name} →</Link></li>
          ))}
        </ul>
      </section>

      <details className="mt-12 rounded-xl border border-zinc-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-semibold text-zinc-900">How Clearance researches an unfamiliar app</summary>
        <p className="mt-3 text-zinc-700">Agents read provider documentation, build a plan, and attach sources. Code checks the guide structure and captured quotes. Generated guides are labelled and may still need a real connection test.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {[...GENERATION_AGENTS, "readiness" as const].map((id) => {
            const agent = ROSTER[id];
            return <li key={id} className="rounded-lg bg-zinc-50 p-3"><strong className="text-zinc-900">{agent.label}</strong><span className="ml-2 text-xs text-zinc-500">{agent.model}</span><p className="mt-1 text-zinc-600">{agent.why}</p></li>;
          })}
        </ol>
      </details>
    </main>
  );
}
