"use client";

import { Check, Clipboard, Download, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useModalAccessibility } from "@/components/use_modal_accessibility";
import type { ToastInput } from "@/components/toast_viewport";
import type { DailyStatus, DashboardData, FoodLog, NutritionTotals } from "@/lib/types";

type AiDietExportProps = {
  today: string;
  dashboard: DashboardData | null;
  logs: FoodLog[];
  status: DailyStatus;
  onNotify?: (toast: ToastInput) => void;
};

const nutrientLabels: Array<{ key: keyof NutritionTotals; label: string; unit: string }> = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" }
];

function round(value: number): number {
  return Math.round(value);
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function formatNutrient(value: number, unit: string): string {
  return `${round(value)} ${unit}`;
}

function formatSigned(value: number, unit: string): string {
  const rounded = round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} ${unit}`;
}

function buildTotalsLines(dashboard: DashboardData | null): string[] {
  if (!dashboard) {
    return ["- Dashboard totals are still loading."];
  }

  return nutrientLabels.map(({ key, label, unit }) => {
    const total = dashboard.totals[key];
    const target = dashboard.targets[key];
    const remaining = dashboard.remaining[key];
    return `- ${label}: ${formatNutrient(total, unit)} / target ${formatNutrient(target, unit)} (${formatSigned(remaining, unit)} remaining)`;
  });
}

function buildFoodLines(logs: FoodLog[], dashboard: DashboardData | null): string[] {
  if (!logs.length) {
    return ["No food has been logged yet today."];
  }

  return logs.map((log, index) => {
    const calorieShare = dashboard && dashboard.totals.calories > 0 ? `, ${Math.round((log.calories / dashboard.totals.calories) * 100)}% of today's calories` : "";
    const aiFlag = log.isAiEstimated ? " [AI estimated]" : "";
    const notes = log.notes?.trim() ? `\n   Notes: ${log.notes.trim()}` : "";

    return `${index + 1}. ${log.meal || "Unassigned meal"} - ${log.foodName}${aiFlag}
   Amount: ${log.amount || "not specified"}
   Macros: ${round(log.calories)} kcal, P ${round(log.protein)}g, F ${round(log.fat)}g, C ${round(log.carbs)}g${calorieShare}${notes}`;
  });
}

function buildAiDietPrompt(today: string, dashboard: DashboardData | null, logs: FoodLog[], status: DailyStatus): string {
  const effectiveStatus = { ...(dashboard?.status ?? status), ...status };
  const exerciseStepGoal = dashboard?.exerciseStepGoal ?? 8000;
  const isTravelDay = effectiveStatus.isTravelDay;

  return [
    "# AI-friendly nutrition log",
    "",
    ...(isTravelDay
      ? [
          "Important context: this date is marked as a travel day.",
          "Ignore this day's food logs, totals, calorie balance, and macro consistency when judging adherence or trend quality.",
          "You may still use the raw entries as background context if helpful.",
          ""
        ]
      : []),
    "Please review this day of eating like a nutrition coach. Tell me:",
    "1. Whether the day fits my goal mode.",
    "2. What I should eat next, if anything.",
    "3. The biggest macro risk today.",
    "4. One simple improvement for tomorrow.",
    "",
    "## Date and goal",
    `- Date: ${today}`,
    `- Goal mode: ${effectiveStatus.goalType}`,
    `- Travel day: ${yesNo(isTravelDay)}`,
    dashboard ? `- Dynamic TDEE: ${round(dashboard.dynamicTdee)} kcal` : "- Dynamic TDEE: loading/not available",
    "",
    "## Totals vs targets",
    ...buildTotalsLines(dashboard),
    "",
    "## Activity and habits",
    `- Steps: ${round(effectiveStatus.steps)} / exercise step goal ${round(exerciseStepGoal)}`,
    `- Strength session: ${yesNo(effectiveStatus.strengthSession)}`,
    `- Basketball minutes: ${round(effectiveStatus.basketballMinutes)}`,
    `- Creatine taken: ${yesNo(effectiveStatus.creatineTaken)}`,
    "",
    "## Food logs",
    ...buildFoodLines(logs, dashboard),
    "",
    "## Context",
    "- This log may include AI-estimated foods, so treat those entries as approximate.",
    ...(isTravelDay ? ["- This travel day should not count against adherence, deficit/surplus, or macro consistency."] : []),
    "- I care about practical next actions more than perfect theory."
  ].join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function copyTextFallback(content: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = content;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }
}

export function AiDietExport({ today, dashboard, logs, status, onNotify }: AiDietExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const todayLogs = useMemo(() => logs.filter((log) => log.date === today), [logs, today]);
  const exportText = useMemo(() => buildAiDietPrompt(today, dashboard, todayLogs, status), [dashboard, status, today, todayLogs]);
  const dialogRef = useModalAccessibility(isOpen, closeDialog);

  function closeDialog() {
    setIsOpen(false);
    setIsCopied(false);
  }

  async function copyExportText() {
    try {
      await navigator.clipboard.writeText(exportText);
      setIsCopied(true);
      onNotify?.({ tone: "success", title: "AI export copied", message: "Today's nutrition log is ready to paste." });
    } catch {
      if (copyTextFallback(exportText)) {
        setIsCopied(true);
        onNotify?.({ tone: "success", title: "AI export copied", message: "Today's nutrition log is ready to paste." });
        return;
      }

      onNotify?.({ tone: "error", title: "Could not copy AI export", message: "Download the text file instead." });
    }
  }

  function downloadExportText() {
    downloadTextFile(`nutrition-log-${today}.txt`, exportText);
    onNotify?.({ tone: "info", title: "AI export downloaded", message: `nutrition-log-${today}.txt` });
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-violet-900/80 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/70"
        title="Export today's food log for AI"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <Sparkles size={17} />
        <span className="hidden xl:inline">Export for AI</span>
        <span className="sr-only xl:hidden">Export for AI</span>
      </button>

      {isOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
          <button aria-label="Close AI export" className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-sm" type="button" onClick={closeDialog} />
          <section
            ref={dialogRef}
            aria-labelledby="ai-export-title"
            aria-modal="true"
            className="mobile-sheet-enter relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-2xl sm:animate-enter-soft sm:rounded-2xl"
            role="dialog"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                  <Sparkles size={18} />
                  <h2 id="ai-export-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Export today for AI</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {today} - {todayLogs.length} food{todayLogs.length === 1 ? "" : "s"}{status.isTravelDay ? " - Travel day" : ""}
                </p>
              </div>
              <button aria-label="Close AI export" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" type="button" onClick={closeDialog}>
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/40 sm:p-5">
              <pre className="min-h-64 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{exportText}</pre>
            </div>

            <footer className="grid shrink-0 grid-cols-[1fr_1fr_auto] gap-2 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:flex sm:justify-end sm:px-5 sm:pb-4">
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800" type="button" onClick={copyExportText}>
                {isCopied ? <Check size={17} /> : <Clipboard size={17} />}
                {isCopied ? "Copied" : "Copy text"}
              </button>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" type="button" onClick={downloadExportText}>
                <Download size={17} />
                <span className="hidden sm:inline">Download .txt</span>
                <span className="sm:hidden">.txt</span>
              </button>
              <button className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" type="button" onClick={closeDialog}>Close</button>
            </footer>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}
