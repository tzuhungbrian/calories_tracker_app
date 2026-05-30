import type {
  CommonFood,
  DailyStatus,
  FoodLog,
  FoodLogInput,
  GoalType,
  NutritionTargets,
  NutritionTotals,
  SheetRow
} from "./types";

function valueOf(row: SheetRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const value = row[key] ?? row[normalized];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
}

export const defaultTargets: NutritionTargets = {
  calories: 2200,
  protein: 160,
  fat: 70,
  carbs: 230
};

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyTotals(): NutritionTotals {
  return { calories: 0, protein: 0, fat: 0, carbs: 0 };
}

export function addTotals(rows: Array<Pick<FoodLog, "calories" | "protein" | "fat" | "carbs">>): NutritionTotals {
  return rows.reduce<NutritionTotals>(
    (total, row) => ({
      calories: total.calories + row.calories,
      protein: total.protein + row.protein,
      fat: total.fat + row.fat,
      carbs: total.carbs + row.carbs
    }),
    emptyTotals()
  );
}

export function remainingTotals(targets: NutritionTargets, totals: NutritionTotals): NutritionTotals {
  return {
    calories: targets.calories - totals.calories,
    protein: targets.protein - totals.protein,
    fat: targets.fat - totals.fat,
    carbs: targets.carbs - totals.carbs
  };
}

export function parseNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseBoolean(value: string | undefined): boolean {
  return ["true", "yes", "y", "1", "checked"].includes((value ?? "").trim().toLowerCase());
}

export function parseGoalType(value: string | undefined): GoalType {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "cut" || normalized === "bulk" || normalized === "maintain") {
    return normalized;
  }
  return "maintain";
}

export function normalizeFoodLog(input: FoodLogInput): FoodLog {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    date: input.date || todayKey(),
    meal: input.meal.trim(),
    foodName: input.foodName.trim(),
    amount: input.amount.trim(),
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    fat: Number(input.fat) || 0,
    carbs: Number(input.carbs) || 0,
    notes: input.notes?.trim() ?? ""
  };
}

export function rowToFoodLog(row: SheetRow): FoodLog {
  return {
    id: valueOf(row, ["id", "ID"]) || "",
    createdAt: valueOf(row, ["createdAt", "CreatedAt", "created_at"]) || "",
    date: valueOf(row, ["date", "Date"]) || "",
    meal: valueOf(row, ["meal", "Meal"]) || "",
    foodName: valueOf(row, ["foodName", "FoodName", "Food / Item", "food", "Food"]) || "",
    amount: valueOf(row, ["amount", "Amount", "Servings", "serving", "Serving"]) || "",
    calories: parseNumber(valueOf(row, ["Final kcal", "calories", "Calories", "kcal"])),
    protein: parseNumber(valueOf(row, ["Final P", "protein", "Protein"])),
    fat: parseNumber(valueOf(row, ["Final F", "fat", "Fat"])),
    carbs: parseNumber(valueOf(row, ["Final C", "carbs", "Carbs", "carbohydrates"]))
  };
}

export function rowToCommonFood(row: SheetRow): CommonFood {
  return {
    name: valueOf(row, ["Food name", "name", "Name", "food", "Food"]) || "",
    serving: valueOf(row, ["Serving label", "Serving size", "serving", "Serving", "amount", "Amount"]) || "",
    calories: parseNumber(valueOf(row, ["Calories / serving", "calories", "Calories", "kcal"])),
    protein: parseNumber(valueOf(row, ["Protein (g)", "protein", "Protein"])),
    fat: parseNumber(valueOf(row, ["Fat (g)", "fat", "Fat"])),
    carbs: parseNumber(valueOf(row, ["Carbs (g)", "carbs", "Carbs", "carbohydrates"]))
  };
}

export function rowToDailyStatus(row: SheetRow): DailyStatus {
  return {
    date: valueOf(row, ["date", "Date"]) || "",
    goalType: parseGoalType(valueOf(row, ["Goal Type", "goalType", "GoalType", "goal", "Goal"])),
    steps: parseNumber(valueOf(row, ["steps", "Steps"])),
    strengthSession: parseBoolean(valueOf(row, ["Strength session", "strengthSession", "StrengthSession", "strength", "Strength"])),
    creatineTaken: parseBoolean(valueOf(row, ["Creatine Taken", "creatineTaken", "CreatineTaken", "creatine", "Creatine"])),
    basketballMinutes: parseNumber(valueOf(row, ["Basketball minutes", "basketballMinutes", "BasketballMinutes", "basketball", "Basketball"]))
  };
}

export function rowToTargets(row: SheetRow): NutritionTargets {
  return {
    calories: parseNumber(valueOf(row, ["Calorie target", "calorieTarget", "calories", "Calories"])),
    protein: parseNumber(valueOf(row, ["Protein goal", "proteinGoal", "protein", "Protein"])),
    fat: parseNumber(valueOf(row, ["Fat goal", "fatGoal", "fat", "Fat"])),
    carbs: parseNumber(valueOf(row, ["Carb goal", "carbGoal", "carbs", "Carbs"]))
  };
}

export function rowToSummaryTotals(row: SheetRow): NutritionTotals {
  return {
    calories: parseNumber(valueOf(row, ["Calories", "calories"])),
    protein: parseNumber(valueOf(row, ["Protein", "protein"])),
    fat: parseNumber(valueOf(row, ["Fat", "fat"])),
    carbs: parseNumber(valueOf(row, ["Carbs", "carbs"]))
  };
}

export function rowToDynamicTdee(row: SheetRow): number {
  return parseNumber(valueOf(row, ["Dynamic TDEE", "dynamicTdee", "tdee", "TDEE"]));
}

export function statusToSheetRow(status: DailyStatus): string[] {
  return [
    status.date,
    status.goalType,
    String(status.steps),
    status.strengthSession ? "Yes" : "No",
    status.creatineTaken ? "Yes" : "No",
    String(status.basketballMinutes)
  ];
}

export function foodLogToSheetRow(log: FoodLog): string[] {
  return [
    log.date,
    log.meal,
    "Manual",
    log.foodName,
    log.amount || "1.00",
    String(log.calories),
    String(log.protein),
    String(log.fat),
    String(log.carbs),
    String(log.calories),
    String(log.protein),
    String(log.fat),
    String(log.carbs),
    log.notes ?? ""
  ];
}
