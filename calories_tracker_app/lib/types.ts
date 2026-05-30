export type GoalType = "cut" | "maintain" | "bulk";

export type FoodLogInput = {
  date: string;
  meal: string;
  foodName: string;
  amount: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  notes?: string;
};

export type FoodLog = FoodLogInput & {
  id: string;
  createdAt: string;
};

export type CommonFood = {
  name: string;
  serving: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type DailyStatus = {
  date: string;
  goalType: GoalType;
  steps: number;
  strengthSession: boolean;
  creatineTaken: boolean;
  basketballMinutes: number;
};

export type NutritionTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type NutritionTargets = NutritionTotals;

export type DashboardData = {
  date: string;
  totals: NutritionTotals;
  targets: NutritionTargets;
  remaining: NutritionTotals;
  status: DailyStatus | null;
};

export type DailySummary = {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  goalType: GoalType | "";
  steps: number;
  strengthSession: boolean;
  creatineTaken: boolean;
  basketballMinutes: number;
};

export type SheetRow = Record<string, string>;
