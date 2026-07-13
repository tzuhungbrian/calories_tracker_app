import { Activity, Beef, CheckCircle2, Flame, Footprints, Lightbulb, Plane } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DailyStatus, DashboardData } from "@/lib/types";

type DailyReviewProps = {
  dashboard: DashboardData | null;
  status: DailyStatus;
};

type ReviewTone = "good" | "warn" | "neutral";

type ReviewItem = {
  label: string;
  title: string;
  detail: string;
  value: string;
  tone: ReviewTone;
  Icon: LucideIcon;
};

function round(value: number): number {
  return Math.round(value);
}

function fatRange(target: number): { min: number; max: number } {
  return {
    min: Math.round(target * 0.8),
    max: Math.round(target * 1.2)
  };
}

function calorieGuidance(data: DashboardData): ReviewItem {
  const remaining = data.remaining.calories;
  const goalType = data.status?.goalType ?? "maintain";

  if (goalType === "bulk") {
    return remaining <= 0
      ? { label: "Calories", title: "Bulk target reached", detail: "Keep the rest of the day simple.", value: "Target met", tone: "good", Icon: Flame }
      : { label: "Calories", title: "More fuel needed", detail: "Add a balanced meal or snack.", value: `${round(remaining)} kcal left`, tone: "warn", Icon: Flame };
  }

  if (remaining < 0) {
    return {
      label: "Calories",
      title: goalType === "cut" ? "Cut target exceeded" : "Target exceeded",
      detail: "Keep the next choice light and protein-forward.",
      value: `${Math.abs(round(remaining))} kcal over`,
      tone: "warn",
      Icon: Flame
    };
  }

  if (remaining <= 250) {
    return { label: "Calories", title: "Small buffer left", detail: "A controlled snack fits better than a full meal.", value: `${round(remaining)} kcal left`, tone: "neutral", Icon: Flame };
  }

  return { label: "Calories", title: "Room for a meal", detail: "Build the next meal around protein first.", value: `${round(remaining)} kcal left`, tone: "good", Icon: Flame };
}

function proteinGuidance(data: DashboardData): ReviewItem {
  const gap = data.remaining.protein;

  if (gap <= 0.5) {
    return {
      label: "Protein",
      title: "Protein covered",
      detail: gap < -0.5 ? `${Math.abs(round(gap))}g above target.` : "Target is effectively met.",
      value: "Target met",
      tone: "good",
      Icon: Beef
    };
  }

  return {
    label: "Protein",
    title: "Protein still matters",
    detail: "Prioritize a lean protein source next.",
    value: gap < 1 ? "<1g left" : `${round(gap)}g left`,
    tone: "warn",
    Icon: Beef
  };
}

function exerciseGuidance(data: DashboardData, status: DailyStatus): ReviewItem {
  const stepGoal = data.exerciseStepGoal || 8000;
  const exerciseDone = status.strengthSession || status.basketballMinutes > 0 || status.steps > stepGoal;

  if (exerciseDone) {
    return {
      label: "Exercise",
      title: "Exercise complete",
      detail: "Completed through training, basketball, or steps.",
      value: "Complete",
      tone: "good",
      Icon: Footprints
    };
  }

  return {
    label: "Exercise",
    title: "Exercise still open",
    detail: "Walk more or log today's training.",
    value: `${Math.max(0, round(stepGoal + 1 - status.steps))} steps left`,
    tone: "warn",
    Icon: Footprints
  };
}

function macroGuardrail(data: DashboardData): { message: string; tone: "good" | "warn" } {
  const fat = fatRange(data.targets.fat);
  const fatTotal = round(data.totals.fat);
  const carbRemaining = round(data.remaining.carbs);

  if (fatTotal < fat.min) {
    return { message: `Fat is low at ${fatTotal}g. A moderate-fat protein still fits.`, tone: "warn" };
  }

  if (fatTotal > fat.max) {
    return { message: `Fat is high at ${fatTotal}g. Choose lean protein next.`, tone: "warn" };
  }

  if (carbRemaining < 0) {
    return { message: "Fat is in range, but carbs are over target.", tone: "warn" };
  }

  return { message: `Macros in range - ${carbRemaining}g carbs available.`, tone: "good" };
}

export function DailyReview({ dashboard, status }: DailyReviewProps) {
  if (!dashboard) {
    return (
      <section aria-label="Daily review" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-4 h-36 animate-pulse rounded-lg bg-slate-50 dark:bg-slate-800/70" />
      </section>
    );
  }

  const effectiveStatus = { ...(dashboard.status ?? status), ...status };
  const isTravelDay = effectiveStatus.isTravelDay;
  const items = [calorieGuidance(dashboard), proteinGuidance(dashboard), exerciseGuidance(dashboard, effectiveStatus)];
  const guardrail = macroGuardrail(dashboard);

  return (
    <section aria-labelledby="daily-review-title" className="animate-enter overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="px-4 pb-3 pt-4">
        <h2 id="daily-review-title" className="inline-flex items-center gap-2 text-base font-semibold">
          <Lightbulb size={18} className="text-blue-700 dark:text-blue-300" />
          Daily review
        </h2>
        <p className="mt-1 text-xs text-slate-500">{isTravelDay ? "Travel day context" : "What still deserves attention today"}</p>
      </div>

      {isTravelDay ? (
        <div className="mx-4 mb-4 flex gap-3 rounded-lg border border-sky-100 bg-sky-50/70 p-3 dark:border-sky-900/70 dark:bg-sky-950/30">
          <Plane size={18} className="mt-0.5 shrink-0 text-sky-700 dark:text-sky-300" />
          <div>
            <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">Travel day is not graded</p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Logs remain saved, while adherence and trend judgments ignore this date.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {items.map((item) => <ReviewRow key={item.label} item={item} />)}
          </div>
          <div className={`flex items-start gap-2 px-4 py-3 text-xs ${guardrail.tone === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
            {guardrail.tone === "good" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <Activity size={15} className="mt-0.5 shrink-0" />}
            <p className="leading-5">{guardrail.message}</p>
          </div>
        </>
      )}
    </section>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const styles: Record<ReviewTone, { icon: string; value: string }> = {
    good: { icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", value: "text-emerald-700 dark:text-emerald-300" },
    warn: { icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", value: "text-amber-700 dark:text-amber-300" },
    neutral: { icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", value: "text-blue-700 dark:text-blue-300" }
  };
  const style = styles[item.tone];

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
        {item.tone === "good" ? <CheckCircle2 size={17} /> : <item.Icon size={17} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
        <p className="truncate text-xs text-slate-500">{item.detail}</p>
      </div>
      <p className={`max-w-24 shrink-0 text-right text-xs font-semibold leading-4 ${style.value}`}>{item.value}</p>
    </div>
  );
}
