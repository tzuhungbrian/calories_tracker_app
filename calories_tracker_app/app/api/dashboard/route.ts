import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import {
  addTotals,
  defaultTargets,
  remainingTotals,
  rowToDailyStatus,
  rowToFoodLog,
  todayKey
} from "@/lib/nutrition";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || todayKey();
  const [foodRows, statusRows] = await Promise.all([
    readSheetObjects(sheetTabs.dailyLog),
    readSheetObjects(sheetTabs.dailyStatus)
  ]);

  const logs = foodRows.map(rowToFoodLog).filter((log) => log.date === date);
  const totals = addTotals(logs);
  const status = statusRows.map(rowToDailyStatus).find((row) => row.date === date) ?? null;
  const dashboard: DashboardData = {
    date,
    totals,
    targets: defaultTargets,
    remaining: remainingTotals(defaultTargets, totals),
    status
  };

  return NextResponse.json(dashboard);
}
