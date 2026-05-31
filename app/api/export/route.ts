import { NextResponse } from "next/server";
import { readSheetValues, sheetTabs } from "@/lib/google_sheets";

export const dynamic = "force-dynamic";

const exportTabs = [
  ["foods", sheetTabs.commonFoods],
  ["food_logs", sheetTabs.dailyLog],
  ["daily_status", sheetTabs.dailyStatus],
  ["meal_preps", sheetTabs.mealPreps],
  ["meal_prep_items", sheetTabs.mealPrepItems],
  ["settings", sheetTabs.settings]
] as const;

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped;
}

function csvRow(values: string[]): string {
  return values.map(csvCell).join(",");
}

export async function GET() {
  const tables = await Promise.all(
    exportTabs.map(async ([label, tabName]) => ({
      label,
      rows: await readSheetValues(tabName)
    }))
  );
  const maxColumns = Math.max(...tables.flatMap((table) => table.rows.map((row) => row.length)), 1);
  const headers = ["table", "row_number", ...Array.from({ length: maxColumns }, (_, index) => `column_${index + 1}`)];
  const csvRows = [
    csvRow(headers),
    ...tables.flatMap((table) =>
      table.rows.map((row, index) => csvRow([table.label, String(index + 1), ...Array.from({ length: maxColumns }, (_, columnIndex) => row[columnIndex] || "")]))
    )
  ];
  const csv = `${csvRows.join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="nutrition_tracker_export_${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}
