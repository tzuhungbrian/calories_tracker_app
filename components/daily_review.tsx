import { Activity, Beef, CheckCircle2, Flame, Footprints, Lightbulb, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { DailyStatus, DashboardData } from "@/lib/types";

type DailyReviewProps = {
  dashboard: DashboardData | null;
  status: DailyStatus;
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

function calorieGuidance(data: DashboardData): { title: string; body: string; tone: "good" | "warn" | "neutral" } {
  const remaining = data.remaining.calories;
  const goalType = data.status?.goalType ?? "maintain";

  if (goalType === "bulk") {
    return remaining <= 0
      ? { title: "Bulk target reached", body: "You have cleared the calorie target. Keep the rest of the day simple and protein-forward.", tone: "good" }
      : { title: "More fuel needed", body: `You still need about ${round(remaining)} kcal to match today's bulk target.`, tone: "warn" };
  }

  if (remaining < 0) {
    return {
      title: goalType === "cut" ? "Cut target exceeded" : "Target exceeded",
      body: "Keep the next meal light: lean protein, vegetables, and low added fat will limit extra drift.",
      tone: "warn"
    };
  }

  if (remaining <= 250) {
    return { title: "Small buffer left", body: `You have about ${round(remaining)} kcal left. A controlled snack fits better than a full meal.`, tone: "neutral" };
  }

  return { title: "Room for a meal", body: `About ${round(remaining)} kcal remain. Build the next meal around protein first.`, tone: "good" };
}

function proteinGuidance(data: DashboardData): { title: string; body: string; tone: "good" | "warn" } {
  const gap = data.remaining.protein;

  return gap <= 0
    ? { title: "Protein covered", body: `Protein is ${Math.abs(round(gap))}g above target. Calories and carbs matter more from here.`, tone: "good" }
    : { title: "Protein still matters", body: `Aim for about ${round(gap)}g more protein before the day ends.`, tone: "warn" };
}

function macroGuardrail(data: DashboardData): string {
  const fat = fatRange(data.targets.fat);
  const fatTotal = round(data.totals.fat);
  const carbRemaining = round(data.remaining.carbs);

  if (fatTotal < fat.min) {
    return `Fat is low (${fatTotal}g). You can include a moderate-fat protein or eggs without breaking the model.`;
  }

  if (fatTotal > fat.max) {
    return `Fat is already high (${fatTotal}g). Prefer lean protein and simpler carbs next.`;
  }

  return carbRemaining >= 0 ? `Fat is in range. Carbs have about ${carbRemaining}g left.` : "Fat is in range, but carbs are already over target.";
}

function exerciseGuidance(data: DashboardData, status: DailyStatus): { title: string; body: string; tone: "good" | "warn" } {
  const stepGoal = data.exerciseStepGoal || 8000;
  const exerciseDone = status.strengthSession || status.basketballMinutes > 0 || status.steps > stepGoal;

  if (exerciseDone) {
    return { title: "Exercise checked", body: "Exercise habit is complete through lifting, basketball, or steps.", tone: "good" };
  }

  return {
    title: "Exercise still open",
    body: `${Math.max(0, round(stepGoal + 1 - status.steps))} more steps would close it, or log lifting/basketball.`,
    tone: "warn"
  };
}

export function DailyReview({ dashboard, status }: DailyReviewProps) {
  if (!dashboard) {
    return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">Loading daily review...</section>;
  }

  const effectiveStatus = dashboard.status ?? status;
  const calorie = calorieGuidance(dashboard);
  const protein = proteinGuidance(dashboard);
  const exercise = exerciseGuidance(dashboard, effectiveStatus);
  const mode = effectiveStatus.goalType ?? "maintain";

  return (
    <section className="animate-enter rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Lightbulb size={20} className="text-blue-700" />
            Daily review
          </h2>
          <p className="mt-1 text-sm text-slate-500">What the numbers say about the rest of today.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold capitalize text-blue-700">
          <Target size={15} />
          {mode} mode
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ReviewCard icon={<Flame size={18} />} title={calorie.title} body={calorie.body} tone={calorie.tone} />
        <ReviewCard icon={<Beef size={18} />} title={protein.title} body={protein.body} tone={protein.tone} />
        <ReviewCard icon={<Footprints size={18} />} title={exercise.title} body={exercise.body} tone={exercise.tone} />
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <p className="inline-flex items-center gap-2 font-semibold text-slate-800">
          <Activity size={16} />
          Macro guardrail
        </p>
        <p className="mt-1">{macroGuardrail(dashboard)}</p>
      </div>
    </section>
  );
}

function ReviewCard({
  icon,
  title,
  body,
  tone
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone: "good" | "warn" | "neutral";
}) {
  const styles = {
    good: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    warn: "border-amber-100 bg-amber-50/80 text-amber-700",
    neutral: "border-blue-100 bg-blue-50/70 text-blue-700"
  };

  return (
    <div className={`rounded-lg border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2">
        {tone === "good" ? <CheckCircle2 size={18} /> : icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-600">{body}</p>
    </div>
  );
}
