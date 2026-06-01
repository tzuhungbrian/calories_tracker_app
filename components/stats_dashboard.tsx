"use client";

import { Activity, BarChart3, CheckCircle2, Flame, Footprints, Target, Trophy, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { DashboardCards } from "@/components/dashboard_cards";
import type { DailySummary, DashboardData } from "@/lib/types";

type StatsDashboardProps = {
  rows: DailySummary[];
  dashboard: DashboardData | null;
};

type HabitKey = "logged" | "protein" | "creatine" | "training";

const rangeOptions = [7, 14, 30];
const habitRows: Array<{ key: HabitKey; label: string }> = [
  { key: "logged", label: "Logged" },
  { key: "protein", label: "Protein" },
  { key: "creatine", label: "Creatine" },
  { key: "training", label: "Training" }
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

function positivePercent(value: number, max: number): number {
  return max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
}

function calorieBalanceColor(row: DailySummary): string {
  if (row.goalType === "bulk") {
    return row.calories >= row.calorieTarget ? "bg-emerald-500" : "bg-red-500";
  }

  if (row.goalType === "cut") {
    if (row.calories <= row.calorieTarget) {
      return "bg-emerald-500";
    }

    if (row.dynamicTdee > row.calorieTarget && row.calories < row.dynamicTdee) {
      return "bg-amber-500";
    }

    return "bg-red-500";
  }

  return row.calories <= row.calorieTarget ? "bg-emerald-500" : "bg-red-500";
}

function isCalorieGoalHit(row: DailySummary): boolean {
  if (row.goalType === "bulk") {
    return row.calories >= row.calorieTarget;
  }

  return row.calories <= row.calorieTarget;
}

function isHabitDone(row: DailySummary, key: HabitKey): boolean {
  if (key === "logged") {
    return row.calories > 0;
  }
  if (key === "protein") {
    return row.proteinGoal > 0 && row.protein >= row.proteinGoal;
  }
  if (key === "creatine") {
    return row.creatineTaken;
  }
  return row.strengthSession || row.basketballMinutes > 0;
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

export function StatsDashboard({ rows, dashboard }: StatsDashboardProps) {
  const [dayRange, setDayRange] = useState(14);
  const scopedRows = useMemo(() => rows.slice(0, dayRange), [dayRange, rows]);
  const orderedRows = useMemo(() => [...scopedRows].reverse(), [scopedRows]);
  const averages = useMemo(
    () => ({
      calories: average(scopedRows.map((row) => row.calories)),
      target: average(scopedRows.map((row) => row.calorieTarget)),
      dynamicTdee: average(scopedRows.map((row) => row.dynamicTdee)),
      protein: average(scopedRows.map((row) => row.protein)),
      proteinGoal: average(scopedRows.map((row) => row.proteinGoal)),
      fat: average(scopedRows.map((row) => row.fat)),
      carbs: average(scopedRows.map((row) => row.carbs)),
      steps: average(scopedRows.map((row) => row.steps))
    }),
    [scopedRows]
  );
  const calorieHitRate = scopedRows.length
    ? Math.round((scopedRows.filter((row) => row.calories > 0 && isCalorieGoalHit(row)).length / scopedRows.length) * 100)
    : 0;
  const trainingDays = scopedRows.filter((row) => row.strengthSession || row.basketballMinutes > 0).length;
  const currentProteinStreak = proteinStreak(scopedRows);

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Flame size={18} />} label="Avg calories" value={`${round(averages.calories)} kcal`} sub={`Target ${round(averages.target)}`} />
        <StatCard icon={<Target size={18} />} label="Target hit rate" value={`${calorieHitRate}%`} sub="Logged days that matched the goal mode" />
        <StatCard icon={<Footprints size={18} />} label="Avg steps" value={`${round(averages.steps)}`} sub={`${trainingDays} training days`} />
        <StatCard icon={<Trophy size={18} />} label="Protein streak" value={`${currentProteinStreak} days`} sub={`Avg ${round(averages.protein)} / ${round(averages.proteinGoal)} g`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CalorieBalanceChart rows={orderedRows} />
        <HabitHeatmap rows={orderedRows.slice(-14)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EnergyOutlook rows={scopedRows} averages={averages} />
        <ProteinStreakPanel rows={orderedRows.slice(-14)} />
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="animate-enter hover-lift rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">{icon}</div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{sub}</p>
    </div>
  );
}

function CalorieBalanceChart({ rows }: { rows: DailySummary[] }) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const maxBalance = Math.max(...rows.map((row) => Math.abs(row.calories - row.dynamicTdee)), 100);
  const hoveredRow = rows.find((row) => row.date === hoveredDate);
  const maxBarPercentFromMidline = 46;

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Calorie balance</h2>
          <p className="mt-1 text-sm text-slate-500">Daily difference from TDEE. Green hit the day&apos;s goal, amber is a partial cut day, red missed.</p>
        </div>
        {hoveredRow ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">{hoveredRow.date}</span>
            <span className="ml-2 text-slate-500">vs TDEE</span>
            <span className={hoveredRow.calories > hoveredRow.dynamicTdee ? "ml-2 text-red-600" : "ml-2 text-emerald-600"}>
              {round(hoveredRow.calories - hoveredRow.dynamicTdee)} kcal
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="relative flex h-64 min-w-[620px] items-center gap-2 overflow-hidden border-y border-slate-100 py-4">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300" />
          {rows.map((row) => {
            const balance = row.calories - row.dynamicTdee;
            const barHeight = clamp(positivePercent(Math.abs(balance), maxBalance) * (maxBarPercentFromMidline / 100), 4, maxBarPercentFromMidline);
            const isOver = balance > 0;
            const isHovered = hoveredDate === row.date;
            const barColor = calorieBalanceColor(row);

            return (
              <button
                key={row.date}
                className="group relative flex h-full flex-1 flex-col items-center justify-center"
                type="button"
                title={`${row.date}: ${round(balance)} kcal vs TDEE, target ${round(row.calorieTarget)} kcal`}
                onBlur={() => setHoveredDate(null)}
                onFocus={() => setHoveredDate(row.date)}
                onMouseEnter={() => setHoveredDate(row.date)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <span className="relative flex h-[184px] w-full items-center justify-center overflow-hidden">
                  <span
                    className={`absolute w-full max-w-9 rounded-md transition-all duration-200 ${isOver ? "bottom-1/2" : "top-1/2"} ${barColor} ${isHovered ? "opacity-100 shadow-lg" : "opacity-80"}`}
                    style={{ height: `${barHeight}%` }}
                  />
                </span>
                <span className="mt-2 rotate-[-45deg] text-[10px] text-slate-500">{row.date.slice(5)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HabitHeatmap({ rows }: { rows: DailySummary[] }) {
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
                const done = isHabitDone(row, habit.key);
                return (
                  <span
                    key={`${habit.key}-${row.date}`}
                    className={`aspect-square w-full rounded-md border transition ${done ? "border-emerald-200 bg-emerald-500" : "border-slate-200 bg-slate-50"}`}
                    title={`${row.date}: ${done ? "done" : "not yet"}`}
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

function EnergyOutlook({
  rows,
  averages
}: {
  rows: DailySummary[];
  averages: { calories: number; target: number; dynamicTdee: number; protein: number; proteinGoal: number; fat: number; carbs: number; steps: number };
}) {
  const loggedRows = rows.filter((row) => row.calories > 0);
  const avgVsTdee = averages.calories - averages.dynamicTdee;
  const avgVsTarget = averages.calories - averages.target;
  const underTdeeDays = loggedRows.filter((row) => row.calories <= row.dynamicTdee).length;
  const targetHitDays = loggedRows.filter(isCalorieGoalHit).length;
  const insight =
    avgVsTdee <= 0
      ? "Your recent intake is below average TDEE, so weight trend should lean downward if logging is accurate."
      : "Your recent intake is above average TDEE, so weight trend should lean upward unless activity is under-counted.";

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Energy outlook</h2>
          <p className="mt-1 text-sm text-slate-500">Recent intake compared with your dynamic TDEE and goal target.</p>
        </div>
        <Activity className="text-blue-700" size={22} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EnergyMetric label="Avg vs TDEE" value={`${round(avgVsTdee)} kcal/day`} tone={avgVsTdee <= 0 ? "good" : "warn"} />
        <EnergyMetric label="Avg vs target" value={`${round(avgVsTarget)} kcal/day`} tone={Math.abs(avgVsTarget) <= 100 ? "good" : "neutral"} />
        <EnergyMetric label="Below TDEE days" value={`${underTdeeDays}/${loggedRows.length || rows.length}`} tone={underTdeeDays >= Math.ceil(loggedRows.length / 2) ? "good" : "warn"} />
        <EnergyMetric label="Goal matched days" value={`${targetHitDays}/${loggedRows.length || rows.length}`} tone={targetHitDays >= Math.ceil(loggedRows.length / 2) ? "good" : "warn"} />
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Read this first</p>
        <p className="mt-1">{insight}</p>
      </div>
    </section>
  );
}

function EnergyMetric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const toneClasses = {
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-red-50 text-red-700",
    neutral: "bg-blue-50 text-blue-700"
  };

  return (
    <div className={`rounded-lg p-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
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
