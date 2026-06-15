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

function parseBooleanCell(value: string): boolean {
  return ["true", "yes", "y", "1", "checked"].includes(value.trim().toLowerCase());
}

function findDateColumn(headers: string[]): number {
  return headers.findIndex((header) => ["date", "logdate", "day"].includes(normalizeHeader(header)));
}

function findTravelDayColumn(headers: string[]): number {
  return headers.findIndex((header) => ["istravelday", "travelday", "travel"].includes(normalizeHeader(header)));
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

function travelDaysFromRows(rows: Array<{ row: string[]; rowNumber: number }>): string[] {
  if (rows.length <= 1) {
    return [];
  }

  const [headerRow, ...bodyRows] = rows;
  const dateColumn = findDateColumn(headerRow.row);
  const travelColumn = findTravelDayColumn(headerRow.row);

  if (dateColumn < 0 || travelColumn < 0) {
    return [];
  }

  return bodyRows
    .filter(({ row }) => parseBooleanCell(row[travelColumn] || ""))
    .map(({ row }) => normalizeDateCell(row[dateColumn] || ""))
    .filter(Boolean);
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
  const travelDays = travelDaysFromRows(tables.find((table) => table.label === "daily_status")?.rows ?? []);
  const analysisRows = travelDays.length
    ? [
        ["analysis_notes", "1", "instruction", "Ignore travel days for adherence, calorie balance, macro consistency, and trend judgment."],
        ...travelDays.map((travelDay, index) => ["analysis_notes", String(index + 2), "travel_day", travelDay])
      ]
    : [];
  const maxColumns = Math.max(...tables.flatMap((table) => table.rows.map(({ row }) => row.length)), ...analysisRows.map((row) => row.length - 2), 1);
  const headers = ["table", "row_number", ...Array.from({ length: maxColumns }, (_, index) => `column_${index + 1}`)];
  const csvRows = [
    csvRow(headers),
    ...analysisRows.map((row) => csvRow([...row, ...Array.from({ length: Math.max(0, maxColumns + 2 - row.length) }, () => "")])),
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
