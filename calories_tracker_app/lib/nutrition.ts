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
    id: row.id || row.ID || "",
    createdAt: row.createdAt || row.CreatedAt || row.created_at || "",
    date: row.date || row.Date || "",
    meal: row.meal || row.Meal || "",
    foodName: row.foodName || row.FoodName || row.food || row.Food || "",
    amount: row.amount || row.Amount || row.serving || row.Serving || "",
    calories: parseNumber(row.calories || row.Calories || row.kcal),
    protein: parseNumber(row.protein || row.Protein),
    fat: parseNumber(row.fat || row.Fat),
    carbs: parseNumber(row.carbs || row.Carbs || row.carbohydrates)
  };
}

export function rowToCommonFood(row: SheetRow): CommonFood {
  return {
    name: row.name || row.Name || row.food || row.Food || "",
    serving: row.serving || row.Serving || row.amount || row.Amount || "",
    calories: parseNumber(row.calories || row.Calories || row.kcal),
    protein: parseNumber(row.protein || row.Protein),
    fat: parseNumber(row.fat || row.Fat),
    carbs: parseNumber(row.carbs || row.Carbs || row.carbohydrates)
  };
}

export function rowToDailyStatus(row: SheetRow): DailyStatus {
  return {
    date: row.date || row.Date || "",
    goalType: parseGoalType(row.goalType || row.GoalType || row.goal || row.Goal),
    steps: parseNumber(row.steps || row.Steps),
    strengthSession: parseBoolean(row.strengthSession || row.StrengthSession || row.strength || row.Strength),
    creatineTaken: parseBoolean(row.creatineTaken || row.CreatineTaken || row.creatine || row.Creatine),
    basketballMinutes: parseNumber(row.basketballMinutes || row.BasketballMinutes || row.basketball || row.Basketball)
  };
}

export function statusToSheetRow(status: DailyStatus): string[] {
  return [
    status.date,
    status.goalType,
    String(status.steps),
    String(status.strengthSession),
    String(status.creatineTaken),
    String(status.basketballMinutes)
  ];
}

export function foodLogToSheetRow(log: FoodLog): string[] {
  return [
    log.id,
    log.createdAt,
    log.date,
    log.meal,
    log.foodName,
    log.amount,
    String(log.calories),
    String(log.protein),
    String(log.fat),
    String(log.carbs),
    log.notes ?? ""
  ];
}
