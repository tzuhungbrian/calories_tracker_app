import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs, upsertDailyStatus } from "@/lib/google_sheets";
import { parseBoolean, parseGoalType, parseNumber, rowToDailyStatus, todayKey } from "@/lib/nutrition";
import type { DailyStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || todayKey();
  const rows = await readSheetObjects(sheetTabs.dailyStatus);
  const status = rows.map(rowToDailyStatus).find((row) => row.date === date) ?? null;

  return NextResponse.json(status);
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as Partial<DailyStatus>;
  const status: DailyStatus = {
    date: payload.date || todayKey(),
    goalType: parseGoalType(payload.goalType),
    steps: parseNumber(String(payload.steps ?? "")),
    strengthSession: parseBoolean(String(payload.strengthSession ?? "")),
    creatineTaken: parseBoolean(String(payload.creatineTaken ?? "")),
    basketballMinutes: parseNumber(String(payload.basketballMinutes ?? "")),
    isTravelDay: parseBoolean(String(payload.isTravelDay ?? ""))
  };

  await upsertDailyStatus(status);

  return NextResponse.json(status);
}
