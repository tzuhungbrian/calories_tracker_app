import type {
  CommonFood,
  DailyStatus,
  FoodLog,
  FoodLogInput,
  GoalType,
  NutritionSettings,
  NutritionTargets,
  NutritionTotals,
  SheetRow,
  UserProfileSettings
} from "./types";
import { dateKey } from "./date";

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

export const defaultSettings: NutritionSettings = {
  weightKg: 63.7,
  bmr: 1528.5,
  baseActivityFactor: 1.2,
  caloriesPerStep: 0.04,
  exerciseStepGoal: 8000,
  strengthTrainingKcal: 250,
  basketballKcalPerMinute: 8,
  proteinTargetPerKg: 2,
  fatTargetPerKg: 0.9,
  cutAdjustmentKcal: -300,
  maintainAdjustmentKcal: 0,
  bulkAdjustmentKcal: 250
};

export const defaultProfileSettings: UserProfileSettings = {
  ...defaultSettings,
  displayName: "Brian",
  heightCm: 0,
  age: 0,
  sex: "",
  bmrMode: "manual"
};

export function todayKey(): string {
  return dateKey();
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

export function normalizeFoodLog(input: FoodLogInput, existing?: Pick<FoodLog, "id" | "createdAt">): FoodLog {
  const cleanNotes = input.notes?.trim() ?? "";
  const notes = input.isAiEstimated && !cleanNotes.toLowerCase().includes("ai estimated") ? `AI estimated. ${cleanNotes}`.trim() : cleanNotes;

  return {
    id: existing?.id || crypto.randomUUID(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    date: input.date || todayKey(),
    meal: input.meal.trim(),
    foodId: input.foodId ?? "",
    foodName: input.foodName.trim(),
    amount: input.amount.trim(),
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    fat: Number(input.fat) || 0,
    carbs: Number(input.carbs) || 0,
    notes,
    isAiEstimated: input.isAiEstimated ?? false,
    saveToDatabase: input.saveToDatabase ?? false,
    databaseCategory: input.databaseCategory?.trim() ?? ""
  };
}

export function rowToFoodLog(row: SheetRow): FoodLog {
  const notes = valueOf(row, ["notes", "Notes"]) || "";

  return {
    id: valueOf(row, ["id", "ID"]) || "",
    createdAt: valueOf(row, ["createdAt", "CreatedAt", "created_at"]) || "",
    date: valueOf(row, ["date", "Date"]) || "",
    meal: valueOf(row, ["meal", "Meal"]) || "",
    foodId: valueOf(row, ["food_id", "foodId"]) || "",
    foodName: valueOf(row, ["food_name", "foodName", "FoodName", "Food / Item", "food", "Food"]) || "",
    amount: valueOf(row, ["servings", "amount", "Amount", "Servings", "serving", "Serving"]) || "",
    calories: parseNumber(valueOf(row, ["calories", "Final kcal", "Calories", "kcal"])),
    protein: parseNumber(valueOf(row, ["protein", "Final P", "Protein"])),
    fat: parseNumber(valueOf(row, ["fat", "Final F", "Fat"])),
    carbs: parseNumber(valueOf(row, ["carbs", "Final C", "Carbs", "carbohydrates"])),
    notes,
    isAiEstimated: notes.toLowerCase().includes("ai estimated"),
    saveToDatabase: false,
    databaseCategory: ""
  };
}

export function rowToCommonFood(row: SheetRow): CommonFood {
  return {
    id: valueOf(row, ["id"]) || "",
    name: valueOf(row, ["name", "Food name", "Name", "food", "Food"]) || "",
    category: valueOf(row, ["category", "Category"]) || "",
    serving: valueOf(row, ["serving_label", "Serving label", "Serving size", "serving", "Serving", "amount", "Amount"]) || "",
    servingSize: valueOf(row, ["serving_size", "Serving size"]) || "",
    calories: parseNumber(valueOf(row, ["calories", "Calories / serving", "Calories", "kcal"])),
    protein: parseNumber(valueOf(row, ["protein", "Protein (g)", "Protein"])),
    fat: parseNumber(valueOf(row, ["fat", "Fat (g)", "Fat"])),
    carbs: parseNumber(valueOf(row, ["carbs", "Carbs (g)", "Carbs", "carbohydrates"])),
    notes: valueOf(row, ["notes", "Notes"]) || ""
  };
}

export function normalizeCommonFood(input: Partial<CommonFood>): CommonFood {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    name: input.name?.trim() ?? "",
    category: input.category?.trim() || "Uncategorized",
    serving: input.serving?.trim() || "1 serving",
    servingSize: input.servingSize?.trim() ?? "",
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    fat: Number(input.fat) || 0,
    carbs: Number(input.carbs) || 0,
    notes: input.notes?.trim() ?? ""
  };
}

export function commonFoodToSheetRow(food: CommonFood, existingCreatedAt?: string): string[] {
  const now = new Date().toISOString();
  return [
    food.id,
    food.name,
    food.category,
    food.serving,
    food.servingSize,
    String(food.calories),
    String(food.protein),
    String(food.fat),
    String(food.carbs),
    food.notes,
    existingCreatedAt || now,
    now
  ];
}

export function rowToDailyStatus(row: SheetRow): DailyStatus {
  return {
    id: valueOf(row, ["id"]) || "",
    date: valueOf(row, ["date", "Date"]) || "",
    goalType: parseGoalType(valueOf(row, ["goal_type", "Goal Type", "goalType", "GoalType", "goal", "Goal"])),
    steps: parseNumber(valueOf(row, ["steps", "Steps"])),
    strengthSession: parseBoolean(valueOf(row, ["strength_session", "Strength session", "strengthSession", "StrengthSession", "strength", "Strength"])),
    creatineTaken: parseBoolean(valueOf(row, ["creatine_taken", "Creatine Taken", "creatineTaken", "CreatineTaken", "creatine", "Creatine"])),
    basketballMinutes: parseNumber(valueOf(row, ["basketball_minutes", "Basketball minutes", "basketballMinutes", "BasketballMinutes", "basketball", "Basketball"]))
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

export function rowsToSettings(rows: SheetRow[]): NutritionSettings {
  const values = new Map(rows.map((row) => [valueOf(row, ["key"]) || "", valueOf(row, ["value"]) || ""]));

  return {
    weightKg: parseNumber(values.get("weight_kg")) || defaultSettings.weightKg,
    bmr: parseNumber(values.get("bmr")) || defaultSettings.bmr,
    baseActivityFactor: parseNumber(values.get("base_activity_factor")) || defaultSettings.baseActivityFactor,
    caloriesPerStep: parseNumber(values.get("calories_per_step")) || defaultSettings.caloriesPerStep,
    exerciseStepGoal: parseNumber(values.get("exercise_step_goal")) || defaultSettings.exerciseStepGoal,
    strengthTrainingKcal: parseNumber(values.get("strength_training_kcal")) || defaultSettings.strengthTrainingKcal,
    basketballKcalPerMinute: parseNumber(values.get("basketball_kcal_per_minute")) || defaultSettings.basketballKcalPerMinute,
    proteinTargetPerKg: parseNumber(values.get("protein_target_per_kg")) || defaultSettings.proteinTargetPerKg,
    fatTargetPerKg: parseNumber(values.get("fat_target_per_kg")) || defaultSettings.fatTargetPerKg,
    cutAdjustmentKcal: parseNumber(values.get("cut_adjustment_kcal")) || defaultSettings.cutAdjustmentKcal,
    maintainAdjustmentKcal: parseNumber(values.get("maintain_adjustment_kcal")),
    bulkAdjustmentKcal: parseNumber(values.get("bulk_adjustment_kcal")) || defaultSettings.bulkAdjustmentKcal
  };
}

export function rowsToProfileSettings(rows: SheetRow[]): UserProfileSettings {
  const values = new Map(rows.map((row) => [valueOf(row, ["key"]) || "", valueOf(row, ["value"]) || ""]));
  const settings = rowsToSettings(rows);
  const bmrMode: UserProfileSettings["bmrMode"] = values.get("bmr_mode") === "auto" ? "auto" : "manual";
  const profile = {
    ...settings,
    displayName: values.get("display_name") || defaultProfileSettings.displayName,
    heightCm: parseNumber(values.get("height_cm")) || defaultProfileSettings.heightCm,
    age: parseNumber(values.get("age")) || defaultProfileSettings.age,
    sex: values.get("sex") || defaultProfileSettings.sex,
    bmrMode
  };

  return bmrMode === "auto" ? { ...profile, bmr: calculateBmr(profile) || profile.bmr } : profile;
}

export function profileSettingsToKeyValues(settings: UserProfileSettings): Record<string, string> {
  const bmr = settings.bmrMode === "auto" ? calculateBmr(settings) || settings.bmr : settings.bmr;

  return {
    display_name: settings.displayName.trim() || defaultProfileSettings.displayName,
    height_cm: String(Number(settings.heightCm) || 0),
    age: String(Number(settings.age) || 0),
    sex: settings.sex.trim(),
    bmr_mode: settings.bmrMode,
    weight_kg: String(Number(settings.weightKg) || defaultSettings.weightKg),
    bmr: String(Number(bmr) || defaultSettings.bmr),
    base_activity_factor: String(Number(settings.baseActivityFactor) || defaultSettings.baseActivityFactor),
    calories_per_step: String(Number(settings.caloriesPerStep) || defaultSettings.caloriesPerStep),
    exercise_step_goal: String(Number(settings.exerciseStepGoal) || defaultSettings.exerciseStepGoal),
    strength_training_kcal: String(Number(settings.strengthTrainingKcal) || defaultSettings.strengthTrainingKcal),
    basketball_kcal_per_minute: String(Number(settings.basketballKcalPerMinute) || defaultSettings.basketballKcalPerMinute),
    protein_target_per_kg: String(Number(settings.proteinTargetPerKg) || defaultSettings.proteinTargetPerKg),
    fat_target_per_kg: String(Number(settings.fatTargetPerKg) || defaultSettings.fatTargetPerKg),
    cut_adjustment_kcal: String(Number(settings.cutAdjustmentKcal) || defaultSettings.cutAdjustmentKcal),
    maintain_adjustment_kcal: String(Number(settings.maintainAdjustmentKcal) || defaultSettings.maintainAdjustmentKcal),
    bulk_adjustment_kcal: String(Number(settings.bulkAdjustmentKcal) || defaultSettings.bulkAdjustmentKcal)
  };
}

export function calculateBmr(settings: Pick<UserProfileSettings, "weightKg" | "heightCm" | "age" | "sex">): number {
  const sex = settings.sex.trim().toLowerCase();

  if (!settings.weightKg || !settings.heightCm || !settings.age || (sex !== "male" && sex !== "female")) {
    return 0;
  }

  const sexAdjustment = sex === "male" ? 5 : -161;
  return Math.round(10 * settings.weightKg + 6.25 * settings.heightCm - 5 * settings.age + sexAdjustment);
}

export function calculateDynamicTdee(status: DailyStatus | null, settings: NutritionSettings): number {
  const steps = status?.steps ?? 0;
  const strengthCalories = status?.strengthSession ? settings.strengthTrainingKcal : 0;
  const basketballCalories = (status?.basketballMinutes ?? 0) * settings.basketballKcalPerMinute;

  return Math.round(settings.bmr * settings.baseActivityFactor + steps * settings.caloriesPerStep + strengthCalories + basketballCalories);
}

export function calculateTargets(status: DailyStatus | null, settings: NutritionSettings): NutritionTargets {
  const goalType = status?.goalType ?? "maintain";
  const adjustment =
    goalType === "cut"
      ? settings.cutAdjustmentKcal
      : goalType === "bulk"
        ? settings.bulkAdjustmentKcal
        : settings.maintainAdjustmentKcal;
  const calories = Math.round(calculateDynamicTdee(status, settings) + adjustment);
  const protein = Math.round(settings.weightKg * settings.proteinTargetPerKg);
  const fat = Math.round(settings.weightKg * settings.fatTargetPerKg);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, fat, carbs };
}

export function statusToSheetRow(status: DailyStatus): string[] {
  const now = new Date().toISOString();
  return [
    status.id || crypto.randomUUID(),
    status.date,
    status.goalType,
    String(status.steps),
    String(status.strengthSession),
    String(status.creatineTaken),
    String(status.basketballMinutes),
    "",
    "",
    now
  ];
}

export function foodLogToSheetRow(log: FoodLog): string[] {
  const now = new Date().toISOString();
  return [
    log.id,
    log.date,
    log.meal,
    log.foodId || "",
    log.foodName,
    log.amount || "1",
    String(log.calories),
    String(log.protein),
    String(log.fat),
    String(log.carbs),
    log.notes ?? "",
    log.createdAt || now,
    now
  ];
}
