import type { Guide } from "./schema";
import type { Selection } from "./engine";

export function parseSelection(guide: Guide, params: URLSearchParams): Selection {
  const toggles: Record<string, string> = {};
  for (const t of guide.toggles) {
    const v = params.get(`t.${t.id}`);
    toggles[t.id] = v !== null && t.options.some((o) => o.id === v) ? v : t.default;
  }
  const known = new Set(guide.requirements.map((r) => r.id));
  const have = new Set((params.get("have") ?? "").split(",").filter((id) => known.has(id)));
  const gates = new Set(guide.gates.map((g) => g.id));
  const done = new Set((params.get("done") ?? "").split(",").filter((id) => gates.has(id)));
  // a lane choice exists only when Composio manages this app's OAuth; otherwise there is just your own app
  const lane = guide.composio.managed !== true ? undefined : params.get("lane") === "own" ? "own" : "managed";
  return { toggles, have, done, lane };
}

export function toSearchParams(sel: Selection): string {
  const parts = Object.entries(sel.toggles).map(([k, v]) => `t.${k}=${v}`);
  if (sel.have.size) parts.push(`have=${[...sel.have].join(",")}`);
  if (sel.done?.size) parts.push(`done=${[...sel.done].join(",")}`);
  if (sel.lane === "own") parts.push("lane=own");
  return parts.length ? `?${parts.join("&")}` : "";
}
