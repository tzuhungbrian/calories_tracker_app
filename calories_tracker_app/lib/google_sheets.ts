import "server-only";

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import type { DailyStatus, SheetRow } from "./types";
import { statusToSheetRow } from "./nutrition";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

export const sheetTabs = {
  dailyLog: process.env.GOOGLE_SHEET_DAILY_LOG_TAB || "DailyLog",
  dailyStatus: process.env.GOOGLE_SHEET_DAILY_STATUS_TAB || "DailyStatus",
  commonFoods: process.env.GOOGLE_SHEET_COMMON_FOODS_TAB || "CommonFoods",
  targets: process.env.GOOGLE_SHEET_TARGETS_TAB || "Targets"
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
  const [headers = [], ...dataRows] = rows;

  return dataRows
    .filter((row) => row.some(Boolean))
    .map((row) =>
      headers.reduce<SheetRow>((record, header, index) => {
        if (header) {
          record[header] = row[index] ?? "";
        }
        return record;
      }, {})
    );
}

export async function readSheetObjects(tabName: string): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:Z`
  });

  return rowsToObjects(asRows(response.data.values));
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

export async function upsertDailyStatus(status: DailyStatus): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTabs.dailyStatus}!A:F`
  });
  const rows = asRows(response.data.values);
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === status.date);
  const values = statusToSheetRow(status);

  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTabs.dailyStatus}!A${rowIndex + 1}:F${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] }
    });
    return;
  }

  await appendSheetRow(sheetTabs.dailyStatus, values);
}
