"use client";

import { Activity, ArrowRight, BarChart3, Beef, CheckCircle2, ChevronDown, Flame, Footprints, Leaf, PieChart, Sparkles, Target, Trophy, Utensils, Wheat } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DailySummary, DashboardData, FoodLog } from "@/lib/types";

type StatsDashboardProps = {
  rows: DailySummary[];
  dashboard: DashboardData | null;
  logs: FoodLog[];
  onLogNextMeal: () => void;
};

type HabitKey = "logged" | "protein" | "creatine" | "exercise";
type NutrientKey = "calories" | "protein" | "fat" | "carbs";

const rangeOptions = [7, 14, 30];
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

function todayDecision(data: DashboardData | null): { title: string; body: string; tone: "good" | "warn" | "neutral" } {
  if (!data) {
    return {
      title: "Load today first",
      body: "Once the sheet data loads, this card turns the numbers into a concrete next step.",
      tone: "neutral"
    };
  }

  const goalType = data.status?.goalType ?? "maintain";
  const caloriesRemaining = data.remaining.calories;
  const proteinRemaining = Math.max(data.targets.protein - data.totals.protein, 0);
  const tdeeBalance = data.totals.calories - data.dynamicTdee;

  if (data.totals.calories <= 0) {
    return {
      title: "Start with one clean log",
      body: `Today's ${goalType} target is ${round(data.targets.calories)} kcal. Add your first meal so the plan can steer the rest of the day.`,
      tone: "neutral"
    };
  }

  if (goalType === "bulk") {
    if (caloriesRemaining > 0) {
      return {
        title: "Fuel the bulk",
        body: `${round(caloriesRemaining)} kcal left to reach target. Prioritize protein first, then add carbs around training.`,
        tone: "warn"
      };
    }

    return {
      title: "Bulk target hit",
      body: `You are ${Math.abs(round(caloriesRemaining))} kcal past target. Keep the rest easy and avoid turning a good surplus into noise.`,
      tone: "good"
    };
  }

  if (caloriesRemaining >= 0) {
    return {
      title: proteinRemaining > 10 ? "Protect the deficit with protein" : "Today is under control",
      body:
        proteinRemaining > 10
          ? `${round(caloriesRemaining)} kcal left and ${round(proteinRemaining)}g protein still open. Make the next food protein-led.`
          : `${round(caloriesRemaining)} kcal left and protein is handled. Keep dinner simple and you keep the win.`,
      tone: "good"
    };
  }

  if (goalType === "cut" && tdeeBalance <= 0) {
    return {
      title: "Partial win, do not spiral",
      body: `You are ${Math.abs(round(caloriesRemaining))} kcal over cut target, but still ${Math.abs(round(tdeeBalance))} kcal below TDEE. Keep the next meal light.`,
      tone: "neutral"
    };
  }

  return {
    title: "Damage control mode",
    body: `You are ${Math.abs(round(caloriesRemaining))} kcal over target and ${signedCalories(tdeeBalance)} kcal vs TDEE. Go protein-heavy, low-fat, and stop snacking.`,
    tone: "warn"
  };
}

function nextMeal(data: DashboardData | null): { title: string; body: string; detail: string; tone: "good" | "warn" | "neutral" } {
  if (!data) {
    return {
      title: "Next meal suggestion",
      body: "Loading meal guidance.",
      detail: "Needs today's targets.",
      tone: "neutral"
    };
  }

  const proteinRemaining = Math.max(data.targets.protein - data.totals.protein, 0);
  const caloriesRemaining = data.remaining.calories;
  const carbsRemaining = data.remaining.carbs;
  const fatBand = localFatRange(data.targets.fat);

  if (caloriesRemaining <= 0) {
    return {
      title: "Light recovery plate",
      body: "Lean protein plus vegetables. Skip calorie-dense sauces and oils.",
      detail: `${round(proteinRemaining)}g protein still useful`,
      tone: "warn"
    };
  }

  if (proteinRemaining >= 35 && caloriesRemaining >= 350) {
    return {
      title: "Lean protein meal",
      body: "Chicken, fish, egg whites, Greek yogurt, tofu, or a saved prep meal.",
      detail: `${round(proteinRemaining)}g protein left`,
      tone: "good"
    };
  }

  if (proteinRemaining >= 15 && caloriesRemaining < 350) {
    return {
      title: "Protein snack",
      body: "Use a compact option so you hit protein without spending the whole calorie budget.",
      detail: `${round(caloriesRemaining)} kcal left`,
      tone: "good"
    };
  }

  if (data.totals.fat > fatBand.max) {
    return {
      title: "Low-fat dinner",
      body: "Fat is already high today. Choose lean protein and carbs, avoid oils, nuts, and fried foods.",
      detail: `Fat range ${fatBand.min}-${fatBand.max}g`,
      tone: "warn"
    };
  }

  if (carbsRemaining > 80 && (data.status?.goalType === "bulk" || data.status?.basketballMinutes || data.status?.strengthSession)) {
    return {
      title: "Carb refill meal",
      body: "Rice, potatoes, noodles, or fruit paired with a clear protein source.",
      detail: `${round(carbsRemaining)}g carbs left`,
      tone: "neutral"
    };
  }

  return {
    title: "Balanced plate",
    body: "A protein anchor, one carb, and one vegetable keeps the rest of today boring in a good way.",
    detail: `${round(caloriesRemaining)} kcal left`,
    tone: "neutral"
  };
}

function nutrientStatus(label: NutrientKey, data: DashboardData): { tone: "good" | "warn" | "neutral"; message: string; detail: string } {
  const total = data.totals[label];
  const target = data.targets[label];
  const remaining = data.remaining[label];
  const goalType = data.status?.goalType ?? "maintain";

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

export function StatsDashboard({ rows, dashboard, logs, onLogNextMeal }: StatsDashboardProps) {
  const [dayRange, setDayRange] = useState(14);
  const exerciseStepGoal = dashboard?.exerciseStepGoal ?? 8000;
  const scopedRows = useMemo(() => rows.slice(0, dayRange), [dayRange, rows]);
  const orderedRows = useMemo(() => [...scopedRows].reverse(), [scopedRows]);
  const recentSevenRows = useMemo(() => rows.slice(0, 7), [rows]);
  const recentSevenOrderedRows = useMemo(() => [...recentSevenRows].reverse(), [recentSevenRows]);
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
  const averageMacroRatio = useMemo(() => macroRatio(scopedRows), [scopedRows]);
  const decision = todayDecision(dashboard);
  const mealSuggestion = nextMeal(dashboard);
  const controlStreak = calorieControlStreak(rows);
  const sevenDayProteinHits = recentSevenRows.filter((row) => row.calories > 0 && row.proteinGoal > 0 && row.protein >= row.proteinGoal).length;
  const sevenDayExerciseHits = recentSevenRows.filter((row) => isHabitDone(row, "exercise", exerciseStepGoal)).length;
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

      <div className="grid gap-3 xl:grid-cols-[1.25fr_0.85fr]">
        <CoachCard
          icon={<Sparkles size={20} />}
          label="Today's decision"
          title={decision.title}
          body={decision.body}
          tone={decision.tone}
          actionLabel="Log next meal"
          onAction={onLogNextMeal}
          emphasis
        />
        <CoachCard icon={<Utensils size={20} />} label="Next best meal" title={mealSuggestion.title} body={mealSuggestion.body} detail={mealSuggestion.detail} tone={mealSuggestion.tone} />
      </div>

      <CompactNutritionSummary data={dashboard} />

      <EnergyBalancePanel rows={recentSevenOrderedRows} />

      <details className="group rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-lg font-semibold">More insights</h2>
            <p className="mt-1 text-sm text-slate-500">Patterns, macro split, habits, and deeper weekly context.</p>
          </div>
          <ChevronDown className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" size={20} />
        </summary>
        <div className="grid gap-4 border-t border-slate-200 p-4">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <MacroRatioPanel ratio={averageMacroRatio} dayRange={dayRange} />
            <MomentumCard controlStreak={controlStreak} proteinHits={sevenDayProteinHits} exerciseHits={sevenDayExerciseHits} loggedDays={sevenLoggedRows.length} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <InsightCard icon={<Flame size={18} />} label="7-day avg vs TDEE" value={`${round(sevenDayBalance)} kcal/day`} sub={sevenDayBalance <= 0 ? "Recent intake is below maintenance." : "Recent intake is above maintenance."} tone={sevenDayBalance <= 0 ? "good" : "warn"} />
            <InsightCard icon={<Target size={18} />} label="Cut success" value={`${cutSuccessRate}%`} sub={`${cutRows.length} logged cut days in range`} tone={cutSuccessRate >= 70 ? "good" : "warn"} />
            <InsightCard icon={<Beef size={18} />} label="Protein compliance" value={`${proteinCompliance}%`} sub={`${currentProteinStreak} day current streak`} tone={proteinCompliance >= 80 ? "good" : "warn"} />
            <InsightCard icon={<Footprints size={18} />} label="Exercise consistency" value={`${exerciseConsistency}%`} sub={`${exerciseDays} exercise days, goal ${round(exerciseStepGoal)} steps`} tone={exerciseConsistency >= 70 ? "good" : "neutral"} />
            <InsightCard icon={<Utensils size={18} />} label="Over-target meal" value={overageMeal ? overageMeal[0] : "No overage"} sub={overageMeal ? `${round(overageMeal[1])} kcal on over-target days` : "No meal stands out as causing over-target days."} tone={overageMeal ? "warn" : "good"} />
            <InsightCard icon={<Trophy size={18} />} label="Main protein source" value={mainProteinSource ? mainProteinSource[0] : "Mixed manual logs"} sub={mainProteinSource ? `${round(mainProteinSource[1])}g from this food in selected range` : "No specific saved food stands out. Manual entries are excluded from this card."} tone="good" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HabitHeatmap rows={orderedRows.slice(-14)} exerciseStepGoal={exerciseStepGoal} />
            <ProteinStreakPanel rows={orderedRows.slice(-14)} />
          </div>
        </div>
      </details>
    </section>
  );
}

function CompactNutritionSummary({ data }: { data: DashboardData | null }) {
  if (!data) {
    return <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading today&apos;s nutrition summary...</section>;
  }

  const tdeeBalance = data.totals.calories - data.dynamicTdee;
  const goalType = data.status?.goalType ?? "maintain";

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today at a glance</h2>
          <p className="mt-1 text-sm text-slate-500">Compact macro status for today, with target and TDEE context kept in view.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 capitalize text-slate-600">{goalType} mode</span>
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

function CoachCard({
  icon,
  label,
  title,
  body,
  detail,
  tone,
  actionLabel,
  onAction,
  emphasis = false
}: {
  icon: ReactNode;
  label: string;
  title: string;
  body: string;
  detail?: string;
  tone: "good" | "warn" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
  emphasis?: boolean;
}) {
  const styles = {
    good: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-700 dark:border-emerald-900 dark:from-emerald-950/50 dark:to-slate-900 dark:text-emerald-300",
    warn: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-700 dark:border-amber-900 dark:from-amber-950/50 dark:to-slate-900 dark:text-amber-300",
    neutral: "border-blue-200 bg-gradient-to-br from-blue-50 to-white text-blue-700 dark:border-blue-900 dark:from-blue-950/50 dark:to-slate-900 dark:text-blue-300"
  };

  return (
    <section className={`animate-enter-soft hover-lift rounded-lg border p-5 shadow-sm ${styles[tone]} ${emphasis ? "min-h-[210px]" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/85 shadow-sm dark:bg-slate-900/80">{icon}</div>
          <div>
            <p className="text-sm font-semibold opacity-80">{label}</p>
            <h3 className={`${emphasis ? "text-2xl" : "text-xl"} mt-1 font-semibold text-ink`}>{title}</h3>
          </div>
        </div>
        {detail ? <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold shadow-sm dark:bg-slate-900/80">{detail}</span> : null}
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
      {actionLabel && onAction ? (
        <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800" type="button" onClick={onAction}>
          {actionLabel}
          <ArrowRight size={15} />
        </button>
      ) : null}
    </section>
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
