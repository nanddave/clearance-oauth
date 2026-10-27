import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

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
  if (g.slice(0, 4).every((n) => n === 0) && g[4] === 0xffff && g[5] === 0) return embedded(g[6], g[7]); // ::ffff:0:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return embedded(g[6], g[7]); // NAT64
  if (g[0] === 0x2002) return embedded(g[1], g[2]); // 6to4
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0 || (g[0] & 0xff00) === 0xff00;
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolve: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

/** Returns an error message if the URL must not be fetched, else null. */
export async function checkUrl(raw: string, resolve: Resolver = defaultResolve): Promise<string | null> {
  const r = await screen(raw, resolve);
  return "error" in r ? r.error : null;
}

/** Screens a URL and returns the public address it resolved to, so the request can be pinned to it. */
async function screen(raw: string, resolve: Resolver): Promise<{ error: string } | { address: string }> {
  let u: URL;
  try { u = new URL(raw); } catch { return { error: "Not a valid URL" }; }
  if (u.protocol !== "https:") return { error: "Only https:// URLs are allowed" };
  if (u.username || u.password) return { error: "URLs with credentials are not allowed" };
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return { error: "That address is not allowed" };
  let addrs: string[];
  if (isIP(host)) addrs = [host];
  else {
    try { addrs = await Promise.race([resolve(host), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("dns timeout")), 3000).unref())]); } catch { return { error: "Host could not be resolved" }; }
  }
  if (!addrs.length || addrs.some(isBlockedAddress)) return { error: "That address is not allowed (private or internal)" };
  return { address: addrs.find((a) => isIP(a) === 4) ?? addrs[0] }; // prefer IPv4: some runtimes have no IPv6 route
}

/**
 * fetch() would resolve the host again, and a rebinding DNS server could answer with an internal address the
 * second time. This connects to the address we already screened, keeping the hostname for TLS and Host.
 */
function pinnedFetch(address: string): typeof fetch {
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const u = new URL(String(input));
      const host = u.hostname.replace(/^\[|\]$/g, ""); // IPv6 literals come bracketed
      const family = isIP(address);
      const req = request(
        {
          hostname: host,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: "GET",
          headers: init?.headers as Record<string, string>,
          servername: isIP(host) ? undefined : host,
          signal: init?.signal ?? undefined,
          lookup: (_host, opts, cb) =>
            (opts as { all?: boolean }).all ? (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address, family }]) : cb(null, address, family),
        },
        (res) => {
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
          const status = res.statusCode && res.statusCode >= 200 ? res.statusCode : 502;
          const noBody = [204, 205, 304].includes(status);
          if (noBody) res.resume();
          resolve(new Response(noBody ? null : (Readable.toWeb(res) as ReadableStream), { status, headers }));
        },
      );
      req.on("error", reject);
      req.end();
    });
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

/** Each hop is screened, then fetched from the screened address. `fetchImpl` is for tests only. */
export async function safeFetch(
  url: string,
  resolve: Resolver = defaultResolve,
  fetchImpl?: typeof fetch,
  deadline?: AbortSignal,
): Promise<{ ok: boolean; status: number; finalUrl: string; html: string } | { error: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const screened = await screen(current, resolve);
    if ("error" in screened) return { error: screened.error };
    let res: Response;
    try {
      res = await (fetchImpl ?? pinnedFetch(screened.address))(current, {
        redirect: "manual",
        signal: deadline ? AbortSignal.any([deadline, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
        // identity: node's https doesn't decompress, so ask for plain text
        headers: { "User-Agent": "ClearanceReadinessCheck/0.1", Accept: "text/html,*/*;q=0.5", "Accept-Encoding": "identity" },
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
    const enc = res.headers.get("content-encoding");
    if (enc && enc !== "identity") return { error: `Server sent compressed content (${enc})` };
    try {
      return { ok: res.ok, status: res.status, finalUrl: current, html: await readCapped(res) };
    } catch {
      return { error: "Failed reading response" };
    }
  }
  return { error: "Too many redirects" };
}
