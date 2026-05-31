"use client";

import { BarChart3, Database, LineChart, ReceiptText, Settings, Sprout, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DailyStatusEditor } from "@/components/daily_status_editor";
import { DashboardCards } from "@/components/dashboard_cards";
import { FoodDatabaseManager } from "@/components/food_database_manager";
import { FoodLogComposer } from "@/components/food_log_composer";
import { FoodLogManager } from "@/components/food_log_manager";
import { MealPrepCalculator } from "@/components/meal_prep_calculator";
import { SettingsPanel } from "@/components/settings_panel";
import { StatsDashboard } from "@/components/stats_dashboard";
import { SummaryTable } from "@/components/summary_table";
import { ThemeToggle } from "@/components/theme_toggle";
import { dateKey } from "@/lib/date";
import type { CommonFood, DailyStatus, DailySummary, DashboardData, FoodLog, FoodLogInput } from "@/lib/types";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "stats", label: "Stats", icon: LineChart },
  { id: "logs", label: "Logs", icon: ReceiptText },
  { id: "foods", label: "Foods", icon: Database },
  { id: "prep", label: "Meal prep", icon: Utensils },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

type AppTab = (typeof tabs)[number]["id"];

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
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [commonFoods, setCommonFoods] = useState<CommonFood[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [foodLog, setFoodLog] = useState<FoodLogInput>(() => createEmptyFoodLog(today));
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>(() => createEmptyStatus(today));
  const [isSavingFood, setIsSavingFood] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
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

  async function saveFoodLog() {
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
      }

      setFoodLog(createEmptyFoodLog(today));
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save food log.");
    } finally {
      setIsSavingFood(false);
    }
  }

  async function saveDailyStatus() {
    setIsSavingStatus(true);
    setError(null);
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save daily status.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);

  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-48 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-6 lg:flex">
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
                onClick={() => setActiveTab(id)}
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
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">{today}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Brian&apos;s nutrition tracker</h1>
              <p className="mt-1 text-sm text-slate-500">Track your progress and build healthy habits.</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 lg:hidden">
              <div className="max-w-full overflow-x-auto">
                <div className="relative inline-grid min-w-[780px] grid-cols-6 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:min-w-0">
                  <span
                    className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%_-_0.5rem)/6)] rounded-md bg-ink shadow-sm transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(${Math.max(activeTabIndex, 0) * 100}%)` }}
                  />
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      className={`relative z-10 rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-300 ${activeTab === id ? "text-white" : "text-slate-600 hover:text-ink"}`}
                      type="button"
                      onClick={() => setActiveTab(id)}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Icon size={16} />
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <ThemeToggle />
            </div>
          </header>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : null}

          {activeTab === "dashboard" ? (
            <div className="flex flex-col gap-6 animate-enter" key="dashboard-tab">
              <DashboardCards data={dashboard} />

              <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <FoodLogComposer foods={commonFoods} value={foodLog} isSaving={isSavingFood} onChange={setFoodLog} onSubmit={saveFoodLog} />
                <DailyStatusEditor value={dailyStatus} isSaving={isSavingStatus} onChange={setDailyStatus} onSubmit={saveDailyStatus} />
              </section>

              <SummaryTable rows={summary} />
            </div>
          ) : activeTab === "stats" ? (
            <div className="animate-enter" key="stats-tab">
              <StatsDashboard rows={summary} />
            </div>
          ) : activeTab === "logs" ? (
            <div className="animate-enter" key="logs-tab">
              <FoodLogManager logs={foodLogs} today={today} onChanged={refreshData} />
            </div>
          ) : activeTab === "foods" ? (
            <div className="animate-enter" key="foods-tab">
              <FoodDatabaseManager foods={commonFoods} onChanged={refreshData} />
            </div>
          ) : activeTab === "settings" ? (
            <div className="animate-enter" key="settings-tab">
              <SettingsPanel onChanged={refreshData} />
            </div>
          ) : (
            <div className="animate-enter" key="prep-tab">
              <MealPrepCalculator foods={commonFoods} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
