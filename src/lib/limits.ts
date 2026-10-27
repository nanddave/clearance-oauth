import { kvGet, kvIncr } from "./kv";

const day = () => new Date().toISOString().slice(0, 10);
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 10);

/** Fixed-window counter per bucket and IP. True when the call is allowed. */
export async function rateLimit(bucket: string, ip: string, max: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  return (await kvIncr(`rl:${bucket}:${ip}:${win}`, 1, windowSec)) <= max;
}

export const addSpend = (usd: number) => kvIncr(`spend:${day()}`, usd, 2 * 86400);
export const spentToday = async () => (await kvGet<number>(`spend:${day()}`)) ?? 0;
// shortcut: jobs already running can overshoot the cap by one job's cost; fine at this scale.
export const overBudget = async () => (await spentToday()) >= DAILY_BUDGET_USD;

/** Client IP behind Vercel's proxy; "local" in dev. */
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
