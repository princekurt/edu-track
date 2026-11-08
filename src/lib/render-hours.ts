import type { AcademicPeriod, RenderHourRecord } from "./types";

export interface PeriodBalance {
  periodId: string;
  periodName: string;
  schoolYear: string;
  startDate: string;
  earned: number;
  carryIn: number;
  total: number;
  applied: number;
  carryOut: number;
  required: number;
  remaining: number;
  met: boolean;
}

/**
 * Computes the render-hour balance across periods using the office-approved
 * rule: each period requires `requiredHours`; any excess above the requirement
 * carries forward to the next period when carry-forward is enabled.
 */
export function computeRenderHourBalances(params: {
  records: Pick<RenderHourRecord, "period_id" | "hours">[];
  periods: AcademicPeriod[];
  requiredHours: number;
  carryForwardEnabled: boolean;
}): PeriodBalance[] {
  const { records, periods, requiredHours, carryForwardEnabled } = params;

  const earnedByPeriod = new Map<string, number>();
  for (const record of records) {
    earnedByPeriod.set(
      record.period_id,
      (earnedByPeriod.get(record.period_id) ?? 0) + Number(record.hours),
    );
  }

  const ordered = [...periods].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  const balances: PeriodBalance[] = [];
  let carryIn = 0;

  for (const period of ordered) {
    const earned = round(earnedByPeriod.get(period.id) ?? 0);
    const total = round(carryIn + earned);
    const applied = round(Math.min(total, requiredHours));
    const carryOut = carryForwardEnabled ? round(Math.max(total - requiredHours, 0)) : 0;

    balances.push({
      periodId: period.id,
      periodName: period.name,
      schoolYear: period.school_year,
      startDate: period.start_date,
      earned,
      carryIn,
      total,
      applied,
      carryOut,
      required: requiredHours,
      remaining: round(Math.max(requiredHours - total, 0)),
      met: total >= requiredHours,
    });

    carryIn = carryForwardEnabled ? carryOut : 0;
  }

  return balances;
}

export function latestBalance(balances: PeriodBalance[]): PeriodBalance | null {
  return balances.length > 0 ? balances[balances.length - 1] : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
