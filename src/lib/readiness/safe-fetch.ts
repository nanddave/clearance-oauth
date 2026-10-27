import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 1024 * 1024;

function v4Blocked(o: number[]): boolean {
  const [a, b] = o;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && o[2] === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function parseV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const dotted = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [, a, b, c, d] = dotted.map(Number);
    s = s.slice(0, dotted.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const g = [...head, ...Array(fill).fill("0"), ...tail].map((x) => parseInt(x, 16));
  return g.length === 8 && g.every((n) => n >= 0 && n <= 0xffff) ? g : null;
}

/** True for anything that is not a public unicast address. Unparseable input is blocked. */
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip.replace(/^\[|\]$/g, ""));
  const addr = ip.replace(/^\[|\]$/g, "");
  if (kind === 4) return v4Blocked(addr.split(".").map(Number));
  if (kind !== 6) return true;
  const g = parseV6(addr);
  if (!g) return true;
  const embedded = (hi: number, lo: number) => v4Blocked([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0 || g[5] === 0xffff)) return embedded(g[6], g[7]); // ::, ::1, ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return embedded(g[6], g[7]); // NAT64
  if (g[0] === 0x2002) return embedded(g[1], g[2]); // 6to4
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00;
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolve: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

/** Returns an error message if the URL must not be fetched, else null. */
export async function checkUrl(raw: string, resolve: Resolver = defaultResolve): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return "Not a valid URL"; }
  if (u.protocol !== "https:") return "Only https:// URLs are allowed";
  if (u.username || u.password) return "URLs with credentials are not allowed";
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return "That address is not allowed";
  let addrs: string[];
  if (isIP(host)) addrs = [host];
  else {
    try { addrs = await resolve(host); } catch { return "Host could not be resolved"; }
  }
  if (!addrs.length || addrs.some(isBlockedAddress)) return "That address is not allowed (private or internal)";
  return null;
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8");
}

// shortcut: DNS rebinding between our lookup and fetch's own re-resolve is not prevented;
// upgrade by connecting to the resolved IP via an undici dispatcher with a pinned lookup.
export async function safeFetch(
  url: string,
  resolve: Resolver = defaultResolve,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; finalUrl: string; html: string } | { error: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const refused = await checkUrl(current, resolve);
    if (refused) return { error: refused };
    let res: Response;
    try {
      res = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "ClearanceReadinessCheck/0.1", Accept: "text/html,*/*;q=0.5" },
      });
    } catch {
      return { error: "Request failed or timed out" };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      try { current = new URL(res.headers.get("location")!, current).toString(); }
      catch { return { error: "Bad redirect" }; }
      await res.body?.cancel().catch(() => {});
      continue;
    }
    try {
      return { ok: res.ok, status: res.status, finalUrl: current, html: await readCapped(res) };
    } catch {
      return { error: "Failed reading response" };
    }
  }
  return { error: "Too many redirects" };
}
