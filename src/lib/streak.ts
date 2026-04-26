/**
 * Streak utilities operating against the activity_data table.
 *
 * Strict rule: a day only counts toward the streak when the user achieved
 * their primary target. We treat the *step goal* as the primary target —
 * a day qualifies when steps >= step_goal. Calorie intake is treated as a
 * secondary fallback (calories_consumed >= calorie_goal also qualifies).
 *
 * Reset rule: walking backwards from today (or yesterday if today not yet
 * achieved), the first missing day OR first non-qualifying day breaks the
 * loop and the running count is the current streak.
 */

export interface ActivityRow {
  date: string; // 'YYYY-MM-DD'
  steps: number | null;
  step_goal: number | null;
  calories_consumed?: number | null;
  calorie_goal?: number | null;
}

export interface DailyHistoryEntry {
  date: string;
  steps: number;
  stepGoal: number;
  caloriesConsumed: number;
  calorieGoal: number;
  achieved: boolean;
}

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

export const dayQualifies = (row: ActivityRow | undefined): boolean => {
  if (!row) return false;
  const steps = row.steps ?? 0;
  const stepGoal = row.step_goal ?? 10000;
  const cals = row.calories_consumed ?? 0;
  const calGoal = row.calorie_goal ?? 0;
  if (steps >= stepGoal && stepGoal > 0) return true;
  if (calGoal > 0 && cals >= calGoal) return true;
  return false;
};

/**
 * Calculate the user's CURRENT streak. Sorts rows by date desc and counts
 * consecutive qualifying days starting from today (or yesterday if today
 * has no qualifying entry yet — we don't punish the user mid-day).
 */
export const calculateCurrentStreak = (rows: ActivityRow[]): number => {
  if (!rows?.length) return 0;
  const map = new Map(rows.map(r => [r.date, r]));
  const today = new Date();
  let count = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const row = map.get(toDateStr(d));
    if (dayQualifies(row)) {
      count++;
    } else if (i === 0) {
      // Today doesn't qualify yet — don't break, just skip and try yesterday.
      continue;
    } else {
      break;
    }
  }
  return count;
};

/**
 * Highest streak ever achieved across the supplied history.
 */
export const calculateHighestStreak = (rows: ActivityRow[]): number => {
  if (!rows?.length) return 0;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  let prev: Date | null = null;

  for (const row of sorted) {
    if (!dayQualifies(row)) { run = 0; prev = new Date(row.date); continue; }
    const cur = new Date(row.date);
    if (prev) {
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
      if (diff === 1) run += 1;
      else run = 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = cur;
  }
  return best;
};

export const buildHistoryEntries = (rows: ActivityRow[]): DailyHistoryEntry[] => {
  return [...rows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => ({
      date: r.date,
      steps: r.steps ?? 0,
      stepGoal: r.step_goal ?? 10000,
      caloriesConsumed: r.calories_consumed ?? 0,
      calorieGoal: r.calorie_goal ?? 0,
      achieved: dayQualifies(r),
    }));
};
