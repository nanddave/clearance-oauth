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
  return { toggles, have };
}

export function toSearchParams(sel: Selection): string {
  const parts = Object.entries(sel.toggles).map(([k, v]) => `t.${k}=${v}`);
  if (sel.have.size) parts.push(`have=${[...sel.have].join(",")}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
