import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import { addTotals, calculateDynamicTdee, calculateTargets, rowToDailyStatus, rowToFoodLog, rowsToSettings } from "@/lib/nutrition";
import type { DailySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

function getRecentDates(days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") || "14");
  const recentDates = getRecentDates(Number.isFinite(days) ? days : 14);
  const [foodRows, statusRows, settingRows] = await Promise.all([
    readSheetObjects(sheetTabs.dailyLog),
    readSheetObjects(sheetTabs.dailyStatus),
    readSheetObjects(sheetTabs.settings)
  ]);
  const logs = foodRows.map(rowToFoodLog);
  const statuses = statusRows.map(rowToDailyStatus);
  const settings = rowsToSettings(settingRows);

  const summary: DailySummary[] = recentDates.map((date) => {
    const totals = addTotals(logs.filter((log) => log.date === date));
    const status = statuses.find((row) => row.date === date);
    const targets = calculateTargets(status ?? null, settings);

    return {
      date,
      calories: totals.calories,
      calorieTarget: targets.calories,
      dynamicTdee: calculateDynamicTdee(status ?? null, settings),
      protein: totals.protein,
      proteinGoal: targets.protein,
      fat: totals.fat,
      carbs: totals.carbs,
      goalType: status?.goalType ?? "",
      steps: status?.steps ?? 0,
      strengthSession: status?.strengthSession ?? false,
      creatineTaken: status?.creatineTaken ?? false,
      basketballMinutes: status?.basketballMinutes ?? 0
    };
  });

  return NextResponse.json(summary);
}
