import type { DailySummary } from "@/lib/types";

type TrendChartsProps = {
  rows: DailySummary[];
};

type SeriesKey = "calories" | "calorieTarget" | "dynamicTdee" | "protein" | "proteinGoal";

type Series = {
  key: SeriesKey;
  label: string;
  color: string;
};

const chartWidth = 920;
const chartHeight = 280;
const padding = { top: 28, right: 28, bottom: 58, left: 54 };

const calorieSeries: Series[] = [
  { key: "calories", label: "Calories", color: "#0f6a8f" },
  { key: "calorieTarget", label: "Target", color: "#f97316" },
  { key: "dynamicTdee", label: "TDEE", color: "#166534" }
];

const proteinSeries: Series[] = [
  { key: "protein", label: "Protein", color: "#0f6a8f" },
  { key: "proteinGoal", label: "Goal", color: "#f97316" }
];

function formatDate(date: string): string {
  return date.slice(5);
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function TrendChart({
  title,
  rows,
  series,
  yMax
}: {
  title: string;
  rows: DailySummary[];
  series: Series[];
  yMax: number;
}) {
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const orderedRows = [...rows].reverse();
  const xStep = orderedRows.length > 1 ? plotWidth / (orderedRows.length - 1) : plotWidth;
  const yTicks = Array.from({ length: 4 }, (_, index) => Math.round((yMax / 3) * index));

  function xFor(index: number): number {
    return padding.left + index * xStep;
  }

  function yFor(value: number): number {
    return padding.top + plotHeight - (Math.max(0, value) / yMax) * plotHeight;
  }

  return (
    <section className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg className="min-w-[760px]" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={title}>
          {yTicks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="#d6dbe3" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" className="fill-slate-600 text-xs">
                  {tick}
                </text>
              </g>
            );
          })}
          {orderedRows.map((row, index) => {
            const x = xFor(index);
            return (
              <g key={row.date}>
                <line x1={x} x2={x} y1={padding.top} y2={padding.top + plotHeight} stroke="#e5e7eb" />
                <text x={x} y={chartHeight - 18} textAnchor="end" transform={`rotate(-45 ${x} ${chartHeight - 18})`} className="fill-slate-600 text-xs">
                  {formatDate(row.date)}
                </text>
              </g>
            );
          })}
          <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} stroke="#94a3b8" />
          <line x1={padding.left} x2={chartWidth - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke="#94a3b8" />
          {series.map((item) => {
            const points = orderedRows.map((row, index) => ({
              x: xFor(index),
              y: yFor(row[item.key])
            }));
            return (
              <g key={item.key}>
                <path d={buildLinePath(points)} fill="none" stroke={item.color} strokeWidth="3" />
                {points.map((point, index) => (
                  <circle key={`${item.key}-${orderedRows[index].date}`} cx={point.x} cy={point.y} r="5" fill={item.color} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export function TrendCharts({ rows }: TrendChartsProps) {
  const maxCalories = Math.max(...rows.flatMap((row) => [row.calories, row.calorieTarget, row.dynamicTdee]), 3000);
  const maxProtein = Math.max(...rows.flatMap((row) => [row.protein, row.proteinGoal]), 150);

  return (
    <div className="grid gap-4">
      <TrendChart title="Calories, Target and TDEE" rows={rows} series={calorieSeries} yMax={Math.ceil(maxCalories / 500) * 500} />
      <TrendChart title="Recent Protein vs Goal" rows={rows} series={proteinSeries} yMax={Math.ceil(maxProtein / 25) * 25} />
    </div>
  );
}
