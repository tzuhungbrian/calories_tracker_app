"use client";

import { Activity, BarChart3, Flame, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DailySummary } from "@/lib/types";
import { TrendCharts } from "./trend_charts";

type StatsDashboardProps = {
  rows: DailySummary[];
};

const rangeOptions = [7, 14, 30];

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value);
}

export function StatsDashboard({ rows }: StatsDashboardProps) {
  const [dayRange, setDayRange] = useState(14);
  const scopedRows = useMemo(() => rows.slice(0, dayRange), [dayRange, rows]);
  const averages = useMemo(
    () => ({
      calories: average(scopedRows.map((row) => row.calories)),
      target: average(scopedRows.map((row) => row.calorieTarget)),
      protein: average(scopedRows.map((row) => row.protein)),
      steps: average(scopedRows.map((row) => row.steps))
    }),
    [scopedRows]
  );
  const calorieHitRate = scopedRows.length
    ? Math.round((scopedRows.filter((row) => row.calories <= row.calorieTarget).length / scopedRows.length) * 100)
    : 0;
  const trainingDays = scopedRows.filter((row) => row.strengthSession || row.basketballMinutes > 0).length;
  const macroAverages = [
    { label: "Protein", value: average(scopedRows.map((row) => row.protein)), color: "bg-blue-600" },
    { label: "Fat", value: average(scopedRows.map((row) => row.fat)), color: "bg-emerald-600" },
    { label: "Carbs", value: average(scopedRows.map((row) => row.carbs)), color: "bg-orange-500" }
  ];
  const maxMacro = Math.max(...macroAverages.map((macro) => macro.value), 1);
  const recentBalance = scopedRows.slice(0, 14).reverse();
  const maxBalance = Math.max(...recentBalance.map((row) => Math.abs(row.calories - row.calorieTarget)), 100);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <BarChart3 size={20} />
            Stats
          </h2>
          <p className="mt-1 text-sm text-slate-500">Interactive trends and nutrition patterns.</p>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Flame size={18} />} label="Avg calories" value={`${round(averages.calories)} kcal`} sub={`Target ${round(averages.target)}`} />
        <StatCard icon={<Target size={18} />} label="Target hit rate" value={`${calorieHitRate}%`} sub="Days at or under target" />
        <StatCard icon={<Activity size={18} />} label="Avg steps" value={`${round(averages.steps)}`} sub={`${trainingDays} training days`} />
        <StatCard icon={<Target size={18} />} label="Avg protein" value={`${round(averages.protein)} g`} sub="Daily average" />
      </div>

      <TrendCharts rows={scopedRows} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Average Macros</h2>
          <div className="mt-4 grid gap-3">
            {macroAverages.map((macro) => (
              <div key={macro.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{macro.label}</span>
                  <span className="text-slate-500">{round(macro.value)} g</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${macro.color}`} style={{ width: `${Math.max(6, (macro.value / maxMacro) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Calorie Balance</h2>
          <p className="mt-1 text-sm text-slate-500">Recent daily difference from target.</p>
          <div className="mt-5 flex h-44 items-center gap-2 border-b border-slate-200 pb-1">
            {recentBalance.map((row) => {
              const balance = row.calories - row.calorieTarget;
              const height = Math.max(8, (Math.abs(balance) / maxBalance) * 76);
              return (
                <div key={row.date} className="flex h-full flex-1 flex-col items-center justify-center gap-1">
                  <div className="flex h-32 w-full items-center justify-center">
                    <div
                      className={`w-full max-w-8 rounded-md ${balance > 0 ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ height }}
                      title={`${row.date}: ${round(balance)} kcal`}
                    />
                  </div>
                  <span className="rotate-[-45deg] text-[10px] text-slate-500">{row.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="animate-enter hover-lift rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="rounded-md bg-blue-50 p-2 text-blue-700">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  );
}
