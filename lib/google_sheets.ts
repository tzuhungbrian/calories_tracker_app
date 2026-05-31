import "server-only";

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import type { DailyStatus, SheetRow } from "./types";
import { statusToSheetRow } from "./nutrition";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

export const sheetTabs = {
  dailyLog: process.env.GOOGLE_SHEET_DAILY_LOG_TAB || "food_logs",
  dailyStatus: process.env.GOOGLE_SHEET_DAILY_STATUS_TAB || "daily_status",
  commonFoods: process.env.GOOGLE_SHEET_COMMON_FOODS_TAB || "foods",
  mealPreps: process.env.GOOGLE_SHEET_MEAL_PREPS_TAB || "meal_preps",
  mealPrepItems: process.env.GOOGLE_SHEET_MEAL_PREP_ITEMS_TAB || "meal_prep_items",
  settings: process.env.GOOGLE_SHEET_SETTINGS_TAB || "settings"
};

function getPrivateKey(): string {
  return (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function getSheetsClient(): sheets_v4.Sheets {
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Google Sheets environment variables are not configured.");
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getPrivateKey(),
    scopes: SCOPES
  });

  return google.sheets({ version: "v4", auth });
}

function asRows(values: unknown[][] | null | undefined): string[][] {
  return (values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
}

function rowsToObjects(rows: string[][]): SheetRow[] {
  const knownHeaders = new Set([
    "date",
    "meal",
    "food name",
    "food / item",
    "goal type",
    "calories",
    "metric",
    "key",
    "name"
  ]);
  const headerIndex = rows.findIndex((row) =>
    row.filter(Boolean).some((cell) => knownHeaders.has(cell.trim().toLowerCase()))
  );
  const headers = rows[headerIndex] ?? [];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : [];

  return dataRows
    .filter((row) => row.some(Boolean))
    .map((row) =>
      headers.reduce<SheetRow>((record, header, index) => {
        if (header) {
          const value = row[index] ?? "";
          record[header] = value;
          record[normalizeHeader(header)] = value;
        }
        return record;
      }, {})
    );
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnName(columnNumber: number): string {
  let remaining = columnNumber;
  let name = "";

  while (remaining > 0) {
    const offset = (remaining - 1) % 26;
    name = String.fromCharCode(65 + offset) + name;
    remaining = Math.floor((remaining - offset - 1) / 26);
  }

  return name || "A";
}

function quoteSheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function readSheetValues(tabName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(tabName)}!A:Z`
  });

  return asRows(response.data.values);
}

export async function readSheetObjects(tabName: string): Promise<SheetRow[]> {
  return rowsToObjects(await readSheetValues(tabName));
}

export async function appendSheetRow(tabName: string, values: string[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values]
    }
  });
}

async function getSheetId(tabName: string): Promise<number> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.sheetId,sheets.properties.title"
  });
  const sheet = response.data.sheets?.find((item) => item.properties?.title === tabName);
  const sheetId = sheet?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Sheet tab "${tabName}" was not found.`);
  }

  return sheetId;
}

export async function updateSheetRowById(tabName: string, id: string, values: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:Z`
  });
  const rows = asRows(response.data.values);
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

  if (rowIndex < 0) {
    throw new Error(`Row with id "${id}" was not found.`);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A${rowIndex + 1}:${columnName(values.length)}${rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

export async function deleteSheetRowById(tabName: string, id: string): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:Z`
  });
  const rows = asRows(response.data.values);
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

  if (rowIndex < 0) {
    throw new Error(`Row with id "${id}" was not found.`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(tabName),
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    }
  });
}

export async function upsertDailyStatus(status: DailyStatus): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTabs.dailyStatus}!A:J`
  });
  const rows = asRows(response.data.values);
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[1] === status.date);
  const existingId = rowIndex >= 0 ? rows[rowIndex][0] : "";
  const values = statusToSheetRow({ ...status, id: existingId || status.id });

  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTabs.dailyStatus}!A${rowIndex + 1}:J${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] }
    });
    return;
  }

  await appendSheetRow(sheetTabs.dailyStatus, values);
}

export async function upsertSettings(valuesByKey: Record<string, string>, notesByKey: Record<string, string> = {}): Promise<void> {
  const sheets = getSheetsClient();
  const rows = await readSheetValues(sheetTabs.settings);
  const now = new Date().toISOString();
  const updates: Array<{ rowNumber: number; values: string[] }> = [];
  const existingKeys = new Set<string>();

  rows.forEach((row, index) => {
    if (index === 0) {
      return;
    }

    const key = row[0];
    if (!key || !(key in valuesByKey)) {
      return;
    }

    existingKeys.add(key);
    updates.push({
      rowNumber: index + 1,
      values: [key, valuesByKey[key], row[2] || notesByKey[key] || "", now]
    });
  });

  await Promise.all(
    updates.map((update) =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTabs.settings}!A${update.rowNumber}:D${update.rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [update.values] }
      })
    )
  );

  const newRows = Object.entries(valuesByKey)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => [key, value, notesByKey[key] || "", now]);

  if (newRows.length) {
    const startRow = Math.max(rows.length + 1, 2);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTabs.settings}!A${startRow}:D${startRow + newRows.length - 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: newRows }
    });
  }
}
