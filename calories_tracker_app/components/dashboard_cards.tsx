import type { DashboardData, NutritionTotals } from "@/lib/types";

type DashboardCardsProps = {
  data: DashboardData | null;
};

const labels: Array<keyof NutritionTotals> = ["calories", "protein", "fat", "carbs"];

export function DashboardCards({ data }: DashboardCardsProps) {
  if (!data) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4">Loading dashboard...</div>;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {labels.map((label) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm capitalize text-slate-500">{label}</p>
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
