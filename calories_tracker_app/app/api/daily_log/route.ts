import { NextResponse } from "next/server";
import { appendSheetRow, readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import { foodLogToSheetRow, normalizeFoodLog, rowToFoodLog } from "@/lib/nutrition";
import type { FoodLogInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readSheetObjects(sheetTabs.dailyLog);
  return NextResponse.json(rows.map(rowToFoodLog));
}

export async function POST(request: Request) {
  const payload = (await request.json()) as FoodLogInput;
  const log = normalizeFoodLog(payload);

  await appendSheetRow(sheetTabs.dailyLog, foodLogToSheetRow(log));

  return NextResponse.json(log, { status: 201 });
}
