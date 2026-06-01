"use client";

import { CalendarDays, Pencil, Save, Search, Trash2, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import type { CommonFood, FoodLog } from "@/lib/types";

type FoodLogManagerProps = {
  logs: FoodLog[];
  foods: CommonFood[];
  today: string;
  onChanged: () => Promise<void>;
};

const meals = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout"];
const macroFields: Array<keyof Pick<FoodLog, "calories" | "protein" | "fat" | "carbs">> = [
  "calories",
  "protein",
  "fat",
  "carbs"
];

type FoodLogTotals = Pick<FoodLog, "calories" | "protein" | "fat" | "carbs">;
type MacroBaseline = FoodLogTotals;

function sortLogs(logs: FoodLog[]): FoodLog[] {
  return [...logs].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function emptyTotals(): FoodLogTotals {
  return { calories: 0, protein: 0, fat: 0, carbs: 0 };
}

function addLogToTotals(totals: FoodLogTotals, log: FoodLog): FoodLogTotals {
  return {
    calories: totals.calories + log.calories,
    protein: totals.protein + log.protein,
    fat: totals.fat + log.fat,
    carbs: totals.carbs + log.carbs
  };
}

function percentOfDay(value: number, total: number): number {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseAmountMultiplier(amount: string): number | null {
  const trimmedAmount = amount.trim();
  if (!trimmedAmount) {
    return 1;
  }

  const amountNumber = Number(trimmedAmount);
  return Number.isFinite(amountNumber) ? amountNumber : null;
}

function createMacroBaseline(log: FoodLog, foods: CommonFood[]): MacroBaseline {
  const matchingFood = log.foodId ? foods.find((food) => food.id === log.foodId) : null;
  if (matchingFood) {
    return {
      calories: matchingFood.calories,
      protein: matchingFood.protein,
      fat: matchingFood.fat,
      carbs: matchingFood.carbs
    };
  }

  const amountMultiplier = parseAmountMultiplier(log.amount);
  if (amountMultiplier && amountMultiplier > 0) {
    return {
      calories: log.calories / amountMultiplier,
      protein: log.protein / amountMultiplier,
      fat: log.fat / amountMultiplier,
      carbs: log.carbs / amountMultiplier
    };
  }

  return {
    calories: log.calories,
    protein: log.protein,
    fat: log.fat,
    carbs: log.carbs
  };
}

function scaleMacros(baseline: MacroBaseline, amount: string): FoodLogTotals | null {
  const amountMultiplier = parseAmountMultiplier(amount);
  if (amountMultiplier === null) {
    return null;
  }

  return {
    calories: roundMacro(baseline.calories * amountMultiplier),
    protein: roundMacro(baseline.protein * amountMultiplier),
    fat: roundMacro(baseline.fat * amountMultiplier),
    carbs: roundMacro(baseline.carbs * amountMultiplier)
  };
}

function findMatchingFood(log: FoodLog, foods: CommonFood[]): CommonFood | null {
  return foods.find((food) => (log.foodId && food.id === log.foodId) || food.name.toLowerCase() === log.foodName.toLowerCase()) ?? null;
}

export function FoodLogManager({ logs, foods, today, onChanged }: FoodLogManagerProps) {
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);
  const [macroBaseline, setMacroBaseline] = useState<MacroBaseline | null>(null);
  const [dateFilter, setDateFilter] = useState(today);
  const [mealFilter, setMealFilter] = useState("");
  const [query, setQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sortLogs(logs)
      .filter((log) => !dateFilter || log.date === dateFilter)
      .filter((log) => !mealFilter || log.meal === mealFilter)
      .filter((log) => !normalizedQuery || log.foodName.toLowerCase().includes(normalizedQuery) || log.notes?.toLowerCase().includes(normalizedQuery));
  }, [dateFilter, logs, mealFilter, query]);

  const dayTotals = useMemo(
    () => logs.filter((log) => log.date === dateFilter).reduce(addLogToTotals, emptyTotals()),
    [dateFilter, logs]
  );

  const totalsByDate = useMemo(
    () =>
      logs.reduce<Record<string, FoodLogTotals>>((totals, log) => {
        totals[log.date] = addLogToTotals(totals[log.date] ?? emptyTotals(), log);
        return totals;
      }, {}),
    [logs]
  );

  function editLog(log: FoodLog) {
    const matchingFood = findMatchingFood(log, foods);
    setSelectedLog({
      ...log,
      notes: log.notes?.trim() ? log.notes : matchingFood?.notes ?? ""
    });
    setMacroBaseline(createMacroBaseline(log, foods));
    setMessage("");
    setError(null);
  }

  function updateField(field: keyof FoodLog, value: string) {
    setSelectedLog((current) => {
      if (!current) {
        return current;
      }

      const updatedLog = {
        ...current,
        [field]: macroFields.includes(field as (typeof macroFields)[number]) ? Number(value) || 0 : value
      };

      if (field === "amount" && macroBaseline) {
        const scaledMacros = scaleMacros(macroBaseline, value);
        if (scaledMacros) {
          return {
            ...updatedLog,
            ...scaledMacros
          };
        }
      }

      return updatedLog;
    });
  }

  async function saveLog() {
    if (!selectedLog) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError(null);

    try {
      const response = await fetch("/api/daily_log", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedLog)
      });

      if (!response.ok) {
        throw new Error("Failed to update food log.");
      }

      const updatedLog = (await response.json()) as FoodLog;
      setSelectedLog(updatedLog);
      setMacroBaseline(createMacroBaseline(updatedLog, foods));
      setMessage("Food log updated.");
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update food log.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLog() {
    if (!selectedLog || !window.confirm(`Delete "${selectedLog.foodName}" from ${selectedLog.date}?`)) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError(null);

    try {
      const response = await fetch(`/api/daily_log?id=${encodeURIComponent(selectedLog.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete food log.");
      }

      setSelectedLog(null);
      setMacroBaseline(null);
      setMessage("Food log deleted.");
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete food log.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Utensils size={20} />
              Food log manager
            </h2>
            <p className="mt-1 text-sm text-slate-500">Edit meals and see each food&apos;s share of that day&apos;s nutrition.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-2 text-center text-xs font-semibold text-slate-600">
            <span>{Math.round(dayTotals.calories)} kcal</span>
            <span>P {Math.round(dayTotals.protein)}</span>
            <span>F {Math.round(dayTotals.fat)}</span>
            <span>C {Math.round(dayTotals.carbs)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[170px_170px_1fr]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={16} />
              Date
            </span>
            <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Meal
            <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={mealFilter} onChange={(event) => setMealFilter(event.target.value)}>
              <option value="">All meals</option>
              {meals.map((meal) => (
                <option key={meal} value={meal}>
                  {meal}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <Search size={16} />
              Search
            </span>
            <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Search food or notes" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="mt-4 grid max-h-[640px] gap-2 overflow-y-auto pr-1">
          {visibleLogs.length > 0 ? (
            visibleLogs.map((log) => {
              const logDayTotals = totalsByDate[log.date] ?? emptyTotals();

              return (
                <button
                  key={log.id}
                  className={`hover-lift rounded-lg border p-3 text-left transition hover:border-accent hover:bg-blue-50 ${selectedLog?.id === log.id ? "border-accent bg-blue-50" : "border-slate-200"}`}
                  type="button"
                  onClick={() => editLog(log)}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{log.foodName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.date} / {log.meal || "No meal"} / {log.amount || "1 serving"}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{Math.round(log.calories)} kcal</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-slate-700">
                    <span>Protein {log.protein}g</span>
                    <span>Fat {log.fat}g</span>
                    <span>Carbs {log.carbs}g</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-4">
                    <PercentChip label="Calories" percent={percentOfDay(log.calories, logDayTotals.calories)} />
                    <PercentChip label="Protein" percent={percentOfDay(log.protein, logDayTotals.protein)} />
                    <PercentChip label="Fat" percent={percentOfDay(log.fat, logDayTotals.fat)} />
                    <PercentChip label="Carbs" percent={percentOfDay(log.carbs, logDayTotals.carbs)} />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No food logs match this filter.</div>
          )}
        </div>
      </div>

      <aside className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
          <Pencil size={20} />
          Edit logged food
        </h2>

        {selectedLog ? (
          <>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Date
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" type="date" value={selectedLog.date} onChange={(event) => updateField("date", event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Meal
                <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={selectedLog.meal} onChange={(event) => updateField("meal", event.target.value)}>
                  <option value="">Select meal</option>
                  {meals.map((meal) => (
                    <option key={meal} value={meal}>
                      {meal}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Food name
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={selectedLog.foodName} onChange={(event) => updateField("foodName", event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Amount
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={selectedLog.amount} onChange={(event) => updateField("amount", event.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {macroFields.map((field) => (
                  <label key={field} className="grid gap-1 text-sm font-medium capitalize text-slate-700">
                    {field}
                    <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="0" step="0.1" type="number" value={selectedLog[field]} onChange={(event) => updateField(field, event.target.value)} />
                  </label>
                ))}
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Notes
                <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 font-normal" value={selectedLog.notes ?? ""} onChange={(event) => updateField("notes", event.target.value)} />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isSaving || !selectedLog.foodName} type="button" onClick={saveLog}>
                <span className="inline-flex items-center gap-2">
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save changes"}
                </span>
              </button>
              <button className="rounded-md border border-red-200 px-4 py-2 font-semibold text-red-600 disabled:opacity-60" disabled={isSaving} type="button" onClick={deleteLog}>
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={16} />
                  Delete
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">Choose a logged food from the list to edit it.</div>
        )}

        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}
      </aside>
    </section>
  );
}

function PercentChip({ label, percent }: { label: string; percent: number }) {
  return (
    <span className="rounded-md bg-slate-50 px-2.5 py-2">
      {label} <span className="text-blue-700">{percent}%</span>
    </span>
  );
}
