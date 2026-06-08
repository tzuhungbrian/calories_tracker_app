"use client";

import { CalendarDays, Copy, ListChecks, Pencil, Save, Search, Trash2, Utensils } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DecimalNumberInput } from "@/components/decimal_number_input";
import { mealOptions } from "@/lib/food_options";
import type { CommonFood, FoodLog } from "@/lib/types";

type FoodLogManagerProps = {
  logs: FoodLog[];
  foods: CommonFood[];
  today: string;
  onChanged: () => Promise<void>;
};

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
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mobileActionLog, setMobileActionLog] = useState<FoodLog | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);

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

  function toggleLogSelection(logId: string) {
    setSelectedLogIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }

  function selectVisibleLogs() {
    setSelectedLogIds(new Set(visibleLogs.map((log) => log.id).filter(Boolean)));
  }

  function clearSelectedLogs() {
    setSelectedLogIds(new Set());
  }

  function toggleBatchMode() {
    setIsBatchMode((current) => {
      if (current) {
        clearSelectedLogs();
      }
      return !current;
    });
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

  function startLogLongPress(log: FoodLog) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      suppressNextClickRef.current = true;
      setMobileActionLog(log);
    }, 550);
  }

  function cancelLogLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleLogClick(log: FoodLog) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (isBatchMode) {
      toggleLogSelection(log.id);
    } else {
      editLog(log);
    }
  }

  async function deleteLogById(log: FoodLog) {
    if (!window.confirm(`Delete "${log.foodName}" from ${log.date}?`)) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError(null);

    try {
      const response = await fetch(`/api/daily_log?id=${encodeURIComponent(log.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete food log.");
      }

      if (selectedLog?.id === log.id) {
        setSelectedLog(null);
        setMacroBaseline(null);
      }
      setMobileActionLog(null);
      setMessage("Food log deleted.");
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete food log.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLog() {
    if (!selectedLog) {
      return;
    }

    await deleteLogById(selectedLog);
  }

  async function deleteSelectedLogs() {
    const selectedLogs = logs.filter((log) => selectedLogIds.has(log.id));
    if (!selectedLogs.length || !window.confirm(`Delete ${selectedLogs.length} selected food logs?`)) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError(null);

    try {
      await Promise.all(
        selectedLogs.map((log) =>
          fetch(`/api/daily_log?id=${encodeURIComponent(log.id)}`, {
            method: "DELETE"
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Failed to delete selected food logs.");
            }
          })
        )
      );

      if (selectedLog && selectedLogIds.has(selectedLog.id)) {
        setSelectedLog(null);
        setMacroBaseline(null);
      }
      clearSelectedLogs();
      setMessage(`Deleted ${selectedLogs.length} food logs.`);
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete selected food logs.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copySelectedLogsToToday() {
    const selectedLogs = logs.filter((log) => selectedLogIds.has(log.id));
    if (!selectedLogs.length || !window.confirm(`Copy ${selectedLogs.length} selected food logs to ${today}?`)) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError(null);

    try {
      await Promise.all(
        selectedLogs.map((log) =>
          fetch("/api/daily_log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: today,
              meal: log.meal,
              foodId: log.foodId,
              foodName: log.foodName,
              amount: log.amount,
              calories: log.calories,
              protein: log.protein,
              fat: log.fat,
              carbs: log.carbs,
              notes: log.notes,
              isAiEstimated: log.isAiEstimated
            })
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Failed to copy selected food logs.");
            }
          })
        )
      );

      clearSelectedLogs();
      setMessage(`Copied ${selectedLogs.length} food logs to today.`);
      await onChanged();
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Failed to copy selected food logs.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedLogCount = selectedLogIds.size;

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="animate-enter min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
          <button
            className={`inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${isBatchMode ? "bg-ink text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            type="button"
            onClick={toggleBatchMode}
          >
            <ListChecks size={16} />
            {isBatchMode ? "Done" : "Batch"}
          </button>
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
              {mealOptions.map((meal) => (
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

        {isBatchMode ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ListChecks size={16} className="text-blue-700" />
            {selectedLogCount} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600" type="button" onClick={selectVisibleLogs}>
              Select visible
            </button>
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50" disabled={!selectedLogCount} type="button" onClick={clearSelectedLogs}>
              Clear
            </button>
            <button className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50" disabled={isSaving || !selectedLogCount} type="button" onClick={copySelectedLogsToToday}>
              <span className="inline-flex items-center gap-1.5">
                <Copy size={15} />
                Copy to today
              </span>
            </button>
            <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50" disabled={isSaving || !selectedLogCount} type="button" onClick={deleteSelectedLogs}>
              Delete selected
            </button>
          </div>
        </div>
        ) : null}

        <div className="mt-4 grid max-h-[640px] min-w-0 gap-2 overflow-y-auto pr-1">
          {visibleLogs.length > 0 ? (
            visibleLogs.map((log) => {
              const logDayTotals = totalsByDate[log.date] ?? emptyTotals();

              return (
                <div
                  key={log.id}
                  className={`rounded-lg border p-3 transition hover:border-accent hover:bg-blue-50 hover:shadow-sm ${selectedLog?.id === log.id ? "border-accent bg-blue-50" : selectedLogIds.has(log.id) ? "border-blue-200 bg-blue-50/60" : "border-slate-200"}`}
                  onTouchCancel={cancelLogLongPress}
                  onTouchEnd={cancelLogLongPress}
                  onTouchMove={cancelLogLongPress}
                  onTouchStart={() => startLogLongPress(log)}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      {isBatchMode ? (
                        <input
                          aria-label={`Select ${log.foodName}`}
                          className="mt-1"
                          checked={selectedLogIds.has(log.id)}
                          type="checkbox"
                          onChange={() => toggleLogSelection(log.id)}
                        />
                      ) : null}
                      <button className="min-w-0 text-left" type="button" onClick={() => handleLogClick(log)}>
                        <p className="font-semibold">{log.foodName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {log.date} / {log.meal || "No meal"} / {log.amount || "1 serving"}
                        </p>
                      </button>
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
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No food logs match this filter.</div>
          )}
        </div>
      </div>

      {mobileActionLog ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Food log actions">
          <button
            aria-label="Close food log actions"
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm"
            type="button"
            onClick={() => setMobileActionLog(null)}
          />
          <div className="mobile-sheet-enter absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Log actions</p>
            <h3 className="mt-1 text-lg font-semibold">{mobileActionLog.foodName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {mobileActionLog.date} / {mobileActionLog.meal || "No meal"} / {mobileActionLog.amount || "1 serving"}
            </p>
            <div className="mt-4 grid gap-2">
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
                type="button"
                onClick={() => {
                  editLog(mobileActionLog);
                  setMobileActionLog(null);
                }}
              >
                <Pencil size={16} />
                Edit item
              </button>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                type="button"
                onClick={() => {
                  toggleLogSelection(mobileActionLog.id);
                  setIsBatchMode(true);
                  setMobileActionLog(null);
                }}
              >
                <ListChecks size={16} />
                Select item
              </button>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:opacity-60"
                disabled={isSaving}
                type="button"
                onClick={() => deleteLogById(mobileActionLog)}
              >
                <Trash2 size={16} />
                Delete item
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <aside className="animate-enter min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
                  {mealOptions.map((meal) => (
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
                    <DecimalNumberInput className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={selectedLog[field]} onValueChange={(nextValue) => updateField(field, String(nextValue))} />
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
