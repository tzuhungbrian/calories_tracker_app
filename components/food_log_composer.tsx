"use client";

import { ArrowLeft, Calculator, CheckCircle2, Clock3, Database, Plus, Search, Sparkles, Utensils, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CategorySelect } from "@/components/category_select";
import { DecimalNumberInput } from "@/components/decimal_number_input";
import { useModalAccessibility } from "@/components/use_modal_accessibility";
import { mealOptions } from "@/lib/food_options";
import type { CommonFood, FoodLog, FoodLogInput } from "@/lib/types";

type FoodLogComposerProps = {
  foods: CommonFood[];
  recentLogs?: FoodLog[];
  value: FoodLogInput;
  isSaving: boolean;
  onChange: (value: FoodLogInput) => void;
  onSubmit: () => Promise<boolean>;
  onSubmitMany?: (logs: FoodLogInput[]) => Promise<boolean>;
};

const macroFields: Array<keyof Pick<FoodLogInput, "calories" | "protein" | "fat" | "carbs">> = [
  "calories",
  "protein",
  "fat",
  "carbs"
];

const macroLabels: Record<(typeof macroFields)[number], string> = {
  calories: "Calories",
  protein: "Protein",
  fat: "Fat",
  carbs: "Carbs"
};

const mobileSteps = ["Meal", "Food", "Review"] as const;
type MobileStep = (typeof mobileSteps)[number];
const desktopSteps = ["Meal", "Food", "Amount", "Review"] as const;
type DesktopStep = (typeof desktopSteps)[number];

type LabelScaleState = {
  baseAmount: number;
  consumedAmount: number;
  unit: "ml" | "g";
} & Pick<FoodLogInput, "calories" | "protein" | "fat" | "carbs">;

const defaultLabelScale: LabelScaleState = {
  baseAmount: 100,
  consumedAmount: 600,
  unit: "ml",
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0
};

type SelectedSavedFood = {
  food: CommonFood;
  servings: number;
};

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateScaledMacros(labelScale: LabelScaleState): Pick<FoodLogInput, "calories" | "protein" | "fat" | "carbs"> {
  const multiplier = labelScale.baseAmount > 0 ? labelScale.consumedAmount / labelScale.baseAmount : 0;

  return {
    calories: roundMacro(labelScale.calories * multiplier),
    protein: roundMacro(labelScale.protein * multiplier),
    fat: roundMacro(labelScale.fat * multiplier),
    carbs: roundMacro(labelScale.carbs * multiplier)
  };
}

export function FoodLogComposer({ foods, recentLogs = [], value, isSaving, onChange, onSubmit, onSubmitMany }: FoodLogComposerProps) {
  const [entryMode, setEntryMode] = useState<"saved" | "custom">("saved");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<SelectedSavedFood[]>([]);
  const [customMacroMode, setCustomMacroMode] = useState<"total" | "label">("total");
  const [labelScale, setLabelScale] = useState<LabelScaleState>(defaultLabelScale);
  const [quickPickMode, setQuickPickMode] = useState<"recent" | "frequent">("recent");
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileStep>("Meal");
  const [desktopStep, setDesktopStep] = useState<DesktopStep>("Meal");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const mobileDialogRef = useModalAccessibility(isMobileSheetOpen, () => setIsMobileSheetOpen(false));

  const categories = useMemo(
    () =>
      Array.from(new Set(foods.map((food) => food.category || "Uncategorized")))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [foods]
  );

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return foods
      .filter((food) => !selectedCategory || (food.category || "Uncategorized") === selectedCategory)
      .filter((food) => !normalizedQuery || food.name.toLowerCase().includes(normalizedQuery));
  }, [foods, query, selectedCategory]);

  const recentFoods = useMemo(() => {
    const seen = new Set<string>();

    return [...recentLogs]
      .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
      .map((log) => foods.find((food) => (log.foodId && food.id === log.foodId) || food.name.toLowerCase() === log.foodName.toLowerCase()))
      .filter((food): food is CommonFood => Boolean(food))
      .filter((food) => {
        if (seen.has(food.id)) {
          return false;
        }
        seen.add(food.id);
        return true;
      })
      .slice(0, 10);
  }, [foods, recentLogs]);

  const frequentFoods = useMemo(() => {
    const foodStats = new Map<string, { food: CommonFood; count: number; lastSeen: string }>();

    recentLogs.forEach((log) => {
      const food = foods.find((item) => (log.foodId && item.id === log.foodId) || item.name.toLowerCase() === log.foodName.toLowerCase());
      if (!food) {
        return;
      }

      const current = foodStats.get(food.id);
      const lastSeen = log.createdAt || log.date;
      foodStats.set(food.id, {
        food,
        count: (current?.count ?? 0) + 1,
        lastSeen: current && current.lastSeen > lastSeen ? current.lastSeen : lastSeen
      });
    });

    return Array.from(foodStats.values())
      .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen) || a.food.name.localeCompare(b.food.name))
      .map((item) => item.food)
      .slice(0, 10);
  }, [foods, recentLogs]);

  const quickPickFoods = quickPickMode === "recent" ? recentFoods : frequentFoods;

  const selectedFoodSummary =
    entryMode === "saved"
      ? selectedFoods.length === 0
        ? ""
        : selectedFoods.length === 1
          ? selectedFoods[0].food.name
          : `${selectedFoods.length} foods selected`
      : value.foodName;

  const selectedSavedTotals = selectedFoods.reduce(
    (totals, item) => ({
      calories: totals.calories + item.food.calories * item.servings,
      protein: totals.protein + item.food.protein * item.servings,
      fat: totals.fat + item.food.fat * item.servings,
      carbs: totals.carbs + item.food.carbs * item.servings
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  function buildSavedLog(food: CommonFood, nextServings: number, notes = value.notes || food.notes): FoodLogInput {
    return {
      ...value,
      foodId: food.id,
      foodName: food.name,
      amount: String(nextServings),
      calories: roundMacro(food.calories * nextServings),
      protein: roundMacro(food.protein * nextServings),
      fat: roundMacro(food.fat * nextServings),
      carbs: roundMacro(food.carbs * nextServings),
      notes,
      isAiEstimated: false,
      saveToDatabase: false,
      databaseCategory: ""
    };
  }

  function syncPrimarySavedFood(nextSelectedFoods: SelectedSavedFood[]) {
    const primary = nextSelectedFoods[0];
    if (!primary) {
      onChange({
        ...value,
        foodId: "",
        foodName: "",
        amount: "",
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        notes: "",
        isAiEstimated: false,
        saveToDatabase: false,
        databaseCategory: ""
      });
      return;
    }

    onChange(buildSavedLog(primary.food, primary.servings, primary.food.notes));
  }

  function notesForSavedSubmit(food: CommonFood): string {
    const primaryNotes = selectedFoods[0]?.food.notes ?? "";
    const sharedUserNotes = value.notes && value.notes !== primaryNotes ? value.notes : "";
    return sharedUserNotes || food.notes;
  }

  function toggleSavedFood(food: CommonFood, nextServings = 1) {
    setFeedbackMessage("");
    setSelectedFoods((current) => {
      const exists = current.some((item) => item.food.id === food.id);
      const nextSelectedFoods = exists
        ? current.filter((item) => item.food.id !== food.id)
        : [...current, { food, servings: nextServings }];

      syncPrimarySavedFood(nextSelectedFoods);
      return nextSelectedFoods;
    });
  }

  function applyMobileFood(food: CommonFood, nextServings = 1) {
    setSelectedFoods([{ food, servings: nextServings }]);
    onChange(buildSavedLog(food, nextServings));
    setFeedbackMessage("");
    setMobileStep("Review");
  }

  function switchMode(nextMode: "saved" | "custom") {
    setEntryMode(nextMode);
    setSelectedFoods([]);
    setDesktopStep("Food");
    setFeedbackMessage("");
    if (nextMode === "custom") {
      setCustomMacroMode("total");
      setLabelScale(defaultLabelScale);
      onChange({
        ...value,
        foodId: "",
        foodName: "",
        amount: "1 serving",
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        isAiEstimated: false,
        saveToDatabase: false,
        databaseCategory: ""
      });
    }
  }

  function updateSelectedFoodServings(foodId: string, nextServings: number) {
    const safeServings = Number.isFinite(nextServings) ? Math.max(nextServings, 0) : 0;
    setFeedbackMessage("");
    setSelectedFoods((current) => {
      const nextSelectedFoods = current.map((item) => (item.food.id === foodId ? { ...item, servings: safeServings } : item));
      syncPrimarySavedFood(nextSelectedFoods);
      return nextSelectedFoods;
    });
  }

  function updateCustomField(field: keyof FoodLogInput, fieldValue: string | boolean) {
    setFeedbackMessage("");
    onChange({
      ...value,
      foodId: "",
      [field]: macroFields.includes(field as (typeof macroFields)[number]) ? Number(fieldValue) || 0 : fieldValue
    });
  }

  function applyLabelScale(nextLabelScale: LabelScaleState) {
    const scaledMacros = calculateScaledMacros(nextLabelScale);
    setLabelScale(nextLabelScale);
    setFeedbackMessage("");
    onChange({
      ...value,
      foodId: "",
      amount: nextLabelScale.consumedAmount ? `${nextLabelScale.consumedAmount} ${nextLabelScale.unit}` : "",
      ...scaledMacros
    });
  }

  function updateLabelScale(field: keyof LabelScaleState, fieldValue: string) {
    const nextLabelScale = {
      ...labelScale,
      [field]: field === "unit" ? fieldValue : Number(fieldValue) || 0
    } as LabelScaleState;

    applyLabelScale(nextLabelScale);
  }

  function switchCustomMacroMode(nextMode: "total" | "label") {
    setCustomMacroMode(nextMode);
    if (nextMode === "label") {
      applyLabelScale(labelScale);
    }
  }

  function resetAfterSave() {
    setSelectedFoods([]);
    setQuery("");
    setEntryMode("saved");
    setMobileStep("Food");
    setDesktopStep("Food");
  }

  async function submitLog(): Promise<boolean> {
    const savedLogs = selectedFoods.map((item) => buildSavedLog(item.food, item.servings, notesForSavedSubmit(item.food)));
    const wasSaved = entryMode === "saved" && savedLogs.length > 0 && onSubmitMany ? await onSubmitMany(savedLogs) : await onSubmit();
    if (!wasSaved) {
      return false;
    }

    resetAfterSave();
    setFeedbackMessage(savedLogs.length > 1 ? `${savedLogs.length} foods added to your log.` : "Food added to your log.");
    return true;
  }

  async function submitMobileLog() {
    const wasSaved = await submitLog();
    if (wasSaved) {
      setIsMobileSheetOpen(false);
    }
  }

  const missingRequirements = [
    !value.meal ? "meal" : "",
    !selectedFoodSummary ? "food" : ""
  ].filter(Boolean);
  const canSubmit = !isSaving && missingRequirements.length === 0;
  const mobileStepIndex = mobileSteps.indexOf(mobileStep);
  const desktopStepIndex = desktopSteps.indexOf(desktopStep);
  const canContinueFromMeal = Boolean(value.meal);
  const canContinueFromFood = entryMode === "saved" ? selectedFoods.length > 0 : Boolean(value.foodName);
  const canContinueFromAmount = entryMode === "custom" ? Boolean(value.amount && value.calories >= 0) : Boolean(value.amount);
  const canContinueFromSavedAmount = entryMode === "saved" ? selectedFoods.length > 0 && selectedFoods.every((item) => item.servings > 0) : canContinueFromAmount;
  const canOpenDesktopStep = (step: DesktopStep) =>
    step === "Meal" ||
    (step === "Food" && canContinueFromMeal) ||
    (step === "Amount" && canContinueFromMeal && canContinueFromFood) ||
    (step === "Review" && canContinueFromMeal && canContinueFromFood && canContinueFromSavedAmount);
  const desktopContinueDisabled =
    (desktopStep === "Meal" && !canContinueFromMeal) ||
    (desktopStep === "Food" && !canContinueFromFood) ||
    (desktopStep === "Amount" && !canContinueFromSavedAmount);
  const desktopContinueHint =
    desktopStep === "Meal"
      ? "Choose a meal to continue."
      : desktopStep === "Food"
        ? "Choose or name a food to continue."
        : "Add an amount to review this log.";

  function goToNextDesktopStep() {
    if (desktopStep === "Meal" && canContinueFromMeal) {
      setDesktopStep("Food");
    } else if (desktopStep === "Food" && canContinueFromFood) {
      setDesktopStep("Amount");
    } else if (desktopStep === "Amount" && canContinueFromSavedAmount) {
      setDesktopStep("Review");
    }
  }

  return (
    <>
    <section className="animate-enter min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Utensils size={20} />
            Add food
          </h2>
          <p className="mt-1 text-sm text-slate-500">Quick mobile flow for logging the next item.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{value.date}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        <div className={`rounded-lg border px-2 py-2 ${value.meal ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          <p>Meal</p>
          <p className="mt-1 truncate text-sm text-ink">{value.meal || "Pick"}</p>
        </div>
        <div className={`rounded-lg border px-2 py-2 ${selectedFoodSummary ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          <p>Food</p>
          <p className="mt-1 truncate text-sm text-ink">{selectedFoodSummary || "Choose"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-500">
          <p>Total</p>
          <p className="mt-1 truncate text-sm text-ink">{Math.round(value.calories)} kcal</p>
        </div>
      </div>

      {feedbackMessage ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} />
          {feedbackMessage}
        </p>
      ) : null}

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-sm"
        type="button"
        onClick={() => {
          setFeedbackMessage("");
          setIsMobileSheetOpen(true);
          setMobileStep(value.meal ? selectedFoodSummary ? "Review" : "Food" : "Meal");
        }}
      >
        <Plus size={18} />
        Add food
      </button>

      {recentFoods.length > 0 ? (
        <div className="mt-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock3 size={16} className="text-blue-700" />
            Recent picks
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {recentFoods.map((food) => (
              <button
                key={food.id}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                type="button"
                onClick={() => {
                  setIsMobileSheetOpen(true);
                  applyMobileFood(food);
                }}
              >
                {food.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>

    {isMobileSheetOpen && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-50 overflow-hidden lg:hidden" role="dialog" aria-modal="true" aria-label="Add food">
        <button
          aria-label="Close add food"
          className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
          type="button"
          onClick={() => setIsMobileSheetOpen(false)}
        />
        <div ref={mobileDialogRef} className="mobile-sheet-enter absolute inset-x-0 bottom-0 flex max-h-[90dvh] w-full min-w-0 max-w-full flex-col overflow-x-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0 shrink-0 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-700">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Step {mobileStepIndex + 1} of {mobileSteps.length}</p>
                <h2 className="text-xl font-semibold">Add food</h2>
              </div>
              <button
                aria-label="Close add food"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                type="button"
                onClick={() => setIsMobileSheetOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {mobileSteps.map((step, index) => (
                <button
                  key={step}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${mobileStep === step ? "bg-ink text-white" : index < mobileStepIndex ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}
                  type="button"
                  onClick={() => setMobileStep(step)}
                >
                  {step}
                </button>
              ))}
            </div>
          </div>

          <div
            key={mobileStep}
            className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
          >
            {mobileStep === "Meal" ? (
              <div className="grid min-w-0 max-w-full gap-4">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Date
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                    type="date"
                    value={value.date}
                    onChange={(event) => onChange({ ...value, date: event.target.value })}
                  />
                </label>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Meal</p>
                    {!value.meal ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Required</span> : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {mealOptions.map((meal) => (
                      <button
                        key={meal}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold ${value.meal === meal ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 dark:bg-slate-900"}`}
                        type="button"
                        onClick={() => {
                          setFeedbackMessage("");
                          onChange({ ...value, meal });
                        }}
                      >
                        {meal}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {mobileStep === "Food" ? (
              <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
                <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    className={`min-w-0 rounded-md px-4 py-2 text-sm font-semibold ${entryMode === "saved" ? "bg-ink text-white" : "text-slate-600"}`}
                    type="button"
                    onClick={() => switchMode("saved")}
                  >
                    Saved
                  </button>
                  <button
                    className={`min-w-0 rounded-md px-4 py-2 text-sm font-semibold ${entryMode === "custom" ? "bg-ink text-white" : "text-slate-600"}`}
                    type="button"
                    onClick={() => switchMode("custom")}
                  >
                    Custom
                  </button>
                </div>

                {entryMode === "saved" ? (
                  <>
                    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-600">Quick picks</p>
                        <div className="grid grid-cols-2 rounded-md bg-white p-1">
                          {(["recent", "frequent"] as const).map((mode) => <button key={mode} className={`rounded px-2 py-1 text-[11px] font-semibold capitalize ${quickPickMode === mode ? "bg-ink text-white" : "text-slate-500"}`} type="button" onClick={() => setQuickPickMode(mode)}>{mode}</button>)}
                        </div>
                      </div>
                      <div className="mt-2 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
                        {quickPickFoods.map((food) => <button key={food.id} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700" type="button" onClick={() => toggleSavedFood(food)}>{food.name}</button>)}
                      </div>
                    </div>
                    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Search size={16} />
                        Find food
                      </span>
                      <input
                        className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
                        placeholder="Search saved foods"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
                      <button
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${!selectedCategory ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 dark:bg-slate-900"}`}
                        type="button"
                        onClick={() => setSelectedCategory("")}
                      >
                        All
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category}
                          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedCategory === category ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 dark:bg-slate-900"}`}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-slate-500">{filteredFoods.length} results</p>
                    {selectedFoods.length > 0 ? (
                      <div className="sticky top-0 z-10 min-w-0 max-w-full overflow-hidden rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                        <p>{selectedFoods.length} selected</p>
                        <div className="mt-2 flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1">{selectedFoods.map((item) => <button key={item.food.id} className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs" type="button" onClick={() => toggleSavedFood(item.food)}>{item.food.name} ×</button>)}</div>
                      </div>
                    ) : null}
                    <div className="grid min-w-0 max-w-full gap-2 pr-1">
                      {filteredFoods.slice(0, 60).map((food) => {
                        const isSelected = selectedFoods.some((item) => item.food.id === food.id);

                        return (
                          <button
                            key={food.id}
                            className={`min-w-0 max-w-full overflow-hidden rounded-xl border p-3 text-left transition ${isSelected ? "border-blue-200 bg-blue-50 shadow-sm" : "border-slate-200 bg-white dark:bg-slate-900"}`}
                            type="button"
                            onClick={() => toggleSavedFood(food)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{food.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{food.serving || "1 serving"}</p>
                              </div>
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${isSelected ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"}`}>
                                {isSelected ? <CheckCircle2 size={13} /> : null}
                                {isSelected ? "Selected" : `${food.calories} kcal`}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-700">P {food.protein} / F {food.fat} / C {food.carbs}</p>
                          </button>
                        );
                      })}
                      {filteredFoods.length > 60 ? <p className="rounded-lg bg-slate-50 p-3 text-center text-xs font-medium text-slate-500">Showing 60 results. Search or choose a category to narrow the list.</p> : null}
                    </div>
                  </>
                ) : (
                  <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
                    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                      Custom food name
                      <input
                        className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
                        placeholder="AI estimated chicken rice plate"
                        value={value.foodName}
                        onChange={(event) => updateCustomField("foodName", event.target.value)}
                      />
                    </label>
                    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                      Amount / serving
                      <input
                        className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
                        placeholder="1 plate"
                        value={value.amount}
                        onChange={(event) => updateCustomField("amount", event.target.value)}
                      />
                    </label>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                      <label className="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input checked={value.isAiEstimated ?? false} type="checkbox" onChange={(event) => updateCustomField("isAiEstimated", event.target.checked)} />
                        <Sparkles size={16} className="text-blue-700" />
                        AI estimated
                      </label>
                      <label className="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input checked={value.saveToDatabase ?? false} type="checkbox" onChange={(event) => updateCustomField("saveToDatabase", event.target.checked)} />
                        <Database size={16} />
                        Save food
                      </label>
                    </div>
                    {value.saveToDatabase ? (
                      <CategorySelect
                        categories={["AI estimates", ...categories]}
                        label="Database category"
                        value={value.databaseCategory || "AI estimates"}
                        onChange={(nextCategory) => updateCustomField("databaseCategory", nextCategory)}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {mobileStep === "Review" ? (
              <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready to log</p>
                  <h3 className="mt-1 text-lg font-semibold">{selectedFoodSummary || "Choose a food"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{value.meal || "No meal"} - {entryMode === "saved" ? `${selectedFoods.length} item${selectedFoods.length === 1 ? "" : "s"}` : value.amount || "1 serving"}</p>
                </div>

                {entryMode === "saved" ? (
                  <div className="grid gap-3">
                    {selectedFoods.map((item) => (
                      <div key={item.food.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{item.food.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.food.serving || "1 serving"}</p>
                          </div>
                          <button className="text-xs font-semibold text-slate-500" type="button" onClick={() => toggleSavedFood(item.food)}>
                            Remove
                          </button>
                        </div>
                        <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
                          Servings
                          <input
                            className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                            min="0"
                            step="0.1"
                            type="number"
                            value={item.servings}
                            onChange={(event) => updateSelectedFoodServings(item.food.id, Number(event.target.value))}
                          />
                        </label>
                        <div className="mt-2 grid grid-cols-4 gap-1">
                          {[0.5, 1, 1.5, 2].map((amount) => (
                            <button
                              key={amount}
                              className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${item.servings === amount ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                              type="button"
                              onClick={() => updateSelectedFoodServings(item.food.id, amount)}
                            >
                              {amount}x
                            </button>
                          ))}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          {roundMacro(item.food.calories * item.servings)} kcal / P {roundMacro(item.food.protein * item.servings)} / F {roundMacro(item.food.fat * item.servings)} / C {roundMacro(item.food.carbs * item.servings)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="inline-grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                      <button
                        className={`rounded px-3 py-1.5 text-xs font-semibold ${customMacroMode === "total" ? "bg-ink text-white" : "text-slate-600"}`}
                        type="button"
                        onClick={() => switchCustomMacroMode("total")}
                      >
                        Enter total
                      </button>
                      <button
                        className={`rounded px-3 py-1.5 text-xs font-semibold ${customMacroMode === "label" ? "bg-ink text-white" : "text-slate-600"}`}
                        type="button"
                        onClick={() => switchCustomMacroMode("label")}
                      >
                        Scale from label
                      </button>
                    </div>
                    {customMacroMode === "label" ? (
                      <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
                        <div className="grid grid-cols-[1fr_1fr_82px] gap-2">
                          <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                            Label
                            <DecimalNumberInput className="w-full rounded-md border border-slate-300 px-2 py-2" value={labelScale.baseAmount} onValueChange={(nextValue) => updateLabelScale("baseAmount", String(nextValue))} />
                          </label>
                          <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                            I had
                            <DecimalNumberInput className="w-full rounded-md border border-slate-300 px-2 py-2" value={labelScale.consumedAmount} onValueChange={(nextValue) => updateLabelScale("consumedAmount", String(nextValue))} />
                          </label>
                          <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                            Unit
                            <select className="w-full rounded-md border border-slate-300 px-2 py-2" value={labelScale.unit} onChange={(event) => updateLabelScale("unit", event.target.value)}>
                              <option value="ml">ml</option>
                              <option value="g">g</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {macroFields.map((field) => (
                            <label key={field} className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {macroLabels[field]} / label
                              <DecimalNumberInput
                                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold"
                                value={labelScale[field]}
                                onValueChange={(nextValue) => updateLabelScale(field, String(nextValue))}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {macroFields.map((field) => (
                    <div key={field} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{macroLabels[field]}</p>
                      {entryMode === "custom" && customMacroMode === "total" ? (
                        <DecimalNumberInput
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-lg font-semibold"
                          value={value[field]}
                          onValueChange={(nextValue) => updateCustomField(field, String(nextValue))}
                        />
                      ) : (
                        <p className="mt-1 text-lg font-semibold">
                          {entryMode === "saved" ? roundMacro(selectedSavedTotals[field]) : value[field]} <span className="text-xs font-normal text-slate-500">{field === "calories" ? "kcal" : "g"}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-2 font-normal"
                    placeholder="Optional"
                    value={value.notes}
                    onChange={(event) => onChange({ ...value, notes: event.target.value })}
                  />
                </label>

                {missingRequirements.length > 0 ? (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                    Add food is disabled until you choose a {missingRequirements.join(" and ")}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-40"
                disabled={mobileStep === "Meal"}
                type="button"
                onClick={() => setMobileStep(mobileSteps[Math.max(mobileStepIndex - 1, 0)])}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              {mobileStep !== "Review" ? (
                <button
                  className="h-12 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={mobileStep === "Meal" ? !canContinueFromMeal : !canContinueFromFood}
                  type="button"
                  onClick={() => setMobileStep(mobileStep === "Meal" ? "Food" : "Review")}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="h-12 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!canSubmit}
                  type="button"
                  onClick={submitMobileLog}
                >
                  {isSaving ? "Adding..." : "Add food"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    ) : null}

    <section className="hidden animate-enter min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Utensils size={20} />
            Add food
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Follow one clear step at a time: meal, food, amount, then review.</p>
        </div>
        <label className="grid w-full max-w-[11rem] gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Date
          <input
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/70">
        {desktopSteps.map((step, index) => {
          const isActive = step === desktopStep;
          const isComplete = index < desktopStepIndex;
          const isEnabled = canOpenDesktopStep(step);

          return (
            <button
              key={step}
              className={`group relative overflow-hidden rounded-xl px-3 py-3 text-left transition duration-300 disabled:cursor-not-allowed ${
                isActive
                  ? "bg-ink text-white shadow-sm dark:bg-blue-600"
                  : isComplete
                    ? "bg-emerald-50 text-emerald-800 hover:-translate-y-0.5 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : isEnabled
                      ? "bg-white text-slate-700 hover:-translate-y-0.5 hover:shadow-sm dark:bg-slate-900 dark:text-slate-200"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-900/50 dark:text-slate-600"
              }`}
              disabled={!isEnabled}
              type="button"
              onClick={() => setDesktopStep(step)}
            >
              <span className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${isActive ? "bg-white/15 text-white" : isComplete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {isComplete ? <CheckCircle2 size={15} /> : index + 1}
                </span>
                <span className="font-semibold">{step}</span>
              </span>
              <span className={`absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full transition-transform duration-300 ${isActive ? "scale-x-100 bg-white/70" : "scale-x-0 bg-blue-400 group-hover:scale-x-100"}`} />
            </button>
          );
        })}
      </div>

      {feedbackMessage ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 size={16} />
          {feedbackMessage}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Step {desktopStepIndex + 1} of {desktopSteps.length}</p>
          <h3 className="mt-1 text-lg font-semibold">
            {desktopStep === "Meal" ? "When are you logging this?" : desktopStep === "Food" ? "What did you eat?" : desktopStep === "Amount" ? "How much should this count?" : "Review and add"}
          </h3>
        </div>

        <div className="min-h-[24rem] p-4">
          {desktopStep === "Meal" ? (
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pick the meal first</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This keeps the rest of the flow focused on one log entry.</p>
                </div>
                {!value.meal ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">Required</span> : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {mealOptions.map((meal) => (
                  <button
                    key={meal}
                    className={`rounded-2xl border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                      value.meal === meal
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    }`}
                    type="button"
                    onClick={() => {
                      setFeedbackMessage("");
                      onChange({ ...value, meal });
                      setDesktopStep("Food");
                    }}
                  >
                    <span className="block text-base font-semibold">{meal}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{value.meal === meal ? "Selected" : "Tap to continue"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {desktopStep === "Food" ? (
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Choose saved food or create a one-off entry</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Saved foods calculate macros automatically; custom entries are useful for AI estimates.</p>
                </div>
                <div className="inline-grid rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
                  <button
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${entryMode === "saved" ? "bg-ink text-white dark:bg-blue-600" : "text-slate-600 dark:text-slate-300"}`}
                    type="button"
                    onClick={() => switchMode("saved")}
                  >
                    Saved foods
                  </button>
                  <button
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${entryMode === "custom" ? "bg-ink text-white dark:bg-blue-600" : "text-slate-600 dark:text-slate-300"}`}
                    type="button"
                    onClick={() => switchMode("custom")}
                  >
                    Custom food
                  </button>
                </div>
              </div>

              {entryMode === "saved" ? (
                <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                  <div className="grid min-w-0 content-start gap-3">
                    <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Category
                      <select
                        className="h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                        value={selectedCategory}
                        onChange={(event) => setSelectedCategory(event.target.value)}
                      >
                        <option value="">All foods</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    {recentFoods.length > 0 || frequentFoods.length > 0 ? (
                      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                        <div className="flex items-center justify-between gap-2">
                          <p className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <Clock3 size={16} className="text-blue-700 dark:text-blue-300" />
                            Quick picks
                          </p>
                          <div className="grid shrink-0 grid-cols-2 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
                            {(["recent", "frequent"] as const).map((mode) => (
                              <button
                                key={mode}
                                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${quickPickMode === mode ? "bg-ink text-white dark:bg-blue-600" : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                                type="button"
                                onClick={() => setQuickPickMode(mode)}
                              >
                                {mode === "recent" ? "Recent" : "Frequent"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid max-h-[27rem] min-w-0 gap-2 overflow-y-auto pr-1">
                          {quickPickFoods.length > 0 ? (
                            quickPickFoods.map((food) => {
                              const isSelected = selectedFoods.some((item) => item.food.id === food.id);

                              return (
                                <button
                                  key={food.id}
                                  className={`min-w-0 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm font-semibold transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-950/30 ${isSelected ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 bg-white text-slate-700"}`}
                                  type="button"
                                  onClick={() => toggleSavedFood(food)}
                                >
                                  <span className="flex min-w-0 items-center justify-between gap-2">
                                    <span className="min-w-0 truncate">{food.name}</span>
                                    {isSelected ? <CheckCircle2 className="shrink-0" size={15} /> : null}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                              No frequent foods yet.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <Search size={16} />
                        Find food
                      </span>
                      <input
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                        placeholder="Search saved foods"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    {selectedFoods.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                        {selectedFoods.length} selected for {value.meal}. Continue to adjust each serving.
                      </div>
                    ) : null}
                    <div className="mt-3 grid max-h-[23rem] min-w-0 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                      {filteredFoods.map((food) => {
                        const isSelected = selectedFoods.some((item) => item.food.id === food.id);

                        return (
                          <button
                            key={food.id}
                            className={`rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm dark:hover:bg-blue-950/30 ${isSelected ? "border-blue-200 bg-blue-50 shadow-sm dark:border-blue-800 dark:bg-blue-950/40" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}
                            type="button"
                            onClick={() => toggleSavedFood(food)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">{food.name}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{food.serving || "1 serving"}</p>
                              </div>
                              {isSelected ? <CheckCircle2 className="shrink-0 text-blue-700 dark:text-blue-200" size={18} /> : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                              {food.calories} kcal / P {food.protein} / F {food.fat} / C {food.carbs}
                            </p>
                          </button>
                        );
                      })}
                      {filteredFoods.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 md:col-span-2">
                          No saved foods match this search.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Custom food name
                      <input
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                        placeholder="e.g. AI estimated chicken rice plate"
                        value={value.foodName}
                        onChange={(event) => updateCustomField("foodName", event.target.value)}
                      />
                    </label>
                    <div className="grid gap-2">
                      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <input checked={value.isAiEstimated ?? false} type="checkbox" onChange={(event) => updateCustomField("isAiEstimated", event.target.checked)} />
                        <Sparkles size={16} className="text-blue-700 dark:text-blue-300" />
                        AI estimated
                      </label>
                      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <input checked={value.saveToDatabase ?? false} type="checkbox" onChange={(event) => updateCustomField("saveToDatabase", event.target.checked)} />
                        <Database size={16} className="text-slate-700 dark:text-slate-200" />
                        Save to database
                      </label>
                    </div>
                  </div>
                  {value.saveToDatabase ? (
                    <CategorySelect
                      categories={["AI estimates", ...categories]}
                      label="Database category"
                      value={value.databaseCategory || "AI estimates"}
                      onChange={(nextCategory) => updateCustomField("databaseCategory", nextCategory)}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {desktopStep === "Amount" ? (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedFoodSummary || "Selected food"}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entryMode === "saved" ? "Adjust servings and the macro preview updates automatically." : "Enter total macros, or scale from a nutrition label."}</p>
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  type="button"
                  onClick={() => setDesktopStep("Food")}
                >
                  Change food
                </button>
              </div>

              {entryMode === "saved" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedFoods.map((item) => (
                    <div key={item.food.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.food.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.food.serving || "1 serving"}</p>
                        </div>
                        <button
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          type="button"
                          onClick={() => toggleSavedFood(item.food)}
                        >
                          Remove
                        </button>
                      </div>
                      <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Servings
                        <input
                          className="h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                          min="0"
                          step="0.1"
                          type="number"
                          value={item.servings}
                          onChange={(event) => updateSelectedFoodServings(item.food.id, Number(event.target.value))}
                        />
                        <span className="grid grid-cols-4 gap-2">
                          {[0.5, 1, 1.5, 2].map((amount) => (
                            <button
                              key={amount}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${item.servings === amount ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                              type="button"
                              onClick={() => updateSelectedFoodServings(item.food.id, amount)}
                            >
                              {amount}x
                            </button>
                          ))}
                        </span>
                      </label>
                      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {roundMacro(item.food.calories * item.servings)} kcal / P {roundMacro(item.food.protein * item.servings)} / F {roundMacro(item.food.fat * item.servings)} / C {roundMacro(item.food.carbs * item.servings)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <label className="grid max-w-xs gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Amount / serving
                    <input
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                      placeholder="1 plate"
                      value={value.amount}
                      onChange={(event) => updateCustomField("amount", event.target.value)}
                    />
                  </label>

                  <div className="grid gap-3 rounded-xl bg-white p-3 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          <Calculator size={16} className="text-blue-700 dark:text-blue-300" />
                          Nutrition label helper
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use this when the label says per 100 ml/g, but you log the whole bottle or pack.</p>
                      </div>
                      <div className="inline-grid rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
                        <button
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${customMacroMode === "total" ? "bg-ink text-white dark:bg-blue-600" : "text-slate-600 dark:text-slate-300"}`}
                          type="button"
                          onClick={() => switchCustomMacroMode("total")}
                        >
                          Enter total
                        </button>
                        <button
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${customMacroMode === "label" ? "bg-ink text-white dark:bg-blue-600" : "text-slate-600 dark:text-slate-300"}`}
                          type="button"
                          onClick={() => switchCustomMacroMode("label")}
                        >
                          Scale from label
                        </button>
                      </div>
                    </div>

                    {customMacroMode === "label" ? (
                      <div className="grid gap-3">
                        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_110px]">
                          <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Label amount
                            <DecimalNumberInput
                              className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                              value={labelScale.baseAmount}
                              onValueChange={(nextValue) => updateLabelScale("baseAmount", String(nextValue))}
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            I consumed
                            <DecimalNumberInput
                              className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                              value={labelScale.consumedAmount}
                              onValueChange={(nextValue) => updateLabelScale("consumedAmount", String(nextValue))}
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Unit
                            <select
                              className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                              value={labelScale.unit}
                              onChange={(event) => updateLabelScale("unit", event.target.value)}
                            >
                              <option value="ml">ml</option>
                              <option value="g">g</option>
                            </select>
                          </label>
                        </div>

                        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
                          {macroFields.map((field) => (
                            <label key={field} className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {macroLabels[field]} / label
                              <DecimalNumberInput
                                className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                                value={labelScale[field]}
                                onValueChange={(nextValue) => updateLabelScale(field, String(nextValue))}
                              />
                            </label>
                          ))}
                        </div>

                        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                          Multiplier: {labelScale.baseAmount > 0 ? roundMacro(labelScale.consumedAmount / labelScale.baseAmount) : 0}x. The log uses the scaled total below.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="grid min-w-0 grid-cols-4 gap-2">
                {macroFields.map((field) => (
                  <div key={field} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{macroLabels[field]}</p>
                    {entryMode === "custom" && customMacroMode === "total" ? (
                      <DecimalNumberInput
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-lg font-semibold text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
                        value={value[field]}
                        onValueChange={(nextValue) => updateCustomField(field, String(nextValue))}
                      />
                    ) : (
                      <p className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {entryMode === "saved" ? roundMacro(selectedSavedTotals[field]) : value[field]} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{field === "calories" ? "kcal" : "g"}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {desktopStep === "Review" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ready to log</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink dark:text-slate-100">{selectedFoodSummary || "No food selected"}</h3>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
                  <p className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900"><span className="font-semibold">Meal:</span> {value.meal || "Missing"}</p>
                  <p className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900"><span className="font-semibold">Amount:</span> {entryMode === "saved" ? `${selectedFoods.length} item${selectedFoods.length === 1 ? "" : "s"}` : value.amount || "Missing"}</p>
                  <p className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900"><span className="font-semibold">Source:</span> {entryMode === "custom" ? (value.isAiEstimated ? "AI estimate" : "Custom") : "Saved food"}</p>
                </div>
                {entryMode === "saved" && selectedFoods.length > 1 ? (
                  <div className="mt-4 grid gap-2">
                    {selectedFoods.map((item) => (
                      <p key={item.food.id} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {item.food.name} <span className="font-normal text-slate-500 dark:text-slate-400">x {item.servings}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 grid min-w-0 grid-cols-4 gap-2">
                  {macroFields.map((field) => (
                    <div key={field} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
                      <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{macroLabels[field]}</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {entryMode === "saved" ? roundMacro(selectedSavedTotals[field]) : value[field]} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{field === "calories" ? "kcal" : "g"}</span>
                      </p>
                    </div>
                  ))}
                </div>
                {missingRequirements.length > 0 ? (
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    Add food is disabled until you choose a {missingRequirements.join(" and ")}.
                  </p>
                ) : null}
              </div>
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Notes
                <textarea
                  className="min-h-44 rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-ink outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                  placeholder={entryMode === "custom" ? "Optional. AI estimated entries will be tagged automatically." : "Optional"}
                  value={value.notes}
                  onChange={(event) => onChange({ ...value, notes: event.target.value })}
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={desktopStep === "Meal"}
            type="button"
            onClick={() => setDesktopStep(desktopSteps[Math.max(desktopStepIndex - 1, 0)])}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-3">
            {desktopStep !== "Review" && desktopContinueDisabled ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{desktopContinueHint}</p>
            ) : null}
            {desktopStep !== "Review" ? (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600"
                disabled={desktopContinueDisabled}
                type="button"
                onClick={goToNextDesktopStep}
              >
                Continue
              </button>
            ) : (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSubmit}
                type="button"
                onClick={submitLog}
              >
                <Plus size={18} />
                {isSaving ? "Adding..." : "Add food"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
