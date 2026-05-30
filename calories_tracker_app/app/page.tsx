"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CommonFoodSelector } from "@/components/common_food_selector";
import { DailyStatusEditor } from "@/components/daily_status_editor";
import { DashboardCards } from "@/components/dashboard_cards";
import { FoodLogForm } from "@/components/food_log_form";
import { SummaryTable } from "@/components/summary_table";
import type { CommonFood, DailyStatus, DailySummary, DashboardData, FoodLogInput } from "@/lib/types";

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
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
  const today = useMemo(() => getTodayKey(), []);
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
      fetch("/api/summary?days=14")
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
      <header>
        <p className="text-sm font-medium text-blue-700">{today}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Brian&apos;s nutrition tracker</h1>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <DashboardCards data={dashboard} />

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <CommonFoodSelector foods={commonFoods} onSelect={(food) => setFoodLog((current) => ({ ...current, ...food }))} />
          <FoodLogForm value={foodLog} isSaving={isSavingFood} onChange={setFoodLog} onSubmit={saveFoodLog} />
        </div>
        <DailyStatusEditor value={dailyStatus} isSaving={isSavingStatus} onChange={setDailyStatus} onSubmit={saveDailyStatus} />
      </section>

      <SummaryTable rows={summary} />
    </main>
  );
}
