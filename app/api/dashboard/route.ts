import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import {
  addTotals,
  calculateDynamicTdee,
  calculateTargets,
  remainingTotals,
  rowToDailyStatus,
  rowToFoodLog,
  rowsToSettings,
  todayKey
} from "@/lib/nutrition";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || todayKey();
  const [foodRows, statusRows, settingRows] = await Promise.all([
    readSheetObjects(sheetTabs.dailyLog),
    readSheetObjects(sheetTabs.dailyStatus),
    readSheetObjects(sheetTabs.settings)
  ]);

  const logs = foodRows.map(rowToFoodLog).filter((log) => log.date === date);
  const totals = addTotals(logs);
  const status = statusRows.map(rowToDailyStatus).find((row) => row.date === date) ?? null;
  const settings = rowsToSettings(settingRows);
  const targets = calculateTargets(status, settings);
  const dynamicTdee = calculateDynamicTdee(status, settings);
  const dashboard: DashboardData = {
    date,
    totals,
    targets,
    dynamicTdee,
    remaining: remainingTotals(targets, totals),
    status
  };

  return NextResponse.json(dashboard);
}
