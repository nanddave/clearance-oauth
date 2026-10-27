/** "notion.so" / "https://www.notion.so/x?y" -> "notion"; "Google Calendar" -> "google-calendar". */
export function toSlug(query: string): string {
  let s = query.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  const host = s.split(/[/?#]/)[0];
  // shortcut: second-to-last label as the name, wrong for co.uk-style TLDs; upgrade with a public-suffix list.
  if (!/\s/.test(host) && host.includes(".")) s = host.split(".").slice(-2, -1)[0];
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}
