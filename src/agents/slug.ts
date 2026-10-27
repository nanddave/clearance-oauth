/** "notion.so" / "https://www.notion.so/x?y" -> "notion"; "Google Calendar" -> "google-calendar". */
export function toSlug(query: string): string {
  let s = query.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  const host = s.split(/[/?#]/)[0];
  // the registrable name: "acme" from docs.acme.com and from acme.co.uk (shortcut: common two-label suffixes only)
  if (!/\s/.test(host) && host.includes(".")) s = host.split(".").slice(/\.(co|com|net|org|gov|ac|edu)\.[a-z]{2}$/.test(host) ? -3 : -2)[0];
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}
