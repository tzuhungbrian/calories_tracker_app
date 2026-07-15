"use client";

import { CalendarDays, Clock3, Copy, ListChecks, Pencil, Save, Search, SlidersHorizontal, Trash2, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DecimalNumberInput } from "@/components/decimal_number_input";
import { useModalAccessibility } from "@/components/use_modal_accessibility";
import { mealOptions } from "@/lib/food_options";
import type { ToastInput } from "@/components/toast_viewport";
import type { CommonFood, FoodLog } from "@/lib/types";

type FoodLogManagerProps = {
  logs: FoodLog[];
  foods: CommonFood[];
  today: string;
  requestedDate?: string;
  onChanged: () => Promise<void>;
  onDateChange?: (date: string) => void;
  onNotify?: (toast: ToastInput) => void;
};

const macroFields: Array<keyof Pick<FoodLog, "calories" | "protein" | "fat" | "carbs">> = [
  "calories",
  "protein",
  "fat",
  "carbs"
];

type FoodLogTotals = Pick<FoodLog, "calories" | "protein" | "fat" | "carbs">;
type MacroBaseline = FoodLogTotals;
type MealGroup = {
  meal: string;
  logs: FoodLog[];
  totals: FoodLogTotals;
};
type LogDateGroup = {
  date: string;
  logs: FoodLog[];
  totals: FoodLogTotals;
  mealGroups: MealGroup[];
};
type LogSortMode = "newest" | "oldest" | "caloriesDesc" | "proteinDesc" | "foodName";

const mealOrder = new Map<string, number>(mealOptions.map((meal, index) => [meal, index]));

function sortLogs(logs: FoodLog[], sortMode: LogSortMode): FoodLog[] {
  return [...logs].sort((a, b) => {
    if (sortMode === "foodName") {
      return a.foodName.localeCompare(b.foodName) || (b.createdAt || "").localeCompare(a.createdAt || "");
    }

    if (sortMode === "caloriesDesc") {
      return b.calories - a.calories || (b.createdAt || "").localeCompare(a.createdAt || "");
    }

    if (sortMode === "proteinDesc") {
      return b.protein - a.protein || (b.createdAt || "").localeCompare(a.createdAt || "");
    }

    const dateCompare = sortMode === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    return dateCompare || (sortMode === "oldest" ? (a.createdAt || "").localeCompare(b.createdAt || "") : (b.createdAt || "").localeCompare(a.createdAt || ""));
  });
}

function sortDateKeys(dates: string[], sortMode: LogSortMode): string[] {
  return [...dates].sort((a, b) => (sortMode === "oldest" ? a.localeCompare(b) : b.localeCompare(a)));
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

function sortMealGroups(groups: MealGroup[]): MealGroup[] {
  return [...groups].sort((a, b) => {
    const aOrder = mealOrder.get(a.meal) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = mealOrder.get(b.meal) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.meal.localeCompare(b.meal);
  });
}

export function FoodLogManager({ logs, foods, today, requestedDate, onChanged, onDateChange, onNotify }: FoodLogManagerProps) {
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);
  const [macroBaseline, setMacroBaseline] = useState<MacroBaseline | null>(null);
  const [dateFilter, setDateFilter] = useState(requestedDate ?? today);
  const [mealFilter, setMealFilter] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<LogSortMode>("newest");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [mobileActionLog, setMobileActionLog] = useState<FoodLog | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);
  const mobileActionDialogRef = useModalAccessibility(Boolean(mobileActionLog), () => setMobileActionLog(null));

  useEffect(() => {
    if (requestedDate !== undefined) {
      setDateFilter(requestedDate);
    }
  }, [requestedDate]);

  function changeDateFilter(date: string) {
    setDateFilter(date);
    onDateChange?.(date);
  }

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs
      .filter((log) => !dateFilter || log.date === dateFilter)
      .filter((log) => !mealFilter || log.meal === mealFilter)
      .filter((log) => !normalizedQuery || log.foodName.toLowerCase().includes(normalizedQuery) || log.notes?.toLowerCase().includes(normalizedQuery));
  }, [dateFilter, logs, mealFilter, query]);

  const visibleTotals = useMemo(
    () => visibleLogs.reduce(addLogToTotals, emptyTotals()),
    [visibleLogs]
  );

  const groupedLogs = useMemo<LogDateGroup[]>(() => {
    const groups = visibleLogs.reduce<Map<string, FoodLog[]>>((result, log) => {
      const dateLogs = result.get(log.date) ?? [];
      dateLogs.push(log);
      result.set(log.date, dateLogs);
      return result;
    }, new Map());

    return sortDateKeys(Array.from(groups.keys()), sortMode).map((date) => {
      const dateLogs = sortLogs(groups.get(date) ?? [], sortMode);
      const mealGroups = dateLogs.reduce<Map<string, FoodLog[]>>((result, log) => {
        const meal = log.meal || "No meal";
        const mealLogs = result.get(meal) ?? [];
        mealLogs.push(log);
        result.set(meal, mealLogs);
        return result;
      }, new Map());

      return {
        date,
        logs: dateLogs,
        totals: dateLogs.reduce(addLogToTotals, emptyTotals()),
        mealGroups: sortMealGroups(
          Array.from(mealGroups.entries()).map(([meal, mealLogs]) => ({
            meal,
            logs: sortLogs(mealLogs, sortMode),
            totals: mealLogs.reduce(addLogToTotals, emptyTotals())
          }))
        )
      };
    });
  }, [sortMode, visibleLogs]);

  function notify(toast: ToastInput) {
    onNotify?.(toast);
  }

  function editLog(log: FoodLog) {
    const matchingFood = findMatchingFood(log, foods);
    setSelectedLog({
      ...log,
      notes: log.notes?.trim() ? log.notes : matchingFood?.notes ?? ""
    });
    setMacroBaseline(createMacroBaseline(log, foods));
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
      notify({ tone: "success", title: "Food log updated", message: updatedLog.foodName });
      await onChanged();
    } catch (saveError) {
      notify({
        tone: "error",
        title: "Could not update food log",
        message: saveError instanceof Error ? saveError.message : "Failed to update food log."
      });
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
      notify({ tone: "info", title: "Food log deleted", message: log.foodName });
      await onChanged();
    } catch (deleteError) {
      notify({
        tone: "error",
        title: "Could not delete food log",
        message: deleteError instanceof Error ? deleteError.message : "Failed to delete food log."
      });
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
      notify({ tone: "info", title: "Food logs deleted", message: `${selectedLogs.length} selected items removed.` });
      await onChanged();
    } catch (deleteError) {
      notify({
        tone: "error",
        title: "Could not delete selected logs",
        message: deleteError instanceof Error ? deleteError.message : "Failed to delete selected food logs."
      });
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
      notify({ tone: "success", title: "Copied to today", message: `${selectedLogs.length} items added to ${today}.` });
      await onChanged();
    } catch (copyError) {
      notify({
        tone: "error",
        title: "Could not copy logs",
        message: copyError instanceof Error ? copyError.message : "Failed to copy selected food logs."
      });
    } finally {
      setIsSaving(false);
    }
  }

  const selectedLogCount = selectedLogIds.size;
  const filterLabel = dateFilter || "All dates";

  return (
    <section className={`grid min-w-0 gap-4 transition-[grid-template-columns] duration-300 ease-out ${selectedLog ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-1"}`}>
      <div className="animate-enter min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Utensils size={20} />
              Food log manager
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{filterLabel} · {visibleLogs.length} items</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <span>{Math.round(visibleTotals.calories)} kcal</span><span>P {Math.round(visibleTotals.protein)}</span><span>F {Math.round(visibleTotals.fat)}</span><span>C {Math.round(visibleTotals.carbs)}</span>
            </div>
            <button className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold ${isBatchMode ? "bg-ink text-white dark:bg-blue-600" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`} type="button" onClick={toggleBatchMode}>
              <ListChecks size={16} />{isBatchMode ? "Done" : "Batch"}
            </button>
          </div>
        </div>

        <div className="sticky top-0 z-20 mt-4 rounded-lg border border-slate-200 bg-slate-50/95 p-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 ${selectedLog ? "md:grid-cols-[170px_minmax(160px,1fr)_auto]" : "md:grid-cols-[170px_minmax(220px,1fr)_auto_auto]"}`}>
            <input aria-label="Date" className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" type="date" value={dateFilter} onChange={(event) => changeDateFilter(event.target.value)} />
            <label className="relative col-span-2 md:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input aria-label="Search" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Search food or notes" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className={`${selectedLog ? "hidden" : "flex"} gap-1 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900`}>
              <button className={`rounded px-2.5 text-xs font-semibold ${dateFilter === today ? "bg-blue-50 text-blue-700 dark:bg-blue-950" : "text-slate-500"}`} type="button" onClick={() => changeDateFilter(today)}>Today</button>
              <button className={`rounded px-2.5 text-xs font-semibold ${!dateFilter ? "bg-blue-50 text-blue-700 dark:bg-blue-950" : "text-slate-500"}`} type="button" onClick={() => changeDateFilter("")}>All</button>
            </div>
            <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold ${isFiltersOpen || mealFilter ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`} type="button" onClick={() => setIsFiltersOpen((current) => !current)}>
              <SlidersHorizontal size={16} /> Filters
            </button>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ${isFiltersOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="min-h-0 overflow-hidden">
              <div className="grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-2 dark:border-slate-800">
                <label className="grid gap-1 text-xs font-semibold text-slate-500">Meal
                  <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={mealFilter} onChange={(event) => setMealFilter(event.target.value)}>
              <option value="">All meals</option>
              {mealOptions.map((meal) => (
                <option key={meal} value={meal}>
                  {meal}
                </option>
              ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-500">Sort
                  <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={sortMode} onChange={(event) => setSortMode(event.target.value as LogSortMode)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="caloriesDesc">Highest calories</option>
              <option value="proteinDesc">Highest protein</option>
              <option value="foodName">Food name A-Z</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>

        {isBatchMode ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/70">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <ListChecks size={16} className="text-blue-700" />
            {selectedLogCount} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" type="button" onClick={selectVisibleLogs}>
              Select visible
            </button>
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" disabled={!selectedLogCount} type="button" onClick={clearSelectedLogs}>
              Clear
            </button>
            <button className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50" disabled={isSaving || !selectedLogCount} type="button" onClick={copySelectedLogsToToday}>
              <span className="inline-flex items-center gap-1.5">
                <Copy size={15} />
                Copy to today
              </span>
            </button>
            <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300" disabled={isSaving || !selectedLogCount} type="button" onClick={deleteSelectedLogs}>
              Delete selected
            </button>
          </div>
        </div>
        ) : null}

        <div className="mt-4 grid max-h-[640px] min-w-0 gap-4 overflow-y-auto pr-1">
          {groupedLogs.length > 0 ? (
            groupedLogs.map((group) => (
              <section key={group.date} className="animate-enter-soft rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <CalendarDays size={16} className="text-blue-700" />
                      {group.date}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{group.logs.length} logged items</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-white p-2 text-center text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <span>{Math.round(group.totals.calories)} kcal</span>
                    <span>P {Math.round(group.totals.protein)}</span>
                    <span>F {Math.round(group.totals.fat)}</span>
                    <span>C {Math.round(group.totals.carbs)}</span>
                  </div>
                </div>
                <div className="relative mt-4 grid gap-4 pl-5 before:absolute before:bottom-3 before:left-2 before:top-3 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                  {group.mealGroups.map((mealGroup) => (
                    <section key={`${group.date}-${mealGroup.meal}`} className="relative">
                      <span className="absolute -left-[1.08rem] top-2 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow-sm dark:border-slate-950" />
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              <Clock3 size={15} className="text-blue-700 dark:text-blue-300" />
                              {mealGroup.meal}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{mealGroup.logs.length} items in this meal</p>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-50 p-2 text-center text-[11px] font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                            <span>{Math.round(mealGroup.totals.calories)} kcal</span>
                            <span>P {Math.round(mealGroup.totals.protein)}</span>
                            <span>F {Math.round(mealGroup.totals.fat)}</span>
                            <span>C {Math.round(mealGroup.totals.carbs)}</span>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {mealGroup.logs.map((log) => (
                            <div
                              key={log.id}
                              className={`rounded-xl border bg-white p-3 transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-blue-50 hover:shadow-sm dark:bg-slate-950 dark:hover:bg-blue-950/30 ${selectedLog?.id === log.id ? "border-accent bg-blue-50 dark:bg-blue-950/40" : selectedLogIds.has(log.id) ? "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-800"}`}
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
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{log.amount || "1 serving"}</p>
                                  </button>
                                </div>
                                <span className="w-fit rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">{Math.round(log.calories)} kcal</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                <span>P {roundMacro(log.protein)}g</span><span>F {roundMacro(log.fat)}g</span><span>C {roundMacro(log.carbs)}g</span>
                                <span className="text-blue-700 dark:text-blue-300">{percentOfDay(log.calories, group.totals.calories)}% of day</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No food logs match this filter.</div>
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
          <div ref={mobileActionDialogRef} className="mobile-sheet-enter absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl">
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

      {selectedLog ? (
      <aside className="animate-enter min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Pencil size={20} />Edit logged food</h2>
          <button aria-label="Close editor" className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-500 dark:border-slate-700" type="button" onClick={() => setSelectedLog(null)}><X size={17} /></button>
        </div>
          <>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Date
                <input className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" type="date" value={selectedLog.date} onChange={(event) => updateField("date", event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Meal
                <select className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={selectedLog.meal} onChange={(event) => updateField("meal", event.target.value)}>
                  <option value="">Select meal</option>
                  {mealOptions.map((meal) => (
                    <option key={meal} value={meal}>
                      {meal}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Food name
                <input className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={selectedLog.foodName} onChange={(event) => updateField("foodName", event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Amount
                <input className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={selectedLog.amount} onChange={(event) => updateField("amount", event.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {macroFields.map((field) => (
                  <label key={field} className="grid gap-1 text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
                    {field}
                    <DecimalNumberInput className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={selectedLog[field]} onValueChange={(nextValue) => updateField(field, String(nextValue))} />
                  </label>
                ))}
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Notes
                <textarea className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={selectedLog.notes ?? ""} onChange={(event) => updateField("notes", event.target.value)} />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isSaving || !selectedLog.foodName} type="button" onClick={saveLog}>
                <span className="inline-flex items-center gap-2">
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save changes"}
                </span>
              </button>
              <button className="rounded-md border border-red-200 px-4 py-2 font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-300" disabled={isSaving} type="button" onClick={deleteLog}>
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={16} />
                  Delete
                </span>
              </button>
            </div>
          </>
      </aside>
      ) : null}
    </section>
  );
}
