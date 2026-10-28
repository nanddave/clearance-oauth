"use client";

import { useState } from "react";
import { githubAppUrl, slackManifestUrl, type Kit } from "@/lib/kits";
import { decodeError } from "@/lib/errors";
import { safeHref } from "@/lib/display";

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
  const [scopes, setScopes] = useState("chat:write");
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
      <label className="block text-zinc-800">
        Your app&apos;s name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My agent" className={input} />
      </label>
      <label className="mt-2 block text-zinc-800">
        Bot scopes your tools need (empty means chat:write)
        <input value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder="chat:write, channels:read" className={`${input} font-mono`} />
      </label>
      <a href={slackManifestUrl(name, scopes)} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-block ${primary}`}>
        Create the Slack app, pre-filled →
      </a>
      <p className="mt-2 text-xs text-zinc-600">Opens Slack with these scopes and the Composio redirect already set; you pick the workspace and click Create. Ask only for scopes you use: extra ones slow reviews.</p>
    </div>
  );
}

function GithubKit() {
  const [name, setName] = useState("");
  const [homepage, setHomepage] = useState("");
  const ok = name.trim() && safeHref(homepage);
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
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
      {ok ? (
        <a href={githubAppUrl(name, homepage)} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-block ${primary}`}>
          Create the GitHub App, pre-filled →
        </a>
      ) : (
        <p className="mt-2 text-xs text-zinc-600">Enter a name and an https homepage to get the pre-filled link.</p>
      )}
      <p className="mt-2 text-xs text-zinc-600">
        GitHub opens with the Composio callback and read-only metadata access; add the permissions your tools need there, then click Create. Nothing comes back to this site: tick the step done yourself once the app exists.
      </p>
    </div>
  );
}

export function KitList({ kits }: { kits: Kit[] }) {
  if (!kits.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {kits.map((k, i) =>
        k.kind === "slack-manifest" ? <SlackKit key={i} /> : k.kind === "github-prefill" ? <GithubKit key={i} /> : <CopyBlock key={i} {...k} />,
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
