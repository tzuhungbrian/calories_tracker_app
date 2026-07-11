"use client";

import { AlertCircle, BarChart3, CalendarCheck, CheckCircle2, Database, MoreHorizontal, ReceiptText, RefreshCw, Settings, Sprout, Utensils, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { ToastViewport } from "@/components/toast_viewport";
import { TodayDesktopWorkbench } from "@/components/today_desktop_workbench";
import { useModalAccessibility } from "@/components/use_modal_accessibility";
import { dateKey } from "@/lib/date";
import type { ToastInput, AppToast } from "@/components/toast_viewport";
import type { CommonFood, DailyStatus, DailySummary, DashboardData, FoodLog, FoodLogInput } from "@/lib/types";

const tabs = [
  { id: "stats", label: "Dashboard", icon: BarChart3 },
  { id: "dashboard", label: "Today", icon: CalendarCheck },
  { id: "logs", label: "Logs", icon: ReceiptText },
  { id: "foods", label: "Foods", icon: Database },
  { id: "prep", label: "Meal prep", icon: Utensils },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

const tabDescriptions: Record<AppTab, string> = {
  stats: "Progress and nutrition trends",
  dashboard: "Log food and update today",
  logs: "Review and edit food history",
  foods: "Manage saved foods",
  prep: "Build reusable meal portions",
  settings: "Profile, targets, and data"
};

export type AppTab = (typeof tabs)[number]["id"];

export const tabRoutes: Record<AppTab, string> = {
  stats: "/dashboard",
  dashboard: "/today",
  logs: "/logs",
  foods: "/foods",
  prep: "/meal-prep",
  settings: "/settings"
};

function tabFromPathname(pathname: string): AppTab {
  return (Object.entries(tabRoutes).find(([, route]) => route === pathname)?.[0] as AppTab | undefined) ?? "stats";
}

const mobilePrimaryTabIds: AppTab[] = ["stats", "dashboard", "logs"];
const mobileMoreTabIds: AppTab[] = ["foods", "prep", "settings"];
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_REFRESH_COOLDOWN_MS = 15 * 1000;

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
    basketballMinutes: 0,
    isTravelDay: false
  };
}

function formatSyncTime(date: Date | null): string {
  if (!date) {
    return "Not synced yet";
  }

  return `Last synced ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function TrackerApp({ initialTab = "stats" }: { initialTab?: AppTab }) {
  const [today, setToday] = useState(() => getTodayKey());
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [commonFoods, setCommonFoods] = useState<CommonFood[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [foodLog, setFoodLog] = useState<FoodLogInput>(() => createEmptyFoodLog(today));
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>(() => createEmptyStatus(today));
  const [isSavingFood, setIsSavingFood] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isUndoingDatabaseFood, setIsUndoingDatabaseFood] = useState(false);
  const [mealPrepEditRequest, setMealPrepEditRequest] = useState<{ food: CommonFood; requestId: number } | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [hasUnsavedSettings, setHasUnsavedSettings] = useState(false);
  const moreMenuDialogRef = useModalAccessibility(isMoreMenuOpen, () => setIsMoreMenuOpen(false));
  const lastAutoRefreshAtRef = useRef(0);
  const isAutoRefreshingRef = useRef(false);

  useEffect(() => {
    function handleHistoryChange() {
      setActiveTab(tabFromPathname(window.location.pathname));
      setIsMoreMenuOpen(false);
    }

    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: ToastInput) => {
    const id = toast.id ?? crypto.randomUUID();
    setToasts((current) => [...current.filter((item) => item.id !== id), { ...toast, id }].slice(-4));
    return id;
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
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
      setLastSyncedAt(new Date());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load nutrition data.";
      setRefreshError(message);
      throw loadError;
    } finally {
      setIsRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    refreshData().catch((loadError: unknown) => {
      addToast({
        tone: "error",
        title: "Could not load app data",
        message: loadError instanceof Error ? loadError.message : "Failed to load app data."
      });
    });
  }, [addToast, refreshData]);

  const autoRefreshData = useCallback(
    async (force = false) => {
      if (document.visibilityState !== "visible" || isSavingFood || isSavingStatus || isUndoingDatabaseFood || isAutoRefreshingRef.current) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastAutoRefreshAtRef.current < AUTO_REFRESH_COOLDOWN_MS) {
        return;
      }

      isAutoRefreshingRef.current = true;
      lastAutoRefreshAtRef.current = now;
      try {
        await refreshData();
      } catch (loadError) {
        addToast({
          tone: "error",
          title: "Refresh failed",
          message: loadError instanceof Error ? loadError.message : "Failed to refresh app data."
        });
      } finally {
        isAutoRefreshingRef.current = false;
      }
    },
    [addToast, isSavingFood, isSavingStatus, isUndoingDatabaseFood, refreshData]
  );

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void autoRefreshData(true);
      }
    }

    function refreshWhenFocused() {
      void autoRefreshData();
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenFocused);
    const intervalId = window.setInterval(() => {
      void autoRefreshData();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenFocused);
      window.clearInterval(intervalId);
    };
  }, [autoRefreshData]);

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
    try {
      const response = await fetch("/api/daily_log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(foodLog)
      });

      if (!response.ok) {
        throw new Error("Failed to save food log.");
      }
      const savedLog = (await response.json()) as FoodLog;

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
        addToast({
          tone: "success",
          title: "Saved to food database",
          message: savedFood.name,
          actionLabel: "Undo",
          onAction: () => void undoDatabaseFood(savedFood)
        });
      }

      setFoodLogs((current) => [savedLog, ...current.filter((log) => log.id !== savedLog.id)]);
      setFoodLog({ ...createEmptyFoodLog(today), meal: savedLog.meal });
      await refreshData();
      addToast({
        tone: "success",
        title: "Food added",
        message: `${savedLog.foodName} · ${savedLog.meal}`,
        actionLabel: "Undo",
        onAction: () => void undoFoodLogs([savedLog])
      });
      return true;
    } catch (saveError) {
      addToast({
        tone: "error",
        title: "Could not save food",
        message: saveError instanceof Error ? saveError.message : "Failed to save food log."
      });
      return false;
    } finally {
      setIsSavingFood(false);
    }
  }

  async function saveFoodLogs(logs: FoodLogInput[]): Promise<boolean> {
    if (!logs.length) {
      return false;
    }

    setIsSavingFood(true);
    try {
      const savedLogs: FoodLog[] = [];
      for (const log of logs) {
        const response = await fetch("/api/daily_log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(log)
        });

        if (!response.ok) {
          throw new Error("Failed to save one or more food logs.");
        }
        savedLogs.push((await response.json()) as FoodLog);
      }

      setFoodLogs((current) => [...savedLogs, ...current.filter((log) => !savedLogs.some((saved) => saved.id === log.id))]);
      setFoodLog({ ...createEmptyFoodLog(today), meal: logs[0]?.meal ?? "" });
      await refreshData();
      addToast({
        tone: "success",
        title: "Foods added",
        message: `${logs.length} items saved to ${logs[0]?.meal || "the selected meal"}.`,
        actionLabel: "Undo",
        onAction: () => void undoFoodLogs(savedLogs)
      });
      return true;
    } catch (saveError) {
      addToast({
        tone: "error",
        title: "Could not save foods",
        message: saveError instanceof Error ? saveError.message : "Failed to save food logs."
      });
      return false;
    } finally {
      setIsSavingFood(false);
    }
  }

  async function undoFoodLogs(logs: FoodLog[]) {
    try {
      await Promise.all(
        logs.map(async (log) => {
          const response = await fetch(`/api/daily_log?id=${encodeURIComponent(log.id)}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to remove an added food log.");
        })
      );
      setFoodLogs((current) => current.filter((log) => !logs.some((removed) => removed.id === log.id)));
      await refreshData();
      addToast({ tone: "info", title: "Food addition undone", message: `${logs.length} item${logs.length === 1 ? "" : "s"} removed.` });
    } catch (undoError) {
      addToast({ tone: "error", title: "Could not undo", message: undoError instanceof Error ? undoError.message : "Failed to remove food logs." });
    }
  }

  async function undoDatabaseFood(food: CommonFood) {
    setIsUndoingDatabaseFood(true);

    try {
      const response = await fetch(`/api/foods?id=${encodeURIComponent(food.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to undo added database food.");
      }

      await refreshData();
      addToast({
        tone: "info",
        title: "Database food removed",
        message: food.name
      });
    } catch (undoError) {
      addToast({
        tone: "error",
        title: "Undo failed",
        message: undoError instanceof Error ? undoError.message : "Failed to undo added database food."
      });
    } finally {
      setIsUndoingDatabaseFood(false);
    }
  }

  async function loadDailyStatusForDate(date: string) {
    try {
      const response = await fetch(`/api/daily_status?date=${date}`);

      if (!response.ok) {
        throw new Error("Failed to load daily status.");
      }

      const statusData = (await response.json()) as DailyStatus | null;
      setDailyStatus(statusData ?? createEmptyStatus(date));
    } catch (loadError) {
      addToast({
        tone: "error",
        title: "Could not load daily status",
        message: loadError instanceof Error ? loadError.message : "Failed to load daily status."
      });
    }
  }

  async function saveDailyStatus() {
    setIsSavingStatus(true);
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
      addToast({
        tone: "error",
        title: "Could not save status",
        message: saveError instanceof Error ? saveError.message : "Failed to save daily status."
      });
    } finally {
      setIsSavingStatus(false);
    }
  }

  function editFoodAsMealPrep(food: CommonFood) {
    setMealPrepEditRequest({ food, requestId: Date.now() });
    selectTab("prep");
  }

  function selectTab(tabId: AppTab) {
    if (activeTab === "settings" && tabId !== "settings" && hasUnsavedSettings && !window.confirm("Discard unsaved settings changes?")) return;
    const nextRoute = tabRoutes[tabId];
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({ tab: tabId }, "", nextRoute);
    }
    setActiveTab(tabId);
    setIsMoreMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const mobilePrimaryTabs = tabs.filter((tab) => mobilePrimaryTabIds.includes(tab.id));
  const mobileMoreTabs = tabs.filter((tab) => mobileMoreTabIds.includes(tab.id));
  const isMoreTabActive = mobileMoreTabIds.includes(activeTab);
  const activeMoreTab = tabs.find((tab) => tab.id === activeTab && mobileMoreTabIds.includes(tab.id));
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const activeTabMeta = tabs[activeTabIndex] ?? tabs[0];
  const syncPill = isRefreshing
    ? { label: "Refreshing...", icon: RefreshCw, className: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200", spin: true }
    : refreshError
      ? { label: "Sync issue", icon: AlertCircle, className: "border-red-100 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200", spin: false }
      : { label: formatSyncTime(lastSyncedAt), icon: CheckCircle2, className: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200", spin: false };
  const SyncIcon = syncPill.icon;
  const ActiveTabIcon = activeTabMeta.icon;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] overflow-x-hidden">
        <aside
          className="fixed inset-y-0 z-20 hidden w-52 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex dark:border-slate-800 dark:bg-slate-950"
          style={{ left: "max(0px, calc((100vw - 1500px) / 2))" }}
        >
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              <Sprout size={30} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Calories</p>
              <p className="text-xs text-slate-500">Brian&apos;s tracker</p>
            </div>
          </div>
          <nav className="relative grid gap-2">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-lg bg-blue-50 shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-blue-950/70"
              style={{ transform: `translateY(${activeTabIndex * 56}px)` }}
            />
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`relative z-10 flex h-12 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${activeTab === id ? "text-blue-700 dark:text-blue-200" : "text-slate-600 hover:text-ink dark:text-slate-400 dark:hover:text-white"}`}
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

        <section className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-[calc(7.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:ml-52 lg:px-6 lg:py-5 xl:px-8">
          <header className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ActiveTabIcon className="shrink-0 text-blue-700 dark:text-blue-300" size={20} />
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{activeTabMeta.label}</h1>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-500">{tabDescriptions[activeTab]} · {today}</p>
            </div>
            <div className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition sm:text-sm ${syncPill.className}`}>
              <SyncIcon className={syncPill.spin ? "animate-spin" : ""} size={16} />
              {syncPill.label}
            </div>
          </header>

          {activeTab === "dashboard" ? (
            <div className="flex flex-col gap-6 animate-enter" key="dashboard-tab">
              <div className="flex flex-col gap-6 xl:hidden">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">Today</h2>
                  <p className="mt-1 text-sm text-slate-500">Log food, update activity, and keep today accurate.</p>
                </section>
                <section className="grid gap-4">
                  <FoodLogComposer foods={commonFoods} recentLogs={foodLogs} value={foodLog} isSaving={isSavingFood} onChange={setFoodLog} onSubmit={saveFoodLog} onSubmitMany={saveFoodLogs} />
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
                onFoodLogsSubmit={saveFoodLogs}
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
              <FoodLogManager foods={commonFoods} logs={foodLogs} today={today} onChanged={refreshData} onNotify={addToast} />
            </div>
          ) : activeTab === "foods" ? (
            <div className="animate-enter" key="foods-tab">
              <FoodDatabaseManager foods={commonFoods} logs={foodLogs} onChanged={refreshData} onEditMealPrep={editFoodAsMealPrep} />
            </div>
          ) : activeTab === "settings" ? (
            <div className="animate-enter" key="settings-tab">
              <SettingsPanel onChanged={refreshData} onDirtyChange={setHasUnsavedSettings} />
            </div>
          ) : (
            <div className="animate-enter" key="prep-tab">
              <MealPrepCalculator editRequest={mealPrepEditRequest} foods={commonFoods} onChanged={refreshData} />
            </div>
          )}
        </section>
      </div>

      {isMoreMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
          <button
            aria-label="Close navigation menu"
            className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
            type="button"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div ref={moreMenuDialogRef} className="mobile-sheet-enter absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
          {mobilePrimaryTabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition ${isActive ? "text-blue-700 dark:text-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}`}
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
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
