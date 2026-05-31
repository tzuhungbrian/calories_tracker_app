import { NextResponse } from "next/server";
import { appendSheetRow, deleteSheetRowById, readSheetObjects, sheetTabs, updateSheetRowById } from "@/lib/google_sheets";
import { foodLogToSheetRow, normalizeFoodLog, rowToFoodLog } from "@/lib/nutrition";
import type { FoodLog, FoodLogInput } from "@/lib/types";

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

export async function PUT(request: Request) {
  const payload = (await request.json()) as FoodLog;

  if (!payload.id) {
    return NextResponse.json({ error: "Food log id is required." }, { status: 400 });
  }

  const log = normalizeFoodLog(payload, {
    id: payload.id,
    createdAt: payload.createdAt
  });

  await updateSheetRowById(sheetTabs.dailyLog, payload.id, foodLogToSheetRow(log));

  return NextResponse.json(log);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Food log id is required." }, { status: 400 });
  }

  await deleteSheetRowById(sheetTabs.dailyLog, id);

  return NextResponse.json({ ok: true });
}
