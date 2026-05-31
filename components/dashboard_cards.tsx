import { Beef, Flame, Leaf, Wheat } from "lucide-react";
import type { DashboardData, GoalType, NutritionTotals } from "@/lib/types";

type DashboardCardsProps = {
  data: DashboardData | null;
};

const labels: Array<keyof NutritionTotals> = ["calories", "protein", "fat", "carbs"];
const icons = {
  calories: Flame,
  protein: Beef,
  fat: Leaf,
  carbs: Wheat
};

type CardTone = "good" | "warning" | "neutral";

const toneStyles: Record<CardTone, { card: string; icon: string; remaining: string; badge: string }> = {
  good: {
    card: "border-emerald-200 bg-emerald-50/60",
    icon: "bg-emerald-100 text-emerald-700",
    remaining: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700"
  },
  warning: {
    card: "border-red-200 bg-red-50/60",
    icon: "bg-red-100 text-red-700",
    remaining: "text-red-700",
    badge: "bg-red-100 text-red-700"
  },
  neutral: {
    card: "border-slate-200 bg-white",
    icon: "bg-blue-50 text-blue-700",
    remaining: "text-blue-700",
    badge: "bg-slate-100 text-slate-600"
  }
};

function fatRange(target: number): { min: number; max: number } {
  return {
    min: Math.round(target * 0.8),
    max: Math.round(target * 1.2)
  };
}

function cardStatus(label: keyof NutritionTotals, data: DashboardData): { tone: CardTone; message: string; targetLabel: string } {
  const total = data.totals[label];
  const target = data.targets[label];
  const remaining = data.remaining[label];
  const goalType: GoalType = data.status?.goalType ?? "maintain";

  if (label === "protein") {
    return total >= target
      ? { tone: "good", message: "Protein hit", targetLabel: `target ${Math.round(target)}` }
      : { tone: "warning", message: "Protein low", targetLabel: `target ${Math.round(target)}` };
  }

  if (label === "fat") {
    const range = fatRange(target);
    const inRange = total >= range.min && total <= range.max;
    return {
      tone: inRange ? "good" : "warning",
      message: inRange ? "In range" : total < range.min ? "Fat low" : "Fat high",
      targetLabel: `${range.min}-${range.max}g range`
    };
  }

  if (goalType === "bulk") {
    return remaining <= 0
      ? { tone: "good", message: "Bulk target hit", targetLabel: `target ${Math.round(target)}` }
      : { tone: "warning", message: "Needs more", targetLabel: `target ${Math.round(target)}` };
  }

  return remaining >= 0
    ? { tone: "good", message: goalType === "cut" ? "On cut target" : "On target", targetLabel: `target ${Math.round(target)}` }
    : { tone: "warning", message: "Over target", targetLabel: `target ${Math.round(target)}` };
}

export function DashboardCards({ data }: DashboardCardsProps) {
  if (!data) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4">Loading dashboard...</div>;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {labels.map((label) => {
        const Icon = icons[label];
        const status = cardStatus(label, data);
        const tone = toneStyles[status.tone];

        return (
          <div key={label} className={`animate-enter hover-lift rounded-lg border p-4 shadow-sm ${tone.card}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm capitalize text-slate-500">{label}</p>
              <div className={`rounded-md p-2 ${tone.icon}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-semibold">{Math.round(data.totals[label])}</p>
              <p className="text-sm text-slate-500">{status.targetLabel}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className={`text-sm font-medium ${tone.remaining}`}>Remaining: {Math.round(data.remaining[label])}</p>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone.badge}`}>{status.message}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
