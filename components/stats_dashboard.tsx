"use client";

import { Activity, BarChart3, CheckCircle2, Flame, Footprints, Target, Trophy, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DailySummary } from "@/lib/types";

type StatsDashboardProps = {
  rows: DailySummary[];
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

export function StatsDashboard({ rows }: StatsDashboardProps) {
  const [dayRange, setDayRange] = useState(14);
  const scopedRows = useMemo(() => rows.slice(0, dayRange), [dayRange, rows]);
  const orderedRows = useMemo(() => [...scopedRows].reverse(), [scopedRows]);
  const averages = useMemo(
    () => ({
      calories: average(scopedRows.map((row) => row.calories)),
      target: average(scopedRows.map((row) => row.calorieTarget)),
      protein: average(scopedRows.map((row) => row.protein)),
      proteinGoal: average(scopedRows.map((row) => row.proteinGoal)),
      fat: average(scopedRows.map((row) => row.fat)),
      carbs: average(scopedRows.map((row) => row.carbs)),
      steps: average(scopedRows.map((row) => row.steps))
    }),
    [scopedRows]
  );
  const calorieHitRate = scopedRows.length
    ? Math.round((scopedRows.filter((row) => row.calories > 0 && row.calories <= row.calorieTarget).length / scopedRows.length) * 100)
    : 0;
  const trainingDays = scopedRows.filter((row) => row.strengthSession || row.basketballMinutes > 0).length;
  const currentProteinStreak = proteinStreak(scopedRows);
  const macroCalories = {
    protein: averages.protein * 4,
    fat: averages.fat * 9,
    carbs: averages.carbs * 4
  };
  const totalMacroCalories = Math.max(macroCalories.protein + macroCalories.fat + macroCalories.carbs, 1);
  const estimatedFatTarget = averages.target ? Math.round((averages.target * 0.25) / 9) : 0;
  const estimatedCarbTarget = averages.target ? Math.max(0, Math.round((averages.target - averages.proteinGoal * 4 - estimatedFatTarget * 9) / 4)) : 0;
  const macroRings = [
    { label: "Protein", grams: averages.protein, target: averages.proteinGoal, percent: (macroCalories.protein / totalMacroCalories) * 100, color: "#2563eb" },
    { label: "Fat", grams: averages.fat, target: estimatedFatTarget, percent: (macroCalories.fat / totalMacroCalories) * 100, color: "#f59e0b" },
    { label: "Carbs", grams: averages.carbs, target: estimatedCarbTarget, percent: (macroCalories.carbs / totalMacroCalories) * 100, color: "#f97316" }
  ];

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <BarChart3 size={20} />
            Stats
          </h2>
          <p className="mt-1 text-sm text-slate-500">Nutrition balance, consistency, and macro patterns.</p>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Flame size={18} />} label="Avg calories" value={`${round(averages.calories)} kcal`} sub={`Target ${round(averages.target)}`} />
        <StatCard icon={<Target size={18} />} label="Target hit rate" value={`${calorieHitRate}%`} sub="Logged days at or under target" />
        <StatCard icon={<Footprints size={18} />} label="Avg steps" value={`${round(averages.steps)}`} sub={`${trainingDays} training days`} />
        <StatCard icon={<Trophy size={18} />} label="Protein streak" value={`${currentProteinStreak} days`} sub={`Avg ${round(averages.protein)} / ${round(averages.proteinGoal)} g`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <CalorieBalanceChart rows={orderedRows} />
        <MacroRings macros={macroRings} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <HabitHeatmap rows={orderedRows.slice(-14)} />
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
  const maxBalance = Math.max(...rows.map((row) => Math.abs(row.calories - row.calorieTarget)), 100);
  const hoveredRow = rows.find((row) => row.date === hoveredDate);

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Calorie balance</h2>
          <p className="mt-1 text-sm text-slate-500">Daily difference from target. Green is under target, red is over.</p>
        </div>
        {hoveredRow ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">{hoveredRow.date}</span>
            <span className={hoveredRow.calories > hoveredRow.calorieTarget ? "ml-2 text-red-600" : "ml-2 text-emerald-600"}>
              {round(hoveredRow.calories - hoveredRow.calorieTarget)} kcal
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="relative flex h-64 min-w-[620px] items-center gap-2 border-y border-slate-100 py-4">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300" />
          {rows.map((row) => {
            const balance = row.calories - row.calorieTarget;
            const barHeight = Math.max(8, positivePercent(Math.abs(balance), maxBalance) * 0.92);
            const isOver = balance > 0;
            const isHovered = hoveredDate === row.date;

            return (
              <button
                key={row.date}
                className="group relative flex h-full flex-1 flex-col items-center justify-center"
                type="button"
                title={`${row.date}: ${round(balance)} kcal`}
                onBlur={() => setHoveredDate(null)}
                onFocus={() => setHoveredDate(row.date)}
                onMouseEnter={() => setHoveredDate(row.date)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <span className="relative flex h-[184px] w-full items-center justify-center">
                  <span
                    className={`absolute w-full max-w-9 rounded-md transition-all duration-200 ${isOver ? "bottom-1/2 bg-red-500" : "top-1/2 bg-emerald-500"} ${isHovered ? "opacity-100 shadow-lg" : "opacity-80"}`}
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

function MacroRings({ macros }: { macros: Array<{ label: string; grams: number; target: number; percent: number; color: string }> }) {
  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Macro summary</h2>
      <p className="mt-1 text-sm text-slate-500">Average intake compared with the current target model.</p>
      <div className="mt-5 grid gap-4">
        {macros.map((macro) => (
          <div key={macro.label} className="grid grid-cols-[64px_1fr] items-center gap-4">
            <ProgressRing color={macro.color} percent={macro.percent} />
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{macro.label}</p>
                  <p className="text-sm text-slate-500">
                    {round(macro.grams)}g{macro.target ? ` / ${round(macro.target)}g` : ""} avg
                  </p>
                </div>
                <p className="text-lg font-semibold" style={{ color: macro.color }}>
                  {round(macro.percent)}%
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${clamp(macro.percent, 6, 100)}%`, backgroundColor: macro.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgressRing({ color, percent }: { color: string; percent: number }) {
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamp(percent, 0, 100) / 100) * circumference;

  return (
    <svg className="h-16 w-16 shrink-0" viewBox="0 0 60 60" role="img" aria-label={`${round(percent)} percent`}>
      <circle cx="30" cy="30" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        fill="none"
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth="8"
        transform="rotate(-90 30 30)"
      />
    </svg>
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
                    className={`h-7 rounded-md border transition ${done ? "border-emerald-200 bg-emerald-500" : "border-slate-200 bg-slate-50"}`}
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
