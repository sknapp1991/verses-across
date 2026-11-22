/**
 * This device's stats with reading plans, goals and device counts folded in: the numbers behind the
 * Progress panel's level and badges, and the scorecard a study-group member shares (groups.ts).
 */
import type { Activity } from "./activity";
import { computeStats, deviceCounts, goalsMetCount, type DeviceCounts, type Stats } from "./achievements";
import { finishedPlans, getStartedPlans, planDays, PLANS } from "./plans";
import { getItem } from "./study";
import type { StudyItem } from "./storage";

export function statsNow(
  a: Activity,
  items: Map<string, StudyItem>,
  started: Record<string, { start: number }> = getStartedPlans(),
  finished: string[] = finishedPlans(),
  goalsMet: number = goalsMetCount(),
  counts: DeviceCounts = deviceCounts(),
): Stats {
  const done = new Set(finished);
  for (const p of PLANS) if (started[p.id] && planDays(p).every((d) => d.every((r) => !!getItem("studied", r)))) done.add(`${p.id}@${started[p.id].start}`);
  return computeStats(a, items, { plansDone: done.size, goalsMet, counts });
}
