"use client";

import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Plane, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { mealOptions } from "@/lib/food_options";
import type { DailySummary, FoodLog, NutritionTotals } from "@/lib/types";
import { useModalAccessibility } from "@/components/use_modal_accessibility";

type FoodLogCalendarProps = {
  rows: DailySummary[];
  logs: FoodLog[];
  today: string;
  onOpenLogs: (date: string) => void;
};

type DayTone = "empty" | "logged" | "met" | "partial" | "missed" | "travel";
type MonthDirection = "forward" | "backward";
type RingTone = "green" | "amber" | "red";

type RingProgress = {
  progress: number | null;
  percentage: number | null;
  tone: RingTone | null;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mealOrder = new Map<string, number>(mealOptions.map((meal, index) => [meal, index]));

const toneLabels: Record<DayTone, string> = {
  empty: "No food logged",
  logged: "Logged",
  met: "Goal met",
  partial: "Partially on track",
  missed: "Goal missed",
  travel: "Travel day"
};

const toneClasses: Record<DayTone, string> = {
  empty: "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800",
  logged: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  met: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  partial: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  missed: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200",
  travel: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200"
};

const ringStrokeClasses: Record<RingTone, string> = {
  green: "stroke-emerald-500 dark:stroke-emerald-400",
  amber: "stroke-amber-500 dark:stroke-amber-400",
  red: "stroke-red-400 dark:stroke-red-400"
};

function parseDateKey(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

function monthBounds(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(finalDay).padStart(2, "0")}`
  };
}

function moveMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1 + offset, 1));
  return moved.toISOString().slice(0, 7);
}

function monthGridDates(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index - mondayOffset + 1));
    return date.toISOString().slice(0, 10);
  });
}

function formatMonth(monthKey: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDateKey(`${monthKey}-01`));
}

function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parseDateKey(date));
}

function calorieDayTone(summary: DailySummary | undefined, hasLogs: boolean): DayTone {
  if (summary?.isTravelDay) {
    return "travel";
  }
  if (!hasLogs) {
    return "empty";
  }
  if (!summary || !isPositiveFinite(summary.calorieTarget) || !isPositiveFinite(summary.dynamicTdee)) {
    return "logged";
  }

  if (summary.goalType === "cut") {
    if (summary.calories <= summary.calorieTarget) return "met";
    return summary.calories <= summary.dynamicTdee ? "partial" : "missed";
  }

  if (summary.goalType === "bulk") {
    if (summary.calories >= summary.calorieTarget) return "met";
    return summary.calories >= summary.dynamicTdee ? "partial" : "missed";
  }

  return summary.calories <= summary.calorieTarget ? "met" : "missed";
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function percentageProgress(value: number, target: number): { progress: number | null; percentage: number | null } {
  if (!Number.isFinite(value) || !isPositiveFinite(target)) {
    return { progress: null, percentage: null };
  }

  const rawPercentage = Math.max(0, (value / target) * 100);
  return { progress: Math.min(rawPercentage, 100), percentage: Math.round(rawPercentage * 10) / 10 };
}

function calorieRing(summary: DailySummary): RingProgress {
  const ratio = percentageProgress(summary.calories, summary.dynamicTdee);
  if (ratio.progress === null || !isPositiveFinite(summary.calorieTarget) || !isPositiveFinite(summary.dynamicTdee)) {
    return { ...ratio, tone: null };
  }

  if (summary.goalType === "bulk") {
    return {
      ...ratio,
      tone: summary.calories >= summary.calorieTarget ? "green" : summary.calories >= summary.dynamicTdee ? "amber" : "red"
    };
  }

  if (summary.goalType === "cut") {
    return {
      ...ratio,
      tone: summary.calories <= summary.calorieTarget ? "green" : summary.calories <= summary.dynamicTdee ? "amber" : "red"
    };
  }

  return { ...ratio, tone: summary.calories <= summary.calorieTarget ? "green" : "red" };
}

function proteinRing(summary: DailySummary): RingProgress {
  const ratio = percentageProgress(summary.protein, summary.proteinGoal);
  if (ratio.progress === null) {
    return { ...ratio, tone: null };
  }

  return {
    ...ratio,
    tone: ratio.progress >= 100 ? "green" : ratio.progress >= 80 ? "amber" : "red"
  };
}

function dayAccessibleLabel(date: string, summary: DailySummary | undefined, hasLogs: boolean, logCount: number): string {
  const itemLabel = `${logCount} logged item${logCount === 1 ? "" : "s"}`;
  const tone = calorieDayTone(summary, hasLogs);

  if (!hasLogs || !summary || summary.isTravelDay) {
    return `${date}: ${toneLabels[tone]}, ${itemLabel}`;
  }

  const calories = calorieRing(summary);
  const protein = proteinRing(summary);
  const calorieLabel = calories.tone === null ? "Calories unavailable" : `Calories ${calories.percentage}% of TDEE`;
  const proteinLabel = protein.percentage === null ? "Protein goal unavailable" : `Protein ${protein.percentage}% of goal`;
  return `${date}: ${toneLabels[tone]}, ${calorieLabel}, ${proteinLabel}, ${itemLabel}`;
}

function addLogTotals(total: NutritionTotals, log: FoodLog): NutritionTotals {
  return {
    calories: total.calories + log.calories,
    protein: total.protein + log.protein,
    fat: total.fat + log.fat,
    carbs: total.carbs + log.carbs
  };
}

function logTotals(logs: FoodLog[]): NutritionTotals {
  return logs.reduce(addLogTotals, { calories: 0, protein: 0, fat: 0, carbs: 0 });
}

function formatValue(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

export function FoodLogCalendar({ rows, logs, today, onOpenLogs }: FoodLogCalendarProps) {
  const currentMonth = today.slice(0, 7);
  const [displayedMonth, setDisplayedMonth] = useState(currentMonth);
  const [monthDirection, setMonthDirection] = useState<MonthDirection>("backward");
  const [monthCache, setMonthCache] = useState<Record<string, DailySummary[]>>({});
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [monthError, setMonthError] = useState("");
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const detailDialogRef = useModalAccessibility(Boolean(detailDate), () => setDetailDate(null));

  const logsByDate = useMemo(() => {
    return logs.reduce<Map<string, FoodLog[]>>((result, log) => {
      const dateLogs = result.get(log.date) ?? [];
      dateLogs.push(log);
      result.set(log.date, dateLogs);
      return result;
    }, new Map());
  }, [logs]);

  useEffect(() => {
    if (monthCache[displayedMonth]) return;

    const controller = new AbortController();
    const { start, end } = monthBounds(displayedMonth);
    setLoadingMonth(displayedMonth);
    setMonthError("");

    fetch(`/api/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load this month.");
        return response.json() as Promise<DailySummary[]>;
      })
      .then((summaryRows) => {
        setMonthCache((current) => ({ ...current, [displayedMonth]: summaryRows }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMonthError(error instanceof Error ? error.message : "Failed to load this month.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMonth((current) => current === displayedMonth ? null : current);
      });

    return () => controller.abort();
  }, [displayedMonth, monthCache]);

  const monthRows = useMemo(() => {
    const byDate = new Map<string, DailySummary>();
    (monthCache[displayedMonth] ?? []).forEach((row) => byDate.set(row.date, row));
    rows.filter((row) => row.date.startsWith(displayedMonth)).forEach((row) => byDate.set(row.date, row));
    return Array.from(byDate.values());
  }, [displayedMonth, monthCache, rows]);

  const summaryByDate = useMemo(() => new Map(monthRows.map((row) => [row.date, row])), [monthRows]);
  const calendarDates = useMemo(() => monthGridDates(displayedMonth), [displayedMonth]);
  const detailLogs = useMemo(() => detailDate ? logsByDate.get(detailDate) ?? [] : [], [detailDate, logsByDate]);
  const detailSummary = detailDate ? summaryByDate.get(detailDate) : undefined;
  const detailTone = calorieDayTone(detailSummary, detailLogs.length > 0);
  const detailTotals = logTotals(detailLogs);

  const detailMealGroups = useMemo(() => {
    const groups = detailLogs.reduce<Map<string, FoodLog[]>>((result, log) => {
      const meal = log.meal || "No meal";
      const mealLogs = result.get(meal) ?? [];
      mealLogs.push(log);
      result.set(meal, mealLogs);
      return result;
    }, new Map());

    return Array.from(groups.entries()).sort(([a], [b]) => {
      const aOrder = mealOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = mealOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.localeCompare(b);
    });
  }, [detailLogs]);

  function changeMonth(offset: number) {
    const nextMonth = moveMonth(displayedMonth, offset);
    if (nextMonth > currentMonth) return;
    setMonthDirection(offset > 0 ? "forward" : "backward");
    setDisplayedMonth(nextMonth);
  }

  function openDate(date: string) {
    setDetailDate(date);
  }

  function openSelectedDateInLogs() {
    if (!detailDate) return;
    const date = detailDate;
    setDetailDate(null);
    onOpenLogs(date);
  }

  const detailDialog = detailDate && typeof document !== "undefined"
    ? createPortal(
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
        <button aria-hidden="true" className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-sm" tabIndex={-1} type="button" onClick={() => setDetailDate(null)} />
        <div
          ref={detailDialogRef}
          aria-label={`Food logs for ${detailDate}`}
          aria-modal="true"
          className="daily-log-preview-enter relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
          role="dialog"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Daily food review</p>
              <h2 className="mt-1 truncate text-xl font-semibold text-slate-950 dark:text-white">{formatLongDate(detailDate)}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className={`rounded-full px-2.5 py-1 ${toneClasses[detailTone]}`}>{toneLabels[detailTone]}</span>
                <span className="text-slate-500 dark:text-slate-400">{detailLogs.length} logged item{detailLogs.length === 1 ? "" : "s"}</span>
                {detailSummary?.calorieTarget ? <span className="text-slate-500 dark:text-slate-400">Target {Math.round(detailSummary.calorieTarget)} kcal</span> : null}
              </div>
            </div>
            <button aria-label="Close daily food review" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" type="button" onClick={() => setDetailDate(null)}>
              <X size={19} />
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MacroStat label="Calories" value={`${Math.round(detailTotals.calories)} kcal`} />
              <MacroStat label="Protein" value={`${formatValue(detailTotals.protein)}g`} />
              <MacroStat label="Fat" value={`${formatValue(detailTotals.fat)}g`} />
              <MacroStat label="Carbs" value={`${formatValue(detailTotals.carbs)}g`} />
            </div>

            {detailMealGroups.length ? (
              <div className="mt-4 grid gap-3">
                {detailMealGroups.map(([meal, mealLogs]) => {
                  const mealTotals = logTotals(mealLogs);
                  return (
                    <section key={meal} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <Utensils className="text-blue-700 dark:text-blue-300" size={15} />
                          {meal}
                        </h3>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{Math.round(mealTotals.calories)} kcal</span>
                      </div>
                      <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                        {mealLogs.map((log) => (
                          <div key={log.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-1 last:pb-0">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{log.foodName}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{log.amount || "1 serving"}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{Math.round(log.calories)} kcal</p>
                              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">P {formatValue(log.protein)} / F {formatValue(log.fat)} / C {formatValue(log.carbs)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Utensils size={20} /></div>
                <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">No food logged</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">There are no food entries for this date.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-slate-200 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:flex sm:justify-end sm:px-5 sm:pb-4 dark:border-slate-800">
            <button className="min-h-11 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" type="button" onClick={() => setDetailDate(null)}>Close</button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500" type="button" onClick={openSelectedDateInLogs}>
              Open in Logs <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <section aria-label="Food log calendar" aria-busy={loadingMonth === displayedMonth} className="animate-enter-soft flex h-full min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
              <CalendarDays className="text-blue-700 dark:text-blue-300" size={20} />
              Food log calendar
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Calories and protein at a glance.</p>
          </div>
          {loadingMonth === displayedMonth ? <LoaderCircle aria-label="Loading month" className="mt-1 shrink-0 animate-spin text-blue-600" size={18} /> : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" type="button" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMonth(displayedMonth)}</p>
          <button aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" disabled={displayedMonth >= currentMonth} type="button" onClick={() => changeMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mx-auto mt-3 w-full max-w-[440px]">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
            {weekdayLabels.map((label) => <span key={label} className="py-1">{label}</span>)}
          </div>
          <div key={displayedMonth} className={`mt-1 grid grid-cols-7 gap-1 ${monthDirection === "forward" ? "calendar-month-forward" : "calendar-month-backward"}`}>
            {calendarDates.map((date) => {
              const isDisplayedMonth = date.startsWith(displayedMonth);
              const isFuture = date > today;
              const dateLogs = logsByDate.get(date) ?? [];
              const summary = summaryByDate.get(date);
              const hasLogs = dateLogs.length > 0;
              const tone = calorieDayTone(summary, hasLogs);
              const isToday = date === today;
              const disabled = !isDisplayedMonth || isFuture;
              return (
                <button
                  key={date}
                  aria-label={dayAccessibleLabel(date, summary, hasLogs, dateLogs.length)}
                  className={`relative aspect-square min-w-0 rounded-md border text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm disabled:pointer-events-none disabled:opacity-25 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 ${tone === "travel" ? toneClasses.travel : "border-slate-200 bg-white"} ${isToday ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                  disabled={disabled}
                  type="button"
                  onClick={() => openDate(date)}
                >
                  {isDisplayedMonth && !isFuture && tone !== "travel" ? <DayProgressRings summary={summary} hasLogs={hasLogs} /> : null}
                  <span className="relative z-10">{Number(date.slice(-2))}</span>
                  {tone === "travel" ? <Plane className="absolute bottom-1 left-1/2 -translate-x-1/2" size={10} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <RingLegend label="Calories" ring="outer" />
          <RingLegend label="Protein" ring="inner" />
          <LegendDot className="bg-emerald-500" label="Met" />
          <LegendDot className="bg-amber-500" label="Close" />
          <LegendDot className="bg-red-400" label="Needs attention" />
          <span className="inline-flex items-center gap-1"><Plane className="text-sky-500" size={11} />Travel</span>
        </div>
        <div className="mt-1.5 text-center text-[10px] leading-4 text-slate-400 dark:text-slate-500">
          <p>Protein: red &lt;80%, amber 80–99%, green ≥100%.</p>
          <p>Calories: Cut ≤ target green, target–TDEE amber, &gt;TDEE red; Bulk ≥ target green, TDEE–target amber, &lt;TDEE red; Maintain ≤ target green.</p>
        </div>

        {monthError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-200">{monthError} Existing log markers are still available.</p> : null}

      </section>
      {detailDialog}
    </>
  );
}

function DayProgressRings({ summary, hasLogs }: { summary: DailySummary | undefined; hasLogs: boolean }) {
  const calories = summary && hasLogs ? calorieRing(summary) : null;
  const protein = summary && hasLogs ? proteinRing(summary) : null;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)]" viewBox="0 0 48 48">
      <ProgressRing metric="calories" radius={20} strokeWidth={3} ring={calories} />
      <ProgressRing metric="protein" radius={15.5} strokeWidth={3} ring={protein} />
    </svg>
  );
}

function ProgressRing({ metric, radius, strokeWidth, ring }: { metric: "calories" | "protein"; radius: number; strokeWidth: number; ring: RingProgress | null }) {
  const circumference = 2 * Math.PI * radius;
  const progress = ring?.progress ?? null;
  const offset = progress === null ? circumference : circumference * (1 - progress / 100);

  return (
    <>
      <circle
        className="stroke-slate-200 dark:stroke-slate-700"
        cx="24"
        cy="24"
        data-calendar-ring-track={metric}
        fill="none"
        r={radius}
        strokeWidth={strokeWidth}
      />
      {progress !== null && ring?.tone ? (
        <circle
          className={`calendar-progress-ring ${ringStrokeClasses[ring.tone]}`}
          cx="24"
          cy="24"
          data-calendar-ring={metric}
          data-progress={Number(progress.toFixed(2))}
          data-tone={ring.tone}
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{ "--ring-circumference": circumference, "--ring-offset": offset } as CSSProperties}
        />
      ) : null}
    </>
  );
}

function RingLegend({ label, ring }: { label: string; ring: "outer" | "inner" }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16">
        <circle className="stroke-slate-500 dark:stroke-slate-400" cx="8" cy="8" fill="none" r={ring === "outer" ? 6 : 4} strokeWidth="1.75" />
      </svg>
      {label}
    </span>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${className}`} />{label}</span>;
}

function MacroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950/70">
      <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
