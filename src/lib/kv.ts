// Upstash Redis over REST when configured (Vercel's integration sets KV_* names), else an in-process Map.
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

type Entry = { v: string; exp: number };
const g = globalThis as unknown as { __clearanceKv?: Map<string, Entry> };
const mem = (g.__clearanceKv ??= new Map<string, Entry>());

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_!, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!res.ok) throw new Error(`kv ${cmd[0]} failed: ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

const live = (e: Entry | undefined) => (e && e.exp > Date.now() ? e : undefined);

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const raw = URL_ ? ((await redis(["GET", key])) as string | null) : live(mem.get(key))?.v;
  return raw == null ? undefined : (JSON.parse(raw) as T);
}

export async function kvSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const v = JSON.stringify(value);
  if (URL_) await redis(["SET", key, v, "EX", ttlSec]);
  else {
    if (mem.size > 2000) mem.delete(mem.keys().next().value!); // shortcut: oldest-inserted eviction for the dev fallback
    mem.set(key, { v, exp: Date.now() + ttlSec * 1000 });
  }
}

/** Atomic add; the TTL is set when the key is created. Returns the new value. */
export async function kvIncr(key: string, by: number, ttlSec: number): Promise<number> {
  if (URL_) {
    const n = Number(await redis(["INCRBYFLOAT", key, by]));
    if (n === by) await redis(["EXPIRE", key, ttlSec]);
    return n;
  }
  const e = live(mem.get(key));
  const n = (e ? Number(e.v) : 0) + by;
  mem.set(key, { v: String(n), exp: e?.exp ?? Date.now() + ttlSec * 1000 });
  return n;
}

/** Set only if absent (atomic on Redis). True when this caller got the key: a lease. */
export async function kvSetNx(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  const v = JSON.stringify(value);
  if (URL_) return (await redis(["SET", key, v, "NX", "EX", ttlSec])) === "OK";
  if (live(mem.get(key))) return false;
  mem.set(key, { v, exp: Date.now() + ttlSec * 1000 });
  return true;
}
