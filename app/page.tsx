"use client";

import { BarChart3, CalendarCheck, Database, MoreHorizontal, ReceiptText, RotateCcw, Settings, Sprout, Utensils, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AiDietExport } from "@/components/ai_diet_export";
import { DailyStatusEditor } from "@/components/daily_status_editor";
import { DailyReview } from "@/components/daily_review";
import { FoodDatabaseManager } from "@/components/food_database_manager";
import { FoodLogComposer } from "@/components/food_log_composer";
import { FoodLogManager } from "@/components/food_log_manager";
import { LogoutButton } from "@/components/logout_button";
import { MealPrepCalculator } from "@/components/meal_prep_calculator";
import { SettingsPanel } from "@/components/settings_panel";
import { StatsDashboard } from "@/components/stats_dashboard";
import { ThemeToggle } from "@/components/theme_toggle";
import { TodayDesktopWorkbench } from "@/components/today_desktop_workbench";
import { dateKey } from "@/lib/date";
import type { CommonFood, DailyStatus, DailySummary, DashboardData, FoodLog, FoodLogInput } from "@/lib/types";

const tabs = [
  { id: "stats", label: "Dashboard", icon: BarChart3 },
  { id: "dashboard", label: "Today", icon: CalendarCheck },
  { id: "logs", label: "Logs", icon: ReceiptText },
  { id: "foods", label: "Foods", icon: Database },
  { id: "prep", label: "Meal prep", icon: Utensils },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

type AppTab = (typeof tabs)[number]["id"];

const mobilePrimaryTabIds: AppTab[] = ["stats", "dashboard", "logs"];
const mobileMoreTabIds: AppTab[] = ["foods", "prep", "settings"];

function getTodayKey(): string {
  return dateKey();
}

function createEmptyFoodLog(date: string): FoodLogInput {
  return {
    date,
    meal: "",
    foodName: "",
    amount: "",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    notes: "",
    isAiEstimated: false,
    saveToDatabase: false,
    databaseCategory: ""
  };
}

function createEmptyStatus(date: string): DailyStatus {
  return {
    date,
    goalType: "maintain",
    steps: 0,
    strengthSession: false,
    creatineTaken: false,
    basketballMinutes: 0
  };
}

export default function HomePage() {
  const [today, setToday] = useState(() => getTodayKey());
  const [activeTab, setActiveTab] = useState<AppTab>("stats");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [commonFoods, setCommonFoods] = useState<CommonFood[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [foodLog, setFoodLog] = useState<FoodLogInput>(() => createEmptyFoodLog(today));
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>(() => createEmptyStatus(today));
  const [isSavingFood, setIsSavingFood] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isUndoingDatabaseFood, setIsUndoingDatabaseFood] = useState(false);
  const [lastAddedDatabaseFood, setLastAddedDatabaseFood] = useState<CommonFood | null>(null);
  const [databaseFoodMessage, setDatabaseFoodMessage] = useState("");
  const [mealPrepEditRequest, setMealPrepEditRequest] = useState<{ food: CommonFood; requestId: number } | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setError(null);
    const [dashboardResponse, foodsResponse, logsResponse, statusResponse, summaryResponse] = await Promise.all([
      fetch(`/api/dashboard?date=${today}`),
      fetch("/api/common_foods"),
      fetch("/api/daily_log"),
      fetch(`/api/daily_status?date=${today}`),
      fetch("/api/summary?days=30")
    ]);

    if (!dashboardResponse.ok || !foodsResponse.ok || !logsResponse.ok || !statusResponse.ok || !summaryResponse.ok) {
      throw new Error("Failed to load nutrition data.");
    }

    const [dashboardData, foodsData, logsData, statusData, summaryData] = await Promise.all([
      dashboardResponse.json() as Promise<DashboardData>,
      foodsResponse.json() as Promise<CommonFood[]>,
      logsResponse.json() as Promise<FoodLog[]>,
      statusResponse.json() as Promise<DailyStatus | null>,
      summaryResponse.json() as Promise<DailySummary[]>
    ]);

    setDashboard(dashboardData);
    setCommonFoods(foodsData);
    setFoodLogs(logsData);
    setSummary(summaryData);
    setDailyStatus(statusData ?? createEmptyStatus(today));
  }, [today]);

  useEffect(() => {
    refreshData().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load app data.");
    });
  }, [refreshData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextToday = getTodayKey();
      setToday((currentToday) => {
        if (currentToday === nextToday) {
          return currentToday;
        }

        setFoodLog((current) => (current.date === currentToday ? createEmptyFoodLog(nextToday) : current));
        setDailyStatus((current) => (current.date === currentToday ? createEmptyStatus(nextToday) : current));
        return nextToday;
      });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function saveFoodLog(): Promise<boolean> {
    setIsSavingFood(true);
    setError(null);
    try {
      const response = await fetch("/api/daily_log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(foodLog)
      });

      if (!response.ok) {
        throw new Error("Failed to save food log.");
      }

      if (foodLog.saveToDatabase) {
        const foodResponse = await fetch("/api/foods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: foodLog.foodName,
            category: foodLog.databaseCategory || "AI estimates",
            serving: foodLog.amount || "1 serving",
            servingSize: foodLog.amount || "",
            calories: foodLog.calories,
            protein: foodLog.protein,
            fat: foodLog.fat,
            carbs: foodLog.carbs,
            notes: foodLog.isAiEstimated ? "AI estimated macro entry." : foodLog.notes || ""
          })
        });

        if (!foodResponse.ok) {
          throw new Error("Food log was saved, but adding it to the foods database failed.");
        }

        const savedFood = (await foodResponse.json()) as CommonFood;
        setLastAddedDatabaseFood(savedFood);
        setDatabaseFoodMessage(`Saved ${savedFood.name} to foods database.`);
      } else {
        setLastAddedDatabaseFood(null);
        setDatabaseFoodMessage("");
      }

      setFoodLog(createEmptyFoodLog(today));
      await refreshData();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save food log.");
      return false;
    } finally {
      setIsSavingFood(false);
    }
  }

  async function undoLastAddedDatabaseFood() {
    if (!lastAddedDatabaseFood) {
      return;
    }

    setIsUndoingDatabaseFood(true);
    setError(null);

    try {
      const response = await fetch(`/api/foods?id=${encodeURIComponent(lastAddedDatabaseFood.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to undo added database food.");
      }

      await refreshData();
      setDatabaseFoodMessage(`Removed ${lastAddedDatabaseFood.name} from foods database.`);
      setLastAddedDatabaseFood(null);
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Failed to undo added database food.");
    } finally {
      setIsUndoingDatabaseFood(false);
    }
  }

  async function loadDailyStatusForDate(date: string) {
    setError(null);
    try {
      const response = await fetch(`/api/daily_status?date=${date}`);

      if (!response.ok) {
        throw new Error("Failed to load daily status.");
      }

      const statusData = (await response.json()) as DailyStatus | null;
      setDailyStatus(statusData ?? createEmptyStatus(date));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load daily status.");
    }
  }

  async function saveDailyStatus() {
    setIsSavingStatus(true);
    setError(null);
    const savedDate = dailyStatus.date;
    try {
      const response = await fetch("/api/daily_status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dailyStatus)
      });

      if (!response.ok) {
        throw new Error("Failed to save daily status.");
      }

      await refreshData();
      await loadDailyStatusForDate(savedDate);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save daily status.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  function editFoodAsMealPrep(food: CommonFood) {
    setMealPrepEditRequest({ food, requestId: Date.now() });
    setActiveTab("prep");
    setIsMoreMenuOpen(false);
  }

  function selectTab(tabId: AppTab) {
    setActiveTab(tabId);
    setIsMoreMenuOpen(false);
  }

  const mobilePrimaryTabs = tabs.filter((tab) => mobilePrimaryTabIds.includes(tab.id));
  const mobileMoreTabs = tabs.filter((tab) => mobileMoreTabIds.includes(tab.id));
  const isMoreTabActive = mobileMoreTabIds.includes(activeTab);
  const activeMoreTab = tabs.find((tab) => tab.id === activeTab && mobileMoreTabIds.includes(tab.id));

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] overflow-x-hidden">
        <aside
          className="fixed inset-y-0 z-20 hidden w-48 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-6 lg:flex"
          style={{ left: "max(0px, calc((100vw - 1500px) / 2))" }}
        >
          <div className="mb-10 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Sprout size={30} />
            </div>
          </div>
          <nav className="grid gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${activeTab === id ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`}
                type="button"
                onClick={() => selectTab(id)}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-lg px-1 py-2">
            <ThemeToggle />
            <span className="text-sm font-medium text-slate-600">Theme</span>
          </div>
          <LogoutButton />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:ml-48 lg:gap-6 lg:px-8 lg:py-6">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">{today}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Brian&apos;s nutrition tracker</h1>
              <p className="mt-1 text-sm text-slate-500">Track your progress and build healthy habits.</p>
            </div>
          </header>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : null}

          {activeTab === "dashboard" ? (
            <div className="flex flex-col gap-6 animate-enter" key="dashboard-tab">
              {databaseFoodMessage ? (
                <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 sm:flex-row sm:items-center sm:justify-between">
                  <span>{databaseFoodMessage}</span>
                  {lastAddedDatabaseFood ? (
                    <button
                      className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-emerald-700 disabled:opacity-60"
                      disabled={isUndoingDatabaseFood}
                      type="button"
                      onClick={undoLastAddedDatabaseFood}
                    >
                      <RotateCcw size={15} />
                      {isUndoingDatabaseFood ? "Undoing..." : "Undo"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-6 xl:hidden">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">Today</h2>
                  <p className="mt-1 text-sm text-slate-500">Log food, update activity, and keep today accurate.</p>
                </section>
                <section className="grid gap-4">
                  <FoodLogComposer foods={commonFoods} recentLogs={foodLogs} value={foodLog} isSaving={isSavingFood} onChange={setFoodLog} onSubmit={saveFoodLog} />
                  <DailyStatusEditor
                    value={dailyStatus}
                    today={today}
                    isSaving={isSavingStatus}
                    onChange={setDailyStatus}
                    onDateSelect={loadDailyStatusForDate}
                    onSubmit={saveDailyStatus}
                  />
                </section>
                <DailyReview dashboard={dashboard} status={dailyStatus} />
                <AiDietExport today={today} dashboard={dashboard} logs={foodLogs} status={dailyStatus} />
              </div>

              <TodayDesktopWorkbench
                today={today}
                dashboard={dashboard}
                foods={commonFoods}
                logs={foodLogs}
                foodLog={foodLog}
                dailyStatus={dailyStatus}
                isSavingFood={isSavingFood}
                isSavingStatus={isSavingStatus}
                onFoodLogChange={setFoodLog}
                onFoodLogSubmit={saveFoodLog}
                onDailyStatusChange={setDailyStatus}
                onDailyStatusDateSelect={loadDailyStatusForDate}
                onDailyStatusSubmit={saveDailyStatus}
                onOpenLogs={() => selectTab("logs")}
              />
            </div>
          ) : activeTab === "stats" ? (
            <div className="animate-enter" key="stats-tab">
              <StatsDashboard dashboard={dashboard} logs={foodLogs} rows={summary} />
            </div>
          ) : activeTab === "logs" ? (
            <div className="animate-enter" key="logs-tab">
              <FoodLogManager foods={commonFoods} logs={foodLogs} today={today} onChanged={refreshData} />
            </div>
          ) : activeTab === "foods" ? (
            <div className="animate-enter" key="foods-tab">
              <FoodDatabaseManager foods={commonFoods} logs={foodLogs} onChanged={refreshData} onEditMealPrep={editFoodAsMealPrep} />
            </div>
          ) : activeTab === "settings" ? (
            <div className="animate-enter" key="settings-tab">
              <SettingsPanel onChanged={refreshData} />
            </div>
          ) : (
            <div className="animate-enter" key="prep-tab">
              <MealPrepCalculator editRequest={mealPrepEditRequest} foods={commonFoods} onChanged={refreshData} />
            </div>
          )}
        </section>
      </div>

      {isMoreMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            aria-label="Close navigation menu"
            className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
            type="button"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="mobile-sheet-enter absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">More</p>
                <h2 className="text-lg font-semibold">{activeMoreTab ? activeMoreTab.label : "Tools and settings"}</h2>
              </div>
              <button
                aria-label="Close more menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {mobileMoreTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  aria-label={label}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${activeTab === id ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                  type="button"
                  onClick={() => selectTab(id)}
                >
                  <span className="inline-flex items-center gap-3 text-sm font-semibold">
                    <Icon size={19} />
                    {label}
                  </span>
                  <span aria-hidden="true" className="text-xs font-medium text-slate-400">{activeTab === id ? "Open" : "Go"}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-200">App controls</span>
              <div className="flex gap-2">
                <ThemeToggle />
                <LogoutButton compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {mobilePrimaryTabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${isActive ? "text-blue-700 dark:text-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}`}
                type="button"
                onClick={() => selectTab(id)}
              >
                <span className={`absolute inset-x-3 top-1 h-9 rounded-full transition-all duration-300 ease-out ${isActive ? "bg-blue-50 opacity-100 dark:bg-blue-950/70" : "opacity-0"}`} />
                <Icon className="relative z-10" size={21} />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
          <button
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${isMoreTabActive || isMoreMenuOpen ? "text-blue-700 dark:text-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}`}
            type="button"
            onClick={() => setIsMoreMenuOpen((current) => !current)}
          >
            <span className={`absolute inset-x-3 top-1 h-9 rounded-full transition-all duration-300 ease-out ${isMoreTabActive || isMoreMenuOpen ? "bg-blue-50 opacity-100 dark:bg-blue-950/70" : "opacity-0"}`} />
            <MoreHorizontal className="relative z-10" size={22} />
            <span className="relative z-10">{activeMoreTab?.label ?? "More"}</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
