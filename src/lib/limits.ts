import { kvGet, kvIncr } from "./kv";

const day = () => new Date().toISOString().slice(0, 10);
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 10);

/** Fixed-window counter per bucket and IP. True when the call is allowed. */
export async function rateLimit(bucket: string, ip: string, max: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  return (await kvIncr(`rl:${bucket}:${ip}:${win}`, 1, windowSec)) <= max;
}

/** `onDay` pins a release to the day its reserve was taken, so a run crossing midnight doesn't move money between days. */
export const addSpend = (usd: number, onDay = day()) => kvIncr(`spend:${onDay}`, usd, 2 * 86400);
export const reserveSpend = async (usd: number) => {
  const d = day();
  await addSpend(usd, d);
  return d;
};
export const spentToday = async () => (await kvGet<number>(`spend:${day()}`)) ?? 0;
/** Held against the daily budget while a run is in flight (a typical run's estimated cost), released when it ends.
 *  shortcut: the budget check and the reserve aren't one atomic step, so two starts in the same instant can both pass; fine at demo scale. */
export const RUN_RESERVE_USD = 0.75;
export const overBudget = async () => (await spentToday()) >= DAILY_BUDGET_USD;

/** Client IP behind Vercel's proxy; "local" in dev. */
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
