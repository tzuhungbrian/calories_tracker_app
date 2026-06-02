"use client";

import { Activity, BarChart3, Beef, CheckCircle2, Flame, Footprints, Target, Trophy, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { DashboardCards } from "@/components/dashboard_cards";
import type { DailySummary, DashboardData, FoodLog } from "@/lib/types";

type StatsDashboardProps = {
  rows: DailySummary[];
  dashboard: DashboardData | null;
  logs: FoodLog[];
};

type HabitKey = "logged" | "protein" | "creatine" | "exercise";

const rangeOptions = [7, 14, 30];
const habitRows: Array<{ key: HabitKey; label: string }> = [
  { key: "logged", label: "Logged" },
  { key: "protein", label: "Protein" },
  { key: "creatine", label: "Creatine" },
  { key: "exercise", label: "Exercise" }
];

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isHabitDone(row: DailySummary, key: HabitKey, exerciseStepGoal = 8000): boolean {
  if (key === "logged") {
    return row.calories > 0;
  }
  if (key === "protein") {
    return row.proteinGoal > 0 && row.protein >= row.proteinGoal;
  }
  if (key === "creatine") {
    return row.creatineTaken;
  }
  return row.strengthSession || row.basketballMinutes > 0 || row.steps > exerciseStepGoal;
}

function proteinStreak(rows: DailySummary[]): number {
  let streak = 0;

  for (const row of rows) {
    if (row.proteinGoal <= 0 || row.protein < row.proteinGoal) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function rate(hitCount: number, total: number): number {
  return total ? Math.round((hitCount / total) * 100) : 0;
}

export function StatsDashboard({ rows, dashboard, logs }: StatsDashboardProps) {
  const [dayRange, setDayRange] = useState(14);
  const exerciseStepGoal = dashboard?.exerciseStepGoal ?? 8000;
  const scopedRows = useMemo(() => rows.slice(0, dayRange), [dayRange, rows]);
  const orderedRows = useMemo(() => [...scopedRows].reverse(), [scopedRows]);
  const recentSevenRows = useMemo(() => rows.slice(0, 7), [rows]);
  const scopedDateSet = useMemo(() => new Set(scopedRows.map((row) => row.date)), [scopedRows]);
  const scopedLogs = useMemo(() => logs.filter((log) => scopedDateSet.has(log.date)), [logs, scopedDateSet]);
  const exerciseDays = scopedRows.filter((row) => row.strengthSession || row.basketballMinutes > 0 || row.steps > exerciseStepGoal).length;
  const currentProteinStreak = proteinStreak(scopedRows);
  const cutRows = scopedRows.filter((row) => row.goalType === "cut" && row.calories > 0);
  const proteinRows = scopedRows.filter((row) => row.proteinGoal > 0 && row.calories > 0);
  const overTargetDateSet = useMemo(() => new Set(scopedRows.filter((row) => row.calories > row.calorieTarget).map((row) => row.date)), [scopedRows]);
  const sevenLoggedRows = recentSevenRows.filter((row) => row.calories > 0);
  const sevenDayBalance = sevenLoggedRows.length ? average(sevenLoggedRows.map((row) => row.calories - row.dynamicTdee)) : 0;
  const cutSuccessRate = rate(cutRows.filter((row) => row.calories <= row.calorieTarget).length, cutRows.length);
  const proteinCompliance = rate(proteinRows.filter((row) => row.protein >= row.proteinGoal).length, proteinRows.length);
  const exerciseConsistency = rate(scopedRows.filter((row) => isHabitDone(row, "exercise", exerciseStepGoal)).length, scopedRows.length);
  const overageMeal = useMemo(() => {
    const totals = scopedLogs.filter((log) => overTargetDateSet.has(log.date)).reduce<Record<string, number>>((result, log) => {
      const meal = log.meal || "No meal";
      result[meal] = (result[meal] ?? 0) + log.calories;
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [overTargetDateSet, scopedLogs]);
  const topProteinFood = useMemo(() => {
    const totals = scopedLogs.reduce<Record<string, number>>((result, log) => {
      result[log.foodName] = (result[log.foodName] ?? 0) + log.protein;
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [scopedLogs]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <BarChart3 size={20} />
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-500">Nutrition balance, consistency, and energy trend.</p>
        </div>
        <div className="inline-grid rounded-lg border border-slate-200 bg-slate-50 p-1 sm:grid-cols-3">
          {rangeOptions.map((option) => (
            <button
              key={option}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${dayRange === option ? "bg-ink text-white" : "text-slate-600"}`}
              type="button"
              onClick={() => setDayRange(option)}
            >
              {option}D
            </button>
          ))}
        </div>
      </div>

      <DashboardCards data={dashboard} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InsightCard icon={<Flame size={18} />} label="7-day avg vs TDEE" value={`${round(sevenDayBalance)} kcal/day`} sub={sevenDayBalance <= 0 ? "Recent intake is below maintenance." : "Recent intake is above maintenance."} tone={sevenDayBalance <= 0 ? "good" : "warn"} />
        <InsightCard icon={<Target size={18} />} label="Cut success" value={`${cutSuccessRate}%`} sub={`${cutRows.length} logged cut days in range`} tone={cutSuccessRate >= 70 ? "good" : "warn"} />
        <InsightCard icon={<Beef size={18} />} label="Protein compliance" value={`${proteinCompliance}%`} sub={`${currentProteinStreak} day current streak`} tone={proteinCompliance >= 80 ? "good" : "warn"} />
        <InsightCard icon={<Footprints size={18} />} label="Exercise consistency" value={`${exerciseConsistency}%`} sub={`${exerciseDays} exercise days, goal ${round(exerciseStepGoal)} steps`} tone={exerciseConsistency >= 70 ? "good" : "neutral"} />
        <InsightCard icon={<Utensils size={18} />} label="Over-target meal" value={overageMeal ? overageMeal[0] : "No overage"} sub={overageMeal ? `${round(overageMeal[1])} kcal on over-target days` : "No meal stands out as causing over-target days."} tone={overageMeal ? "warn" : "good"} />
        <InsightCard icon={<Trophy size={18} />} label="Top protein food" value={topProteinFood ? topProteinFood[0] : "No data"} sub={topProteinFood ? `${round(topProteinFood[1])}g protein in selected range` : "Log protein foods to see what carries the target."} tone="good" />
      </div>

      <EnergyBalancePanel rows={orderedRows} />

      <div className="grid gap-4 xl:grid-cols-2">
        <HabitHeatmap rows={orderedRows.slice(-14)} exerciseStepGoal={exerciseStepGoal} />
        <ProteinStreakPanel rows={orderedRows.slice(-14)} />
      </div>
    </section>
  );
}

function EnergyBalancePanel({ rows }: { rows: DailySummary[] }) {
  const loggedRows = rows.filter((row) => row.calories > 0);
  const totalBalance = loggedRows.reduce((sum, row) => sum + row.calories - row.dynamicTdee, 0);
  const deficitDays = loggedRows.filter((row) => row.calories <= row.dynamicTdee).length;
  const surplusDays = loggedRows.length - deficitDays;
  const maxAbsBalance = Math.max(...loggedRows.map((row) => Math.abs(row.calories - row.dynamicTdee)), 250);

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Flame size={20} />
            Recent energy balance
          </h2>
          <p className="mt-1 text-sm text-slate-500">Daily calories minus dynamic TDEE. Green is deficit, amber is surplus.</p>
        </div>
        <div className={`w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${totalBalance <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {totalBalance <= 0 ? "Net deficit" : "Net surplus"} {Math.abs(round(totalBalance))} kcal
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {loggedRows.length > 0 ? (
          loggedRows.map((row) => {
            const balance = row.calories - row.dynamicTdee;
            const isDeficit = balance <= 0;
            const width = clamp((Math.abs(balance) / maxAbsBalance) * 100, 6, 100);

            return (
              <div key={row.date} className="grid grid-cols-[56px_minmax(0,1fr)_86px] items-center gap-3">
                <p className="text-xs font-semibold text-slate-500">{row.date.slice(5)}</p>
                <div className="relative h-6 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`absolute bottom-0 top-0 rounded-full ${isDeficit ? "right-1/2 bg-emerald-500" : "left-1/2 bg-amber-500"}`}
                    style={{ width: `${width / 2}%` }}
                  />
                  <span className="absolute bottom-0 left-1/2 top-0 w-px bg-slate-300" />
                </div>
                <p className={`text-right text-sm font-semibold ${isDeficit ? "text-emerald-700" : "text-amber-700"}`}>
                  {balance > 0 ? "+" : ""}
                  {round(balance)}
                </p>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Log calories to see daily deficit and surplus.</div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{deficitDays} deficit days</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{surplusDays} surplus days</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{loggedRows.length} logged days</span>
      </div>
    </section>
  );
}

function InsightCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub: string; tone: "good" | "warn" | "neutral" }) {
  const styles = {
    good: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    warn: "border-amber-100 bg-amber-50/80 text-amber-700",
    neutral: "border-blue-100 bg-blue-50/70 text-blue-700"
  };

  return (
    <div className={`animate-enter hover-lift rounded-lg border p-5 shadow-sm ${styles[tone]}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80">{icon}</div>
        <div>
          <p className="text-sm font-semibold opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{sub}</p>
    </div>
  );
}

function HabitHeatmap({ rows, exerciseStepGoal }: { rows: DailySummary[]; exerciseStepGoal: number }) {
  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Habit consistency</h2>
          <p className="mt-1 text-sm text-slate-500">A compact view of the habits that make the numbers work.</p>
        </div>
        <CheckCircle2 className="text-emerald-600" size={22} />
      </div>
      <div className="mt-5 grid gap-3">
        {habitRows.map((habit) => (
          <div key={habit.key} className="grid grid-cols-[82px_1fr] items-center gap-3">
            <p className="text-sm font-medium text-slate-700">{habit.label}</p>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
              {rows.map((row) => {
                const done = isHabitDone(row, habit.key, exerciseStepGoal);
                return (
                  <span
                    key={`${habit.key}-${row.date}`}
                    className={`aspect-square w-full rounded-md border transition ${done ? "border-emerald-200 bg-emerald-500" : "border-slate-200 bg-slate-50"}`}
                    title={
                      habit.key === "exercise"
                        ? `${row.date}: ${done ? "done" : "not yet"} (strength, basketball, or steps > ${round(exerciseStepGoal)})`
                        : `${row.date}: ${done ? "done" : "not yet"}`
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-500" />
          Done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-slate-200 bg-slate-50" />
          Missing
        </span>
      </div>
    </section>
  );
}

function ProteinStreakPanel({ rows }: { rows: DailySummary[] }) {
  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Protein goal streak</h2>
          <p className="mt-1 text-sm text-slate-500">Recent days against your protein goal.</p>
        </div>
        <Activity className="text-blue-700" size={22} />
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {rows.map((row) => {
          const done = isHabitDone(row, "protein");
          return (
            <div
              key={row.date}
              className={`rounded-lg border p-2 text-center ${done ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}
              title={`${row.date}: ${round(row.protein)} / ${round(row.proteinGoal)} g`}
            >
              <p className="text-[10px] font-medium">{row.date.slice(5)}</p>
              <p className="mt-1 text-sm font-semibold">{done ? "Hit" : "Miss"}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Utensils size={16} />
          Tip
        </div>
        <p className="mt-1 text-sm text-slate-500">This panel is most useful when protein is treated like a daily habit, not only a macro total.</p>
      </div>
    </section>
  );
}
