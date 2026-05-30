import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import {
  addTotals,
  defaultTargets,
  remainingTotals,
  rowToDailyStatus,
  rowToFoodLog,
  rowToSummaryTotals,
  rowToTargets,
  todayKey
} from "@/lib/nutrition";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || todayKey();
  const [foodRows, statusRows, summaryRows] = await Promise.all([
    readSheetObjects(sheetTabs.dailyLog),
    readSheetObjects(sheetTabs.dailyStatus),
    readSheetObjects(sheetTabs.summaryData)
  ]);

  const logs = foodRows.map(rowToFoodLog).filter((log) => log.date === date);
  const summaryRow = summaryRows.find((row) => row.date === date || row.Date === date);
  const totals = summaryRow ? rowToSummaryTotals(summaryRow) : addTotals(logs);
  const summaryTargets = summaryRow ? rowToTargets(summaryRow) : defaultTargets;
  const targets = summaryTargets.calories > 0 ? summaryTargets : defaultTargets;
  const status = statusRows.map(rowToDailyStatus).find((row) => row.date === date) ?? null;
  const dashboard: DashboardData = {
    date,
    totals,
    targets,
    remaining: remainingTotals(targets, totals),
    status
  };

  return NextResponse.json(dashboard);
}
