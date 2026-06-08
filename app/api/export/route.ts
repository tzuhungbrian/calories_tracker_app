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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDateCell(value: string): string {
  return value.trim().slice(0, 10).replace(/\//g, "-");
}

function findDateColumn(headers: string[]): number {
  return headers.findIndex((header) => ["date", "logdate", "day"].includes(normalizeHeader(header)));
}

function filterRowsByDateRange(rows: string[][], startDate: string, endDate: string): Array<{ row: string[]; rowNumber: number }> {
  if (!startDate || !endDate || startDate > endDate || rows.length <= 1) {
    return rows.map((row, index) => ({ row, rowNumber: index + 1 }));
  }

  const [headers, ...bodyRows] = rows;
  const dateColumn = findDateColumn(headers);

  if (dateColumn < 0) {
    return rows.map((row, index) => ({ row, rowNumber: index + 1 }));
  }

  return [
    { row: headers, rowNumber: 1 },
    ...bodyRows
      .map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter(({ row }) => {
        const rowDate = normalizeDateCell(row[dateColumn] || "");
        return rowDate >= startDate && rowDate <= endDate;
      })
  ];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start") || "";
  const endDate = searchParams.get("end") || "";
  const hasDateRange = Boolean(startDate && endDate && startDate <= endDate);
  const tables = await Promise.all(
    exportTabs.map(async ([label, tabName]) => ({
      label,
      rows: filterRowsByDateRange(await readSheetValues(tabName), startDate, endDate)
    }))
  );
  const maxColumns = Math.max(...tables.flatMap((table) => table.rows.map(({ row }) => row.length)), 1);
  const headers = ["table", "row_number", ...Array.from({ length: maxColumns }, (_, index) => `column_${index + 1}`)];
  const csvRows = [
    csvRow(headers),
    ...tables.flatMap((table) =>
      table.rows.map(({ row, rowNumber }) => csvRow([table.label, String(rowNumber), ...Array.from({ length: maxColumns }, (_, columnIndex) => row[columnIndex] || "")]))
    )
  ];
  const csv = `${csvRows.join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  const rangeSuffix = hasDateRange ? `_${startDate}_to_${endDate}` : "";

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="nutrition_tracker_export${rangeSuffix}_${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}
