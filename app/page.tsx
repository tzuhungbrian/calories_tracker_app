"use client";

import { BarChart3, Database, LineChart, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DailyStatusEditor } from "@/components/daily_status_editor";
import { DashboardCards } from "@/components/dashboard_cards";
import { FoodDatabaseManager } from "@/components/food_database_manager";
import { FoodLogComposer } from "@/components/food_log_composer";
import { MealPrepCalculator } from "@/components/meal_prep_calculator";
import { StatsDashboard } from "@/components/stats_dashboard";
import { SummaryTable } from "@/components/summary_table";
import { ThemeToggle } from "@/components/theme_toggle";
import { dateKey } from "@/lib/date";
import type { CommonFood, DailyStatus, DailySummary, DashboardData, FoodLogInput } from "@/lib/types";

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
    notes: ""
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "stats" | "prep" | "foods">("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [commonFoods, setCommonFoods] = useState<CommonFood[]>([]);
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [foodLog, setFoodLog] = useState<FoodLogInput>(() => createEmptyFoodLog(today));
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>(() => createEmptyStatus(today));
  const [isSavingFood, setIsSavingFood] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setError(null);
    const [dashboardResponse, foodsResponse, statusResponse, summaryResponse] = await Promise.all([
      fetch(`/api/dashboard?date=${today}`),
      fetch("/api/common_foods"),
      fetch(`/api/daily_status?date=${today}`),
      fetch("/api/summary?days=30")
    ]);

    if (!dashboardResponse.ok || !foodsResponse.ok || !statusResponse.ok || !summaryResponse.ok) {
      throw new Error("Failed to load nutrition data.");
    }

    const [dashboardData, foodsData, statusData, summaryData] = await Promise.all([
      dashboardResponse.json() as Promise<DashboardData>,
      foodsResponse.json() as Promise<CommonFood[]>,
      statusResponse.json() as Promise<DailyStatus | null>,
      summaryResponse.json() as Promise<DailySummary[]>
    ]);

    setDashboard(dashboardData);
    setCommonFoods(foodsData);
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">{today}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Brian&apos;s nutrition tracker</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-grid rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-4">
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === "dashboard" ? "bg-ink text-white" : "text-slate-600"}`}
              type="button"
              onClick={() => setActiveTab("dashboard")}
            >
              <span className="inline-flex items-center gap-2">
                <BarChart3 size={16} />
                Dashboard
              </span>
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === "stats" ? "bg-ink text-white" : "text-slate-600"}`}
              type="button"
              onClick={() => setActiveTab("stats")}
            >
              <span className="inline-flex items-center gap-2">
                <LineChart size={16} />
                Stats
              </span>
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === "foods" ? "bg-ink text-white" : "text-slate-600"}`}
              type="button"
              onClick={() => setActiveTab("foods")}
            >
              <span className="inline-flex items-center gap-2">
                <Database size={16} />
                Foods
              </span>
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === "prep" ? "bg-ink text-white" : "text-slate-600"}`}
              type="button"
              onClick={() => setActiveTab("prep")}
            >
              <span className="inline-flex items-center gap-2">
                <Utensils size={16} />
                Meal prep
              </span>
            </button>
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

          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <FoodLogComposer foods={commonFoods} value={foodLog} isSaving={isSavingFood} onChange={setFoodLog} onSubmit={saveFoodLog} />
            <DailyStatusEditor value={dailyStatus} isSaving={isSavingStatus} onChange={setDailyStatus} onSubmit={saveDailyStatus} />
          </section>

          <SummaryTable rows={summary} />
        </div>
      ) : activeTab === "stats" ? (
        <div className="animate-enter" key="stats-tab">
          <StatsDashboard rows={summary} />
        </div>
      ) : activeTab === "foods" ? (
        <div className="animate-enter" key="foods-tab">
          <FoodDatabaseManager foods={commonFoods} onChanged={refreshData} />
        </div>
      ) : (
        <div className="animate-enter" key="prep-tab">
          <MealPrepCalculator foods={commonFoods} />
        </div>
      )}
    </main>
  );
}
