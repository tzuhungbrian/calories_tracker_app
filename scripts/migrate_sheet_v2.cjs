const fs = require("fs");
const crypto = require("crypto");
const { google } = require("googleapis");

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    continue;
  }

  const index = line.indexOf("=");
  if (index > 0) {
    let value = line.slice(index + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, index).trim()] = value;
  }
}

const spreadsheetId = env.GOOGLE_SHEET_ID;

function getPrivateKey() {
  const key = String(env.GOOGLE_PRIVATE_KEY || "").trim();
  const unquoted =
    (key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'"))
      ? key.slice(1, -1)
      : key;

  return unquoted.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

const auth = new google.auth.JWT({
  email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: getPrivateKey(),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});
const sheets = google.sheets({ version: "v4", auth });

const newTabs = {
  foods: "foods",
  foodLogs: "food_logs",
  dailyStatus: "daily_status",
  mealPreps: "meal_preps",
  mealPrepItems: "meal_prep_items",
  settings: "settings"
};

const headers = {
  foods: ["id", "name", "category", "serving_label", "serving_size", "calories", "protein", "fat", "carbs", "notes", "created_at", "updated_at"],
  foodLogs: ["id", "date", "meal", "food_id", "food_name", "servings", "calories", "protein", "fat", "carbs", "notes", "created_at", "updated_at"],
  dailyStatus: ["id", "date", "goal_type", "steps", "strength_session", "creatine_taken", "basketball_minutes", "body_weight", "notes", "updated_at"],
  mealPreps: ["id", "name", "category", "portions", "serving_label", "calories_per_portion", "protein_per_portion", "fat_per_portion", "carbs_per_portion", "notes", "created_at", "updated_at"],
  mealPrepItems: ["id", "prep_id", "food_id", "food_name", "servings_used", "calories", "protein", "fat", "carbs"],
  settings: ["key", "value", "notes", "updated_at"]
};

function normalizeHeader(header) {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueOf(row, keys) {
  for (const key of keys) {
    const value = row[key] ?? row[normalizeHeader(key)];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return "";
}

function numberOf(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolText(value) {
  return ["true", "yes", "y", "1", "checked"].includes(String(value || "").trim().toLowerCase()) ? "true" : "false";
}

function stableId(prefix, parts) {
  const hash = crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12);
  return `${prefix}_${hash}`;
}

function quoteSheetName(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

function rowsToObjects(rows) {
  const knownHeaders = new Set(["date", "meal", "food name", "food / item", "goal type", "calories", "metric"]);
  const headerIndex = rows.findIndex((row) => row.filter(Boolean).some((cell) => knownHeaders.has(String(cell).trim().toLowerCase())));
  const headerRow = rows[headerIndex] || [];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : [];
  return dataRows
    .filter((row) => row.some(Boolean))
    .map((row) =>
      headerRow.reduce((record, header, index) => {
        if (header) {
          const value = String(row[index] ?? "");
          record[header] = value;
          record[normalizeHeader(header)] = value;
        }
        return record;
      }, {})
    );
}

async function readObjects(tabName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(tabName)}!A:Z`
  });
  return rowsToObjects(response.data.values || []);
}

async function readFirstAvailable(tabNames) {
  let lastError;
  for (const tabName of tabNames) {
    try {
      return await readObjects(tabName);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function ensureTabs() {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.sheetId,sheets.properties.title"
  });
  const sheetsByTitle = new Map(metadata.data.sheets.map((sheet) => [sheet.properties.title, sheet.properties]));
  const legacyRenames = [
    ["Common_Foods", "legacy_Common_Foods"],
    ["Daily_Log", "legacy_Daily_Log"],
    ["Daily_Status", "legacy_Daily_Status"],
    ["Settings", "legacy_Settings"]
  ];
  const renameRequests = legacyRenames
    .filter(([from, to]) => sheetsByTitle.has(from) && !sheetsByTitle.has(to))
    .map(([from, to]) => ({
      updateSheetProperties: {
        properties: {
          sheetId: sheetsByTitle.get(from).sheetId,
          title: to
        },
        fields: "title"
      }
    }));

  if (renameRequests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: renameRequests }
    });
  }

  const refreshedMetadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });
  const existing = new Set(refreshedMetadata.data.sheets.map((sheet) => sheet.properties.title.toLowerCase()));
  const requests = Object.values(newTabs)
    .filter((title) => !existing.has(title.toLowerCase()))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }
}

async function replaceTab(tabName, values) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheetName(tabName)}!A:Z`
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetName(tabName)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });
}

async function main() {
  const now = new Date().toISOString();
  const [oldFoods, oldLogs, oldStatuses, oldSettings] = await Promise.all([
    readFirstAvailable(["Common_Foods", "legacy_Common_Foods", "foods"]),
    readFirstAvailable(["Daily_Log", "legacy_Daily_Log", "food_logs"]),
    readFirstAvailable(["Daily_Status", "legacy_Daily_Status", "daily_status"]),
    readFirstAvailable(["Settings", "legacy_Settings", "settings"])
  ]);

  const foodRows = oldFoods.map((row) => {
    const name = valueOf(row, ["Food name", "name"]);
    return [
      stableId("food", [name, valueOf(row, ["Serving label", "Serving size"])]),
      name,
      valueOf(row, ["Category"]),
      valueOf(row, ["Serving label"]),
      valueOf(row, ["Serving size"]),
      numberOf(valueOf(row, ["Calories / serving", "calories"])),
      numberOf(valueOf(row, ["Protein (g)", "protein"])),
      numberOf(valueOf(row, ["Fat (g)", "fat"])),
      numberOf(valueOf(row, ["Carbs (g)", "carbs"])),
      valueOf(row, ["Notes"]),
      now,
      now
    ];
  });
  const foodIdByName = new Map(foodRows.map((row) => [row[1], row[0]]));

  const logRows = oldLogs.map((row, index) => {
    const date = valueOf(row, ["Date"]);
    const meal = valueOf(row, ["Meal"]);
    const foodName = valueOf(row, ["Food / Item", "food_name"]) || valueOf(row, ["Notes"]) || "Manual entry";
    const calories = numberOf(valueOf(row, ["Final kcal", "Manual kcal", "calories"]));
    const protein = numberOf(valueOf(row, ["Final P", "Manual P", "protein"]));
    const fat = numberOf(valueOf(row, ["Final F", "Manual F", "fat"]));
    const carbs = numberOf(valueOf(row, ["Final C", "Manual C", "carbs"]));
    return [
      stableId("log", [date, meal, foodName, calories, protein, fat, carbs, index]),
      date,
      meal,
      foodIdByName.get(foodName) || "",
      foodName,
      numberOf(valueOf(row, ["Servings"])) || 1,
      calories,
      protein,
      fat,
      carbs,
      valueOf(row, ["Notes"]),
      now,
      now
    ];
  });

  const statusRows = oldStatuses.map((row) => {
    const date = valueOf(row, ["Date"]);
    return [
      stableId("status", [date]),
      date,
      String(valueOf(row, ["Goal Type"]) || "Maintain").toLowerCase(),
      numberOf(valueOf(row, ["Steps"])),
      boolText(valueOf(row, ["Strength session"])),
      boolText(valueOf(row, ["Creatine Taken"])),
      numberOf(valueOf(row, ["Basketball minutes"])),
      "",
      "",
      now
    ];
  });

  const metricMap = new Map(oldSettings.map((row) => [valueOf(row, ["Metric"]), valueOf(row, ["Value"])]));
  const settingRows = [
    ["weight_kg", metricMap.get("Weight (kg)") || "", "Current body weight used for target calculations.", now],
    ["bmr", metricMap.get("BMR (Katch-McArdle)") || "", "Base metabolic rate.", now],
    ["base_activity_factor", metricMap.get("Base non-step activity factor") || "1.2", "Multiplier for non-step daily activity.", now],
    ["calories_per_step", metricMap.get("Calories per step") || "0.04", "Estimated calories burned per step.", now],
    ["strength_training_kcal", metricMap.get("Strength training kcal") || "250", "Calories added when strength_session is true.", now],
    ["basketball_kcal_per_minute", metricMap.get("Basketball kcal per minute") || "8", "Calories added per basketball minute.", now],
    ["protein_target_per_kg", metricMap.get("Protein target per kg") || "2", "Protein target in grams per kg.", now],
    ["fat_target_per_kg", metricMap.get("Fat target per kg") || "0.9", "Fat target in grams per kg.", now],
    ["cut_adjustment_kcal", metricMap.get("Default cut adjustment (kcal)") || "-300", "Calories added to TDEE for cut days.", now],
    ["maintain_adjustment_kcal", metricMap.get("Default maintain adjustment (kcal)") || "0", "Calories added to TDEE for maintain days.", now],
    ["bulk_adjustment_kcal", metricMap.get("Default bulk adjustment (kcal)") || "250", "Calories added to TDEE for bulk days.", now]
  ];

  await ensureTabs();
  await Promise.all([
    replaceTab(newTabs.foods, [headers.foods, ...foodRows]),
    replaceTab(newTabs.foodLogs, [headers.foodLogs, ...logRows]),
    replaceTab(newTabs.dailyStatus, [headers.dailyStatus, ...statusRows]),
    replaceTab(newTabs.mealPreps, [headers.mealPreps]),
    replaceTab(newTabs.mealPrepItems, [headers.mealPrepItems]),
    replaceTab(newTabs.settings, [headers.settings, ...settingRows])
  ]);

  console.log(`Migrated ${foodRows.length} foods, ${logRows.length} food logs, and ${statusRows.length} daily statuses.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
