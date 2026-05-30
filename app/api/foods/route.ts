import { NextResponse } from "next/server";
import { appendSheetRow, deleteSheetRowById, readSheetObjects, sheetTabs, updateSheetRowById } from "@/lib/google_sheets";
import { commonFoodToSheetRow, normalizeCommonFood, rowToCommonFood } from "@/lib/nutrition";
import type { CommonFood } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readSheetObjects(sheetTabs.commonFoods);
  return NextResponse.json(rows.map(rowToCommonFood).filter((food) => food.name));
}

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<CommonFood>;
  const food = normalizeCommonFood(payload);

  if (!food.name) {
    return NextResponse.json({ error: "Food name is required." }, { status: 400 });
  }

  await appendSheetRow(sheetTabs.commonFoods, commonFoodToSheetRow(food));

  return NextResponse.json(food, { status: 201 });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as Partial<CommonFood>;
  const food = normalizeCommonFood(payload);

  if (!food.id || !food.name) {
    return NextResponse.json({ error: "Food id and name are required." }, { status: 400 });
  }

  const rows = await readSheetObjects(sheetTabs.commonFoods);
  const existingRow = rows.find((row) => row.id === food.id);
  await updateSheetRowById(sheetTabs.commonFoods, food.id, commonFoodToSheetRow(food, existingRow?.createdat || existingRow?.created_at));

  return NextResponse.json(food);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Food id is required." }, { status: 400 });
  }

  await deleteSheetRowById(sheetTabs.commonFoods, id);

  return NextResponse.json({ ok: true });
}
