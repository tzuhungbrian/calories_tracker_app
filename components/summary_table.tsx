import type { DailySummary } from "@/lib/types";

type SummaryTableProps = {
  rows: DailySummary[];
};

export function SummaryTable({ rows }: SummaryTableProps) {
  return (
    <div className="animate-enter-soft overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold">Recent 14 days</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Calories</th>
              <th className="px-4 py-3">Protein</th>
              <th className="px-4 py-3">Fat</th>
              <th className="px-4 py-3">Carbs</th>
              <th className="px-4 py-3">Goal</th>
              <th className="px-4 py-3">Steps</th>
              <th className="px-4 py-3">Training</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{row.date}</td>
                <td className="px-4 py-3">{Math.round(row.calories)}</td>
                <td className="px-4 py-3">{Math.round(row.protein)}</td>
                <td className="px-4 py-3">{Math.round(row.fat)}</td>
                <td className="px-4 py-3">{Math.round(row.carbs)}</td>
                <td className="px-4 py-3">{row.goalType || "-"}</td>
                <td className="px-4 py-3">{row.steps}</td>
                <td className="px-4 py-3">{row.strengthSession ? "Strength" : "-"} / {row.basketballMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
