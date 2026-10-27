import { corrections } from "@/lib/corrections";

export const metadata = { title: "Corrections · Clearance" };

export default function Corrections() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Corrections</h1>
      <p className="mt-2 max-w-2xl text-zinc-700">Claims about OAuth app approval that are still widely repeated but are out of date or disputed, with what we found instead.</p>
      <ul className="mt-6 space-y-4">
        {corrections.entries.map((e) => (
          <li key={e.app + e.oldClaim} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-950">{e.app}</h2>
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-800">{e.status}</span>
              {e.changedOn && <span className="text-xs text-zinc-600">{e.changedOn}</span>}
            </div>
            <dl className="mt-2 space-y-2 text-sm">
              <div><dt className="font-medium text-zinc-900">What is often still said</dt><dd className="text-zinc-700">{e.oldClaim}</dd></div>
              <div><dt className="font-medium text-zinc-900">What is true now</dt><dd className="text-zinc-700">{e.currentFact}</dd></div>
              <div><dt className="font-medium text-zinc-900">Sources</dt>
                <dd><ul className="break-all">{e.sources.map((s) => <li key={s}><a href={s} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{s}</a></li>)}
                  {!e.sources.length && <li className="text-zinc-600">none captured</li>}</ul></dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-semibold text-zinc-950">What we could not verify</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">{corrections.unverified.map((u) => <li key={u}>{u}</li>)}</ul>
    </main>
  );
}
