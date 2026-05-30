import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs } from "@/lib/google_sheets";
import { rowToCommonFood } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readSheetObjects(sheetTabs.commonFoods);
  return NextResponse.json(rows.map(rowToCommonFood).filter((food) => food.name));
}
