import { NextResponse } from "next/server";
import { appendSheetRow, deleteSheetRowById, readSheetObjects, sheetTabs, updateSheetRowById } from "@/lib/google_sheets";
import { isVisibleDataDate } from "@/lib/date";
import { foodLogToSheetRow, normalizeFoodLog, rowToFoodLog } from "@/lib/nutrition";
import type { FoodLog, FoodLogInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function validateFoodLogInput(input: Partial<FoodLogInput>): string | null {
  if (!input.date?.trim()) {
    return "Food log date is required.";
  }

  if (!input.meal?.trim()) {
    return "Food log meal is required.";
  }

  if (!input.foodName?.trim()) {
    return "Food log food name is required.";
  }

  return null;
}

export async function GET() {
  const rows = await readSheetObjects(sheetTabs.dailyLog);
  return NextResponse.json(rows.map(rowToFoodLog).filter((log) => isVisibleDataDate(log.date)));
}

export async function POST(request: Request) {
  const payload = (await request.json()) as FoodLogInput;
  const validationError = validateFoodLogInput(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const log = normalizeFoodLog(payload);

  await appendSheetRow(sheetTabs.dailyLog, foodLogToSheetRow(log));

  return NextResponse.json(log, { status: 201 });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as FoodLog;

  if (!payload.id) {
    return NextResponse.json({ error: "Food log id is required." }, { status: 400 });
  }

  const validationError = validateFoodLogInput(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
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
