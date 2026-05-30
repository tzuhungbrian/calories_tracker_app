import { Beef, Flame, Leaf, Wheat } from "lucide-react";
import type { DashboardData, NutritionTotals } from "@/lib/types";

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

export function DashboardCards({ data }: DashboardCardsProps) {
  if (!data) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4">Loading dashboard...</div>;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {labels.map((label) => (
        <div key={label} className="animate-enter hover-lift rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm capitalize text-slate-500">{label}</p>
            <div className="rounded-md bg-blue-50 p-2 text-blue-700">
              {(() => {
                const Icon = icons[label];
                return <Icon size={18} />;
              })()}
            </div>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-semibold">{Math.round(data.totals[label])}</p>
            <p className="text-sm text-slate-500">target {Math.round(data.targets[label])}</p>
          </div>
          <p className="mt-3 text-sm font-medium text-blue-700">
            Remaining: {Math.round(data.remaining[label])}
          </p>
        </div>
      ))}
    </section>
  );
}
