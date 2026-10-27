"use client";

import { useState } from "react";
import { githubManifest, slackManifestUrl, type Kit } from "@/lib/kits";
import { decodeError } from "@/lib/errors";

function CopyBlock({ label, text, note }: { label: string; text: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)), () => {})}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50"
        >
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-zinc-800">{text}</pre>
      {note && <p className="mt-2 text-xs text-zinc-600">{note}</p>}
    </div>
  );
}

const input = "mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900";
const primary = "rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800";

function SlackKit() {
  const [name, setName] = useState("");
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
      <label className="block text-zinc-800">
        Your app&apos;s name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My agent" className={input} />
      </label>
      <a href={slackManifestUrl(name)} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-block ${primary}`}>
        Create the Slack app, pre-filled →
      </a>
      <p className="mt-2 text-xs text-zinc-600">Opens Slack with the bot scopes and Composio redirect already set. Pick your workspace and click Create.</p>
    </div>
  );
}

function GithubKit() {
  const [name, setName] = useState("");
  const [homepage, setHomepage] = useState("");
  return (
    <form
      action="https://github.com/settings/apps/new"
      method="post"
      target="_blank"
      // built at submit time: the return URL needs this site's origin, which the server render doesn't know
      onSubmit={(e) => ((e.currentTarget.elements.namedItem("manifest") as HTMLInputElement).value = githubManifest(name, homepage, `${location.origin}/g/github?done=create_app`))}
      className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-zinc-800">
          App name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme inbox agent" className={input} />
        </label>
        <label className="block text-zinc-800">
          Homepage
          <input type="url" required value={homepage} onChange={(e) => setHomepage(e.target.value)} placeholder="https://yourapp.com" className={input} />
        </label>
      </div>
      <input type="hidden" name="manifest" defaultValue="" />
      <button type="submit" className={`mt-2 ${primary}`}>
        Create the GitHub App, pre-filled →
      </button>
      <p className="mt-2 text-xs text-zinc-600">
        GitHub shows the app with the Composio callback and minimal permissions; click Create. It sends you back here with this step marked done. We never receive your keys.
      </p>
    </form>
  );
}

export function KitList({ kits }: { kits: Kit[] }) {
  if (!kits.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {kits.map((k, i) =>
        k.kind === "slack-manifest" ? <SlackKit key={i} /> : k.kind === "github-manifest" ? <GithubKit key={i} /> : <CopyBlock key={i} {...k} />,
      )}
    </div>
  );
}

export function ErrorDecoder({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const hits = text.trim() ? decodeError(text, slug) : null;
  return (
    <div>
      <label className="block text-sm text-zinc-700">
        Paste the error you got while connecting
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Error 400: redirect_uri_mismatch" className={`${input} font-mono`} />
      </label>
      {hits && (
        <div aria-live="polite" className="mt-2 space-y-2 text-sm">
          {hits.length ? (
            hits.map((h) => (
              <div key={h.id} className="rounded-md border border-zinc-200 bg-white p-3">
                <p className="text-zinc-900">
                  <span className="font-semibold">What it means: </span>
                  {h.meaning}
                </p>
                <p className="mt-1 text-zinc-800">
                  <span className="font-semibold">Fix: </span>
                  {h.fix}
                </p>
              </div>
            ))
          ) : (
            <p className="text-zinc-600">
              Not a pattern we know. Check these first: the redirect URI matches exactly, the client ID and secret in Composio match the app, and the scopes you request are enabled in the app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
