"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toSlug } from "@/agents/slug";

export function SearchBox({ library }: { library: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const slug = toSlug(q);
    if (!slug) return setErr("Type an app name or its website.");
    setErr("");
    if (library.some((g) => g.slug === slug)) return router.push(`/g/${slug}`);
    setBusy(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) });
      const data = await res.json();
      if (!res.ok || !data.slug) throw new Error(data.error ?? "failed");
      router.push(`/g/${data.slug}`);
    } catch {
      setErr("Could not start generation. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6" aria-busy={busy}>
      <label htmlFor="app-q" className="block text-sm font-medium text-zinc-800">Which app do you want to connect?</label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id="app-q" list="app-suggestions" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Gmail, Slack, docusign.com…" autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950"
        />
        <datalist id="app-suggestions">{library.map((g) => <option key={g.slug} value={g.name} />)}</datalist>
        <button disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Starting…" : "Look up"}
        </button>
      </div>
      <p role="status" className="mt-1 min-h-5 text-sm text-red-700">{err}</p>
      <p className="text-xs text-zinc-600">Apps not in the library are researched by agents on demand; you will see the live log.</p>
    </form>
  );
}
