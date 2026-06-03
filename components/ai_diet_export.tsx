"use client";

import { Check, Clipboard, Download, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { DailyStatus, DashboardData, FoodLog, NutritionTotals } from "@/lib/types";

type AiDietExportProps = {
  today: string;
  dashboard: DashboardData | null;
  logs: FoodLog[];
  status: DailyStatus;
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
    const calorieShare =
      dashboard && dashboard.totals.calories > 0 ? `, ${Math.round((log.calories / dashboard.totals.calories) * 100)}% of today's calories` : "";
    const aiFlag = log.isAiEstimated ? " [AI estimated]" : "";
    const notes = log.notes?.trim() ? `\n   Notes: ${log.notes.trim()}` : "";

    return `${index + 1}. ${log.meal || "Unassigned meal"} - ${log.foodName}${aiFlag}
   Amount: ${log.amount || "not specified"}
   Macros: ${round(log.calories)} kcal, P ${round(log.protein)}g, F ${round(log.fat)}g, C ${round(log.carbs)}g${calorieShare}${notes}`;
  });
}

function buildAiDietPrompt(today: string, dashboard: DashboardData | null, logs: FoodLog[], status: DailyStatus): string {
  const effectiveStatus = dashboard?.status ?? status;
  const exerciseStepGoal = dashboard?.exerciseStepGoal ?? 8000;
  const foodLines = buildFoodLines(logs, dashboard);
  const totalsLines = buildTotalsLines(dashboard);

  return [
    "# AI-friendly nutrition log",
    "",
    "Please review this day of eating like a nutrition coach. Tell me:",
    "1. Whether the day fits my goal mode.",
    "2. What I should eat next, if anything.",
    "3. The biggest macro risk today.",
    "4. One simple improvement for tomorrow.",
    "",
    "## Date and goal",
    `- Date: ${today}`,
    `- Goal mode: ${effectiveStatus.goalType}`,
    dashboard ? `- Dynamic TDEE: ${round(dashboard.dynamicTdee)} kcal` : "- Dynamic TDEE: loading/not available",
    "",
    "## Totals vs targets",
    ...totalsLines,
    "",
    "## Activity and habits",
    `- Steps: ${round(effectiveStatus.steps)} / exercise step goal ${round(exerciseStepGoal)}`,
    `- Strength session: ${yesNo(effectiveStatus.strengthSession)}`,
    `- Basketball minutes: ${round(effectiveStatus.basketballMinutes)}`,
    `- Creatine taken: ${yesNo(effectiveStatus.creatineTaken)}`,
    "",
    "## Food logs",
    ...foodLines,
    "",
    "## Context",
    "- This log may include AI-estimated foods, so treat those entries as approximate.",
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

export function AiDietExport({ today, dashboard, logs, status }: AiDietExportProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const todayLogs = useMemo(() => logs.filter((log) => log.date === today), [logs, today]);
  const exportText = useMemo(() => buildAiDietPrompt(today, dashboard, todayLogs, status), [dashboard, status, today, todayLogs]);
  const previewLines = exportText.split("\n").slice(0, 11).join("\n");

  async function copyExportText() {
    setCopyError("");

    try {
      await navigator.clipboard.writeText(exportText);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      if (copyTextFallback(exportText)) {
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 1800);
        return;
      }

      setCopyError("Copy failed. You can still download the text file.");
    }
  }

  function downloadExportText() {
    downloadTextFile(`nutrition-log-${today}.txt`, exportText);
  }

  return (
    <section className="hover-lift animate-enter-soft overflow-hidden rounded-lg border border-violet-100 bg-white shadow-sm dark:border-violet-900/70">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
                <Sparkles size={20} className="text-violet-600 dark:text-violet-300" />
                AI diet export
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                One tap turns today&apos;s log into a clean prompt for ChatGPT or your macro-estimation flow.
              </p>
            </div>
            <div className="inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
              {todayLogs.length} food{todayLogs.length === 1 ? "" : "s"} today
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              type="button"
              onClick={copyExportText}
            >
              {isCopied ? <Check size={17} /> : <Clipboard size={17} />}
              {isCopied ? "Copied for AI" : "Copy AI-ready log"}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700"
              type="button"
              onClick={downloadExportText}
            >
              <Download size={17} />
              Download .txt
            </button>
          </div>

          {copyError ? <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{copyError}</p> : null}
        </div>

        <div className="border-t border-violet-100 bg-violet-50/60 p-4 dark:border-violet-900/70 dark:bg-violet-950/20 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-200">Preview</p>
          <pre className="mt-3 max-h-44 overflow-hidden whitespace-pre-wrap rounded-lg border border-violet-100 bg-white/80 p-3 text-xs leading-5 text-slate-600 dark:border-violet-900/70 dark:bg-slate-900/70 dark:text-slate-300">
            {previewLines}
          </pre>
        </div>
      </div>
    </section>
  );
}
