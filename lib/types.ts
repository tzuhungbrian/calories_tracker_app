export type GoalType = "cut" | "maintain" | "bulk";

export type FoodLogInput = {
  date: string;
  meal: string;
  foodId?: string;
  foodName: string;
  amount: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  notes?: string;
  isAiEstimated?: boolean;
  saveToDatabase?: boolean;
  databaseCategory?: string;
};

export type FoodLog = FoodLogInput & {
  id: string;
  createdAt: string;
};

export type CommonFood = {
  id: string;
  name: string;
  category: string;
  serving: string;
  servingSize: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  notes: string;
};

export type DailyStatus = {
  id?: string;
  date: string;
  goalType: GoalType;
  steps: number;
  strengthSession: boolean;
  creatineTaken: boolean;
  basketballMinutes: number;
  isTravelDay: boolean;
};

export type NutritionTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type NutritionTargets = NutritionTotals;

export type NutritionSettings = {
  weightKg: number;
  bmr: number;
  baseActivityFactor: number;
  caloriesPerStep: number;
  exerciseStepGoal: number;
  strengthTrainingKcal: number;
  basketballKcalPerMinute: number;
  proteinTargetPerKg: number;
  fatTargetPerKg: number;
  cutAdjustmentKcal: number;
  maintainAdjustmentKcal: number;
  bulkAdjustmentKcal: number;
};

export type UserProfileSettings = NutritionSettings & {
  displayName: string;
  heightCm: number;
  age: number;
  sex: string;
  bmrMode: "auto" | "manual";
};

export type DashboardData = {
  date: string;
  totals: NutritionTotals;
  targets: NutritionTargets;
  dynamicTdee: number;
  exerciseStepGoal: number;
  remaining: NutritionTotals;
  status: DailyStatus | null;
};

export type DailySummary = {
  date: string;
  calories: number;
  calorieTarget: number;
  dynamicTdee: number;
  protein: number;
  proteinGoal: number;
  fat: number;
  carbs: number;
  goalType: GoalType | "";
  isTravelDay: boolean;
  steps: number;
  strengthSession: boolean;
  creatineTaken: boolean;
  basketballMinutes: number;
};

export type SheetRow = Record<string, string>;
