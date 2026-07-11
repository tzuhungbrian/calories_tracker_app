"use client";

import { Activity, Beef, Flame, Footprints, Gauge, ListChecks, Plane } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { AiDietExport } from "@/components/ai_diet_export";
import { DailyReview } from "@/components/daily_review";
import { DailyStatusEditor } from "@/components/daily_status_editor";
import { FoodLogComposer } from "@/components/food_log_composer";
import type { CommonFood, DailyStatus, DashboardData, FoodLog, FoodLogInput } from "@/lib/types";

type TodayDesktopWorkbenchProps = {
  today: string;
  dashboard: DashboardData | null;
  foods: CommonFood[];
  logs: FoodLog[];
  foodLog: FoodLogInput;
  dailyStatus: DailyStatus;
  isSavingFood: boolean;
  isSavingStatus: boolean;
  onFoodLogChange: (value: FoodLogInput) => void;
  onFoodLogSubmit: () => Promise<boolean>;
  onFoodLogsSubmit: (logs: FoodLogInput[]) => Promise<boolean>;
  onDailyStatusChange: (value: DailyStatus) => void;
  onDailyStatusDateSelect: (date: string) => Promise<void>;
  onDailyStatusSubmit: () => Promise<void>;
  onOpenLogs: () => void;
};

type Tone = "good" | "warn" | "neutral";

const toneStyles: Record<Tone, { card: string; icon: string; bar: string; text: string }> = {
  good: {
    card: "border-emerald-100 bg-emerald-50/70",
    icon: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    text: "text-emerald-700"
  },
  warn: {
    card: "border-amber-100 bg-amber-50/80",
    icon: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
    text: "text-amber-700"
  },
  neutral: {
    card: "border-blue-100 bg-blue-50/70",
    icon: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    text: "text-blue-700"
  }
};

function round(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatSigned(value: number, unit = ""): string {
  const rounded = round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}${unit ? ` ${unit}` : ""}`;
}

function calorieTone(dashboard: DashboardData | null, status: DailyStatus): Tone {
  if (!dashboard) {
    return "neutral";
  }

  if (status.isTravelDay || dashboard.status?.isTravelDay) {
    return "neutral";
  }

  const goalType = dashboard.status?.goalType ?? "maintain";
  const overTarget = dashboard.remaining.calories < 0;
  const underTarget = dashboard.remaining.calories >= 0;

  if (goalType === "bulk") {
    return underTarget ? "warn" : "good";
  }

  if (!overTarget) {
    return "good";
  }

  return dashboard.totals.calories <= dashboard.dynamicTdee ? "neutral" : "warn";
}

export function TodayDesktopWorkbench({
  today,
  dashboard,
  foods,
  logs,
  foodLog,
  dailyStatus,
  isSavingFood,
  isSavingStatus,
  onFoodLogChange,
  onFoodLogSubmit,
  onFoodLogsSubmit,
  onDailyStatusChange,
  onDailyStatusDateSelect,
  onDailyStatusSubmit,
  onOpenLogs
}: TodayDesktopWorkbenchProps) {
  const todayLogs = useMemo(() => logs.filter((log) => log.date === today), [logs, today]);
  const effectiveStatus = { ...(dashboard?.status ?? dailyStatus), ...dailyStatus };
  const caloriesTone = calorieTone(dashboard, effectiveStatus);
  const proteinTone: Tone = dashboard && dashboard.remaining.protein <= 0 ? "good" : dashboard ? "warn" : "neutral";
  const calorieProgress = dashboard && dashboard.targets.calories > 0 ? clamp((dashboard.totals.calories / dashboard.targets.calories) * 100, 0, 125) : 0;
  const proteinProgress = dashboard && dashboard.targets.protein > 0 ? clamp((dashboard.totals.protein / dashboard.targets.protein) * 100, 0, 125) : 0;

  return (
    <div className="hidden animate-enter gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <section className="grid min-w-0 gap-4">
        <section id="today-food-entry" className="grid min-w-0 gap-4">
          <FoodLogComposer foods={foods} recentLogs={logs} value={foodLog} isSaving={isSavingFood} onChange={onFoodLogChange} onSubmit={onFoodLogSubmit} onSubmitMany={onFoodLogsSubmit} />
        </section>
        <TodayLogRail logs={todayLogs} dashboard={dashboard} onOpenLogs={onOpenLogs} />
      </section>

      <aside className="sticky top-5 grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Energy status</p>
              <h2 className="mt-1 text-lg font-semibold capitalize">{effectiveStatus.isTravelDay ? "travel day" : `${effectiveStatus.goalType} day`}</h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              {effectiveStatus.isTravelDay ? <Plane size={20} /> : <Gauge size={20} />}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <MiniMeter
              label="Calories"
              value={dashboard ? `${round(dashboard.totals.calories)} / ${round(dashboard.targets.calories)} kcal` : "Loading"}
              detail={dashboard ? `${formatSigned(dashboard.remaining.calories, "kcal")} remaining` : "Waiting for data"}
              progress={calorieProgress}
              tone={caloriesTone}
            />
            <MiniMeter
              label="Protein"
              value={dashboard ? `${round(dashboard.totals.protein)} / ${round(dashboard.targets.protein)}g` : "Loading"}
              detail={dashboard ? `${formatSigned(dashboard.remaining.protein, "g")} remaining` : "Waiting for data"}
              progress={proteinProgress}
              tone={proteinTone}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MetricPill icon={<Flame size={16} />} label="TDEE" value={dashboard ? `${round(dashboard.dynamicTdee)} kcal` : "--"} />
            <MetricPill icon={<Footprints size={16} />} label="Steps" value={`${round(effectiveStatus.steps)}`} />
          </div>
        </section>

        <DailyStatusEditor
          value={dailyStatus}
          today={today}
          isSaving={isSavingStatus}
          onChange={onDailyStatusChange}
          onDateSelect={onDailyStatusDateSelect}
          onSubmit={onDailyStatusSubmit}
        />
        <DailyReview dashboard={dashboard} status={dailyStatus} />
        <AiDietExport today={today} dashboard={dashboard} logs={logs} status={dailyStatus} />
      </aside>
    </div>
  );
}

function MiniMeter({ label, value, detail, progress, tone }: { label: string; value: string; detail: string; progress: number; tone: Tone }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold">{value}</p>
        </div>
        <p className={`shrink-0 text-xs font-semibold ${toneStyles[tone].text}`}>{detail}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneStyles[tone].bar}`} style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
  );
}

function MetricPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function TodayLogRail({ logs, dashboard, onOpenLogs }: { logs: FoodLog[]; dashboard: DashboardData | null; onOpenLogs: () => void }) {
  const calories = logs.reduce((sum, log) => sum + log.calories, 0);
  const protein = logs.reduce((sum, log) => sum + log.protein, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today log</p>
          <h2 className="mt-1 text-lg font-semibold">{logs.length ? `${logs.length} food${logs.length === 1 ? "" : "s"}` : "No food yet"}</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <ListChecks size={20} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricPill icon={<Flame size={16} />} label="Calories" value={`${round(calories)} kcal`} />
        <MetricPill icon={<Beef size={16} />} label="Protein" value={`${round(protein)}g`} />
      </div>

      <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {logs.length ? (
          logs
            .slice()
            .sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id))
            .slice(0, 10)
            .map((log) => <TodayLogRow key={log.id} log={log} totalCalories={dashboard?.totals.calories ?? calories} />)
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Add your first food and this rail becomes the live receipt for the day.
          </div>
        )}
      </div>

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
        type="button"
        onClick={onOpenLogs}
      >
        <Activity size={16} />
        Manage logs
      </button>
    </section>
  );
}

function TodayLogRow({ log, totalCalories }: { log: FoodLog; totalCalories: number }) {
  const share = totalCalories > 0 ? clamp((log.calories / totalCalories) * 100, 0, 100) : 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{log.foodName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {log.meal || "Meal"} - {log.amount || "Amount not set"}
          </p>
        </div>
        {log.isAiEstimated ? <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">AI</span> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span>{round(log.calories)} kcal</span>
        <span>P {round(log.protein)} / F {round(log.fat)} / C {round(log.carbs)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-1 text-[11px] font-medium text-slate-500">{round(share)}% of today&apos;s calories</p>
    </article>
  );
}
