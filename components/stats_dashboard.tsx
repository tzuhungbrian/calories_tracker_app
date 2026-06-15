"use client";

import { Activity, BarChart3, Beef, CheckCircle2, ChevronDown, Flame, Footprints, Leaf, PieChart, Target, Trophy, Utensils, Wheat } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DailySummary, DashboardData, FoodLog } from "@/lib/types";

type StatsDashboardProps = {
  rows: DailySummary[];
  dashboard: DashboardData | null;
  logs: FoodLog[];
};

type HabitKey = "logged" | "protein" | "creatine" | "exercise";
type NutrientKey = "calories" | "protein" | "fat" | "carbs";

const rangeOptions = [7, 14, 30];
const energyRangeOptions = [30, 60, 90, 180] as const;
const nutrientKeys: NutrientKey[] = ["calories", "protein", "fat", "carbs"];
const nutrientIcons = {
  calories: Flame,
  protein: Beef,
  fat: Leaf,
  carbs: Wheat
};
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

function isGenericFoodName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return ["manual entry", "custom food", "ai estimated meal", "quick add", "unknown"].includes(normalized);
}

function localFatRange(target: number): { min: number; max: number } {
  return {
    min: Math.round(target * 0.8),
    max: Math.round(target * 1.2)
  };
}

function controlledCalories(row: DailySummary): boolean {
  if (row.calories <= 0 || row.calorieTarget <= 0) {
    return false;
  }

  return row.goalType === "bulk" ? row.calories >= row.calorieTarget : row.calories <= row.calorieTarget;
}

function calorieControlStreak(rows: DailySummary[]): number {
  let streak = 0;

  for (const row of rows) {
    if (!controlledCalories(row)) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function signedCalories(value: number): string {
  const rounded = round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function macroRatio(rows: DailySummary[]): { protein: number; fat: number; carbs: number; avgProtein: number; avgFat: number; avgCarbs: number; loggedDays: number } {
  const loggedRows = rows.filter((row) => row.calories > 0);
  const totals = loggedRows.reduce(
    (result, row) => ({
      protein: result.protein + row.protein,
      fat: result.fat + row.fat,
      carbs: result.carbs + row.carbs
    }),
    { protein: 0, fat: 0, carbs: 0 }
  );
  const proteinCalories = totals.protein * 4;
  const fatCalories = totals.fat * 9;
  const carbCalories = totals.carbs * 4;
  const macroCalories = proteinCalories + fatCalories + carbCalories;

  return {
    protein: macroCalories ? Math.round((proteinCalories / macroCalories) * 100) : 0,
    fat: macroCalories ? Math.round((fatCalories / macroCalories) * 100) : 0,
    carbs: macroCalories ? Math.round((carbCalories / macroCalories) * 100) : 0,
    avgProtein: loggedRows.length ? totals.protein / loggedRows.length : 0,
    avgFat: loggedRows.length ? totals.fat / loggedRows.length : 0,
    avgCarbs: loggedRows.length ? totals.carbs / loggedRows.length : 0,
    loggedDays: loggedRows.length
  };
}

function nutrientStatus(label: NutrientKey, data: DashboardData): { tone: "good" | "warn" | "neutral"; message: string; detail: string } {
  const total = data.totals[label];
  const target = data.targets[label];
  const remaining = data.remaining[label];
  const goalType = data.status?.goalType ?? "maintain";

  if (data.status?.isTravelDay) {
    return { tone: "neutral", message: "Travel", detail: "excluded from adherence" };
  }

  if (label === "protein") {
    return total >= target
      ? { tone: "good", message: "Hit", detail: `target ${round(target)}g` }
      : { tone: "warn", message: "Low", detail: `${round(Math.max(target - total, 0))}g to go` };
  }

  if (label === "fat") {
    const range = localFatRange(target);
    const inRange = total >= range.min && total <= range.max;
    return {
      tone: inRange ? "good" : "warn",
      message: inRange ? "In range" : total < range.min ? "Low" : "High",
      detail: `${range.min}-${range.max}g range`
    };
  }

  if (goalType === "bulk") {
    return remaining <= 0
      ? { tone: "good", message: "Hit", detail: `${round(Math.abs(remaining))}${label === "calories" ? " kcal" : "g"} over` }
      : { tone: "warn", message: "Needs more", detail: `${round(remaining)}${label === "calories" ? " kcal" : "g"} left` };
  }

  return remaining >= 0
    ? { tone: "good", message: "On target", detail: `${round(remaining)}${label === "calories" ? " kcal" : "g"} left` }
    : { tone: "warn", message: "Over", detail: `${round(Math.abs(remaining))}${label === "calories" ? " kcal" : "g"} over` };
}

function nutrientValue(label: NutrientKey, value: number): string {
  return `${round(value)}${label === "calories" ? " kcal" : "g"}`;
}

export function StatsDashboard({ rows, dashboard, logs }: StatsDashboardProps) {
  const [dayRange, setDayRange] = useState(14);
  const [showMoreInsights, setShowMoreInsights] = useState(false);
  const exerciseStepGoal = dashboard?.exerciseStepGoal ?? 8000;
  const scopedRows = useMemo(() => rows.slice(0, dayRange), [dayRange, rows]);
  const analysisRows = useMemo(() => scopedRows.filter((row) => !row.isTravelDay), [scopedRows]);
  const orderedRows = useMemo(() => [...analysisRows].reverse(), [analysisRows]);
  const recentSevenRows = useMemo(() => rows.slice(0, 7), [rows]);
  const recentSevenAnalysisRows = useMemo(() => recentSevenRows.filter((row) => !row.isTravelDay), [recentSevenRows]);
  const recentSevenOrderedRows = useMemo(() => [...recentSevenAnalysisRows].reverse(), [recentSevenAnalysisRows]);
  const scopedDateSet = useMemo(() => new Set(analysisRows.map((row) => row.date)), [analysisRows]);
  const scopedLogs = useMemo(() => logs.filter((log) => scopedDateSet.has(log.date)), [logs, scopedDateSet]);
  const travelDaysInRange = scopedRows.length - analysisRows.length;
  const exerciseDays = analysisRows.filter((row) => row.strengthSession || row.basketballMinutes > 0 || row.steps > exerciseStepGoal).length;
  const currentProteinStreak = proteinStreak(analysisRows);
  const cutRows = analysisRows.filter((row) => row.goalType === "cut" && row.calories > 0);
  const proteinRows = analysisRows.filter((row) => row.proteinGoal > 0 && row.calories > 0);
  const overTargetDateSet = useMemo(() => new Set(analysisRows.filter((row) => row.calories > row.calorieTarget).map((row) => row.date)), [analysisRows]);
  const sevenLoggedRows = recentSevenAnalysisRows.filter((row) => row.calories > 0);
  const sevenDayBalance = sevenLoggedRows.length ? average(sevenLoggedRows.map((row) => row.calories - row.dynamicTdee)) : 0;
  const cutSuccessRate = rate(cutRows.filter((row) => row.calories <= row.calorieTarget).length, cutRows.length);
  const proteinCompliance = rate(proteinRows.filter((row) => row.protein >= row.proteinGoal).length, proteinRows.length);
  const exerciseConsistency = rate(analysisRows.filter((row) => isHabitDone(row, "exercise", exerciseStepGoal)).length, analysisRows.length);
  const averageMacroRatio = useMemo(() => macroRatio(analysisRows), [analysisRows]);
  const controlStreak = calorieControlStreak(rows.filter((row) => !row.isTravelDay));
  const sevenDayProteinHits = recentSevenAnalysisRows.filter((row) => row.calories > 0 && row.proteinGoal > 0 && row.protein >= row.proteinGoal).length;
  const sevenDayExerciseHits = recentSevenAnalysisRows.filter((row) => isHabitDone(row, "exercise", exerciseStepGoal)).length;
  const overageMeal = useMemo(() => {
    const totals = scopedLogs.filter((log) => overTargetDateSet.has(log.date)).reduce<Record<string, number>>((result, log) => {
      const meal = log.meal || "No meal";
      result[meal] = (result[meal] ?? 0) + log.calories;
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [overTargetDateSet, scopedLogs]);
  const mainProteinSource = useMemo(() => {
    const clearFoodLogs = scopedLogs.filter((log) => log.protein > 0 && !isGenericFoodName(log.foodName));
    const totals = clearFoodLogs.reduce<Record<string, number>>((result, log) => {
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
          {travelDaysInRange > 0 ? (
            <p className="mt-2 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              Excluding {travelDaysInRange} travel day{travelDaysInRange === 1 ? "" : "s"} from adherence insights
            </p>
          ) : null}
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

      <CompactNutritionSummary data={dashboard} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <EnergyBalancePanel rows={recentSevenOrderedRows} />
        <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Key signals</h2>
              <p className="mt-1 text-sm text-slate-500">The checks that matter more than meal suggestions.</p>
            </div>
            <Target className="shrink-0 text-blue-700" size={22} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SignalCard icon={<Flame size={18} />} label="7-day avg vs TDEE" value={`${round(sevenDayBalance)} kcal/day`} sub={sevenDayBalance <= 0 ? "Below maintenance recently" : "Above maintenance recently"} tone={sevenDayBalance <= 0 ? "good" : "warn"} />
            <SignalCard icon={<Beef size={18} />} label="Protein compliance" value={`${proteinCompliance}%`} sub={`${currentProteinStreak} day current streak`} tone={proteinCompliance >= 80 ? "good" : "warn"} />
            <SignalCard icon={<Footprints size={18} />} label="Exercise consistency" value={`${exerciseConsistency}%`} sub={`${exerciseDays} exercise days, goal ${round(exerciseStepGoal)} steps`} tone={exerciseConsistency >= 70 ? "good" : "neutral"} />
            <SignalCard icon={<Target size={18} />} label="Cut success" value={cutRows.length ? `${cutSuccessRate}%` : "No cut days"} sub={cutRows.length ? `${cutRows.length} logged cut days in range` : "Selected range has no cut days"} tone={!cutRows.length ? "neutral" : cutSuccessRate >= 70 ? "good" : "warn"} />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <button
          className="flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left hover:bg-slate-50"
          type="button"
          aria-expanded={showMoreInsights}
          onClick={() => setShowMoreInsights((current) => !current)}
        >
          <div>
            <h2 className="text-lg font-semibold">More insights</h2>
            <p className="mt-1 text-sm text-slate-500">Patterns, macro split, habits, and deeper weekly context.</p>
          </div>
          <ChevronDown className={`shrink-0 text-slate-500 transition-transform duration-300 ease-out ${showMoreInsights ? "rotate-180" : ""}`} size={20} />
        </button>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${showMoreInsights ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <div className={`grid gap-4 border-t border-slate-200 p-4 transition-opacity duration-200 ease-out ${showMoreInsights ? "opacity-100 delay-100" : "pointer-events-none opacity-0"}`}>
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <MacroRatioPanel ratio={averageMacroRatio} dayRange={dayRange} />
                <MomentumCard controlStreak={controlStreak} proteinHits={sevenDayProteinHits} exerciseHits={sevenDayExerciseHits} loggedDays={sevenLoggedRows.length} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <InsightCard icon={<Utensils size={18} />} label="Over-target meal" value={overageMeal ? overageMeal[0] : "No overage"} sub={overageMeal ? `${round(overageMeal[1])} kcal on over-target days` : "No meal stands out as causing over-target days."} tone={overageMeal ? "warn" : "good"} />
                <InsightCard icon={<Trophy size={18} />} label="Main protein source" value={mainProteinSource ? mainProteinSource[0] : "Mixed manual logs"} sub={mainProteinSource ? `${round(mainProteinSource[1])}g from this food in selected range` : "No specific saved food stands out. Manual entries are excluded from this card."} tone="good" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <HabitHeatmap rows={orderedRows.slice(-14)} exerciseStepGoal={exerciseStepGoal} />
                <ProteinStreakPanel rows={orderedRows.slice(-14)} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function CompactNutritionSummary({ data }: { data: DashboardData | null }) {
  if (!data) {
    return <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading today&apos;s nutrition summary...</section>;
  }

  const tdeeBalance = data.totals.calories - data.dynamicTdee;
  const goalType = data.status?.goalType ?? "maintain";
  const isTravelDay = data.status?.isTravelDay ?? false;

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today at a glance</h2>
          <p className="mt-1 text-sm text-slate-500">Compact macro status for today, with target and TDEE context kept in view.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 capitalize text-slate-600">{goalType} mode</span>
          {isTravelDay ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Travel day</span> : null}
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">TDEE {round(data.dynamicTdee)} kcal</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Target {round(data.targets.calories)} kcal</span>
          <span className={`rounded-full px-2.5 py-1 ${tdeeBalance <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>vs TDEE {signedCalories(tdeeBalance)} kcal</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {nutrientKeys.map((key) => {
          const Icon = nutrientIcons[key];
          const status = nutrientStatus(key, data);
          const tone = {
            good: "border-emerald-100 bg-emerald-50/60 text-emerald-700",
            warn: "border-red-100 bg-red-50/60 text-red-700",
            neutral: "border-blue-100 bg-blue-50/60 text-blue-700"
          }[status.tone];

          return (
            <div key={key} className={`rounded-lg border px-3 py-2.5 ${tone}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/80 dark:bg-slate-900/80">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize">{key}</p>
                    <p className="text-xs text-slate-500">{status.detail}</p>
                  </div>
                </div>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold dark:bg-slate-900/80">{status.message}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-xl font-semibold text-ink">{nutrientValue(key, data.totals[key])}</p>
                <p className="text-xs text-slate-500">of {nutrientValue(key, data.targets[key])}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SignalCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub: string; tone: "good" | "warn" | "neutral" }) {
  const styles = {
    good: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    warn: "border-amber-100 bg-amber-50/80 text-amber-700",
    neutral: "border-blue-100 bg-blue-50/70 text-blue-700"
  };

  return (
    <div className={`rounded-lg border p-3 ${styles[tone]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-slate-900/80">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function MomentumCard({ controlStreak, proteinHits, exerciseHits, loggedDays }: { controlStreak: number; proteinHits: number; exerciseHits: number; loggedDays: number }) {
  return (
    <section className="animate-enter-soft hover-lift rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Momentum</p>
          <h3 className="mt-1 text-xl font-semibold">{controlStreak > 0 ? `${controlStreak}-day control streak` : "Build today's streak"}</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Activity size={20} />
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <MomentumRow label="Logged days" value={loggedDays} target={7} />
        <MomentumRow label="Protein hits" value={proteinHits} target={7} />
        <MomentumRow label="Exercise hits" value={exerciseHits} target={7} />
      </div>
      <p className="mt-4 text-sm text-slate-500">A small streak is easier to protect than motivation is to restart.</p>
    </section>
  );
}

function MomentumRow({ label, value, target }: { label: string; value: number; target: number }) {
  const width = clamp((value / target) * 100, value > 0 ? 10 : 0, 100);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">
          {value}/{target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <span className="block h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MacroRatioPanel({ ratio, dayRange }: { ratio: ReturnType<typeof macroRatio>; dayRange: number }) {
  const ratioRows = [
    { key: "protein", label: "Protein", value: ratio.protein, grams: ratio.avgProtein, color: "bg-emerald-500", text: "text-emerald-700", hex: "#10b981" },
    { key: "fat", label: "Fat", value: ratio.fat, grams: ratio.avgFat, color: "bg-amber-500", text: "text-amber-700", hex: "#f59e0b" },
    { key: "carbs", label: "Carbs", value: ratio.carbs, grams: ratio.avgCarbs, color: "bg-blue-500", text: "text-blue-700", hex: "#3b82f6" }
  ];
  const dominant = ratioRows.reduce((winner, item) => (item.value > winner.value ? item : winner), ratioRows[0]);
  const proteinEnd = ratio.protein;
  const fatEnd = ratio.protein + ratio.fat;
  const hasMacroSplit = ratio.protein + ratio.fat + ratio.carbs > 0;
  const pieStyle = {
    background: `conic-gradient(${ratioRows[0].hex} 0% ${proteinEnd}%, ${ratioRows[1].hex} ${proteinEnd}% ${fatEnd}%, ${ratioRows[2].hex} ${fatEnd}% 100%)`
  };

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <PieChart size={20} />
            Average macro ratio
          </h2>
          <p className="mt-1 text-sm text-slate-500">Energy share from protein, fat, and carbs across the selected {dayRange}-day range.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{ratio.loggedDays} logged days</span>
      </div>

      {ratio.loggedDays > 0 && hasMacroSplit ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
          <div className="flex justify-center md:justify-start">
            <div className="relative h-36 w-36 rounded-full shadow-sm" style={pieStyle} role="img" aria-label={`Average macro ratio: protein ${ratio.protein}%, fat ${ratio.fat}%, carbs ${ratio.carbs}%`}>
              <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center shadow-inner dark:bg-slate-900">
                <div>
                  <p className={`text-xl font-semibold ${dominant.text}`}>{dominant.value}%</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{dominant.label} lead</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            {ratioRows.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${item.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-500">Avg {round(item.grams)}g / day</p>
                  </div>
                </div>
                <p className={`text-lg font-semibold ${item.text}`}>{item.value}%</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Log food to see your average macro split.</div>
      )}
    </section>
  );
}

function EnergyBalancePanel({ rows }: { rows: DailySummary[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [energyRange, setEnergyRange] = useState<"custom" | number>(30);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [historyRows, setHistoryRows] = useState<DailySummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const loggedRows = rows.filter((row) => !row.isTravelDay && row.calories > 0);
  const totalBalance = loggedRows.reduce((sum, row) => sum + row.calories - row.dynamicTdee, 0);
  const deficitDays = loggedRows.filter((row) => row.calories <= row.dynamicTdee).length;
  const surplusDays = loggedRows.length - deficitDays;
  const maxAbsBalance = Math.max(...loggedRows.map((row) => Math.abs(row.calories - row.dynamicTdee)), 250);
  const explorerRows = useMemo(() => {
    const sourceRows = (historyRows.length ? historyRows : rows).filter((row) => !row.isTravelDay);
    return [...sourceRows].reverse();
  }, [historyRows, rows]);
  const excludedTravelDays = (historyRows.length ? historyRows : rows).filter((row) => row.isTravelDay).length;
  const explorerLoggedRows = explorerRows.filter((row) => row.calories > 0);
  const explorerBalances = explorerLoggedRows.map((row) => row.calories - row.dynamicTdee);
  const explorerTotalBalance = explorerBalances.reduce((sum, balance) => sum + balance, 0);
  const explorerDeficitDays = explorerBalances.filter((balance) => balance <= 0).length;
  const explorerSurplusDays = explorerLoggedRows.length - explorerDeficitDays;
  const explorerMaxAbsBalance = Math.max(...explorerBalances.map((balance) => Math.abs(balance)), 250);
  const averageBalance = explorerLoggedRows.length ? explorerTotalBalance / explorerLoggedRows.length : 0;
  const biggestDeficit = Math.min(...explorerBalances, 0);
  const biggestSurplus = Math.max(...explorerBalances, 0);
  const deficitRate = rate(explorerDeficitDays, explorerLoggedRows.length);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    if (energyRange === "custom" && (!customStartDate || !customEndDate || customStartDate > customEndDate)) {
      return;
    }

    const controller = new AbortController();
    const query =
      energyRange === "custom"
        ? `start=${encodeURIComponent(customStartDate)}&end=${encodeURIComponent(customEndDate)}`
        : `days=${energyRange}`;

    setIsLoadingHistory(true);
    setHistoryError(null);

    fetch(`/api/summary?${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load energy history.");
        }
        return response.json() as Promise<DailySummary[]>;
      })
      .then(setHistoryRows)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setHistoryError(error instanceof Error ? error.message : "Failed to load energy history.");
      })
      .finally(() => setIsLoadingHistory(false));

    return () => controller.abort();
  }, [customEndDate, customStartDate, energyRange, isExpanded]);

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            className="inline-flex items-center gap-2 rounded-lg text-left text-lg font-semibold transition hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            <Flame size={20} />
            Recent energy balance
            <ChevronDown className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} size={18} />
          </button>
          <p className="mt-1 text-sm text-slate-500">Daily calories minus dynamic TDEE. Green is deficit, amber is surplus.</p>
        </div>
        <button
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${totalBalance <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {totalBalance <= 0 ? "Net deficit" : "Net surplus"} {Math.abs(round(totalBalance))} kcal
          <BarChart3 size={16} />
        </button>
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
        {excludedTravelDays > 0 ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{excludedTravelDays} travel excluded</span> : null}
      </div>

      <div className={`grid transition-all duration-500 ease-out ${isExpanded ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Energy history explorer</p>
                <p className="mt-1 text-xs text-slate-500">Choose a longer window or set a custom date range.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {energyRangeOptions.map((option) => (
                  <button
                    key={option}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${energyRange === option ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                    type="button"
                    onClick={() => setEnergyRange(option)}
                  >
                    {option}D
                  </button>
                ))}
                <button
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${energyRange === "custom" ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  type="button"
                  onClick={() => setEnergyRange("custom")}
                >
                  Custom
                </button>
              </div>
            </div>

            {energyRange === "custom" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  End
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {historyError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{historyError}</p> : null}
            {energyRange === "custom" && customStartDate && customEndDate && customStartDate > customEndDate ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">Start date must be before end date.</p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <EnergyStat label="Avg / day" value={`${averageBalance > 0 ? "+" : ""}${round(averageBalance)} kcal`} tone={averageBalance <= 0 ? "good" : "warn"} />
              <EnergyStat label="Deficit rate" value={`${deficitRate}%`} tone={deficitRate >= 70 ? "good" : "warn"} />
              <EnergyStat label="Biggest deficit" value={`${round(biggestDeficit)} kcal`} tone="good" />
              <EnergyStat label="Biggest surplus" value={`+${round(biggestSurplus)} kcal`} tone={biggestSurplus > 0 ? "warn" : "neutral"} />
            </div>

            {isLoadingHistory ? <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-semibold text-slate-500">Loading energy history...</p> : null}

            {!isLoadingHistory && explorerLoggedRows.length > 0 ? (
              <div className="mt-5 overflow-x-auto pb-2">
                <div className="relative flex h-56 min-w-[720px] items-center gap-2 border-y border-slate-200 px-2">
                  <span className="absolute left-0 right-0 top-1/2 h-px bg-slate-300" />
                  {explorerLoggedRows.map((row) => {
                    const balance = row.calories - row.dynamicTdee;
                    const isDeficit = balance <= 0;
                    const height = clamp((Math.abs(balance) / explorerMaxAbsBalance) * 44, 4, 44);

                    return (
                      <div key={row.date} className="group relative z-10 flex h-full flex-1 min-w-10 items-center justify-center">
                        <div className="relative h-full w-full">
                          <span
                            className={`absolute left-1/2 w-5 -translate-x-1/2 rounded-full transition-all duration-300 group-hover:w-7 ${isDeficit ? "top-1/2 bg-emerald-500" : "bottom-1/2 bg-amber-500"}`}
                            style={{ height: `${height}%` }}
                          />
                          <div className="pointer-events-none absolute left-1/2 top-4 z-20 hidden w-36 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg group-hover:block">
                            <p className="font-semibold text-slate-800">{row.date}</p>
                            <p className={isDeficit ? "text-emerald-700" : "text-amber-700"}>
                              {balance > 0 ? "+" : ""}
                              {round(balance)} kcal vs TDEE
                            </p>
                            <p className="mt-1 text-slate-500">{round(row.calories)} kcal eaten / {round(row.dynamicTdee)} TDEE</p>
                          </div>
                        </div>
                        <span className="absolute bottom-0 rotate-[-45deg] text-[11px] font-semibold text-slate-500">{row.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!isLoadingHistory && !explorerLoggedRows.length ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                No logged calorie days in this range.
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{explorerDeficitDays} deficit days</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{explorerSurplusDays} surplus days</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{explorerLoggedRows.length} logged days</span>
              {excludedTravelDays > 0 ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{excludedTravelDays} travel excluded</span> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EnergyStat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-700";

  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
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
