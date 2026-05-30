import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import { addTotals, calculateDynamicTdee, calculateTargets, rowToDailyStatus, rowToFoodLog, rowsToSettings } from "@/lib/nutrition";
import { recentDateKeys } from "@/lib/date";
import type { DailySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") || "14");
  const recentDates = recentDateKeys(Number.isFinite(days) ? days : 14);
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
