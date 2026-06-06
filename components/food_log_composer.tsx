"use client";

import { ArrowLeft, Calculator, CheckCircle2, Clock3, Database, Plus, Search, Sparkles, Utensils, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CategorySelect } from "@/components/category_select";
import type { CommonFood, FoodLog, FoodLogInput } from "@/lib/types";

type FoodLogComposerProps = {
  foods: CommonFood[];
  recentLogs?: FoodLog[];
  value: FoodLogInput;
  isSaving: boolean;
  onChange: (value: FoodLogInput) => void;
  onSubmit: () => Promise<boolean>;
};

const mealOptions = ["Breakfast", "Lunch", "Dinner", "Snack", "Supplements", "Drinks"];
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

export function FoodLogComposer({ foods, recentLogs = [], value, isSaving, onChange, onSubmit }: FoodLogComposerProps) {
  const [entryMode, setEntryMode] = useState<"saved" | "custom">("saved");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<CommonFood | null>(null);
  const [servings, setServings] = useState(1);
  const [customMacroMode, setCustomMacroMode] = useState<"total" | "label">("total");
  const [labelScale, setLabelScale] = useState<LabelScaleState>(defaultLabelScale);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileStep>("Meal");
  const [feedbackMessage, setFeedbackMessage] = useState("");

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
      .slice(0, 6);
  }, [foods, recentLogs]);

  function applyFood(food: CommonFood, nextServings = servings) {
    setSelectedFood(food);
    setServings(nextServings);
    setFeedbackMessage("");
    onChange({
      ...value,
      foodId: food.id,
      foodName: food.name,
      amount: String(nextServings),
      calories: roundMacro(food.calories * nextServings),
      protein: roundMacro(food.protein * nextServings),
      fat: roundMacro(food.fat * nextServings),
      carbs: roundMacro(food.carbs * nextServings),
      notes: value.foodId === food.id && value.notes ? value.notes : food.notes,
      isAiEstimated: false,
      saveToDatabase: false,
      databaseCategory: ""
    });
  }

  function applyMobileFood(food: CommonFood, nextServings = 1) {
    applyFood(food, nextServings);
    setMobileStep("Review");
  }

  function switchMode(nextMode: "saved" | "custom") {
    setEntryMode(nextMode);
    setSelectedFood(null);
    setServings(1);
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

  function updateServings(nextServings: number) {
    const safeServings = Number.isFinite(nextServings) ? Math.max(nextServings, 0) : 0;
    setServings(safeServings);
    setFeedbackMessage("");
    if (selectedFood) {
      applyFood(selectedFood, safeServings);
    } else {
      onChange({ ...value, amount: String(safeServings) });
    }
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
    setSelectedFood(null);
    setServings(1);
    setQuery("");
    setEntryMode("saved");
    setMobileStep("Meal");
  }

  async function submitLog(): Promise<boolean> {
    const wasSaved = await onSubmit();
    if (!wasSaved) {
      return false;
    }

    resetAfterSave();
    setFeedbackMessage("Food added to your log.");
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
    !value.foodName ? "food" : ""
  ].filter(Boolean);
  const canSubmit = !isSaving && missingRequirements.length === 0;
  const mobileStepIndex = mobileSteps.indexOf(mobileStep);
  const canContinueFromMeal = Boolean(value.meal);
  const canContinueFromFood = Boolean(value.foodName);

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
        <div className={`rounded-lg border px-2 py-2 ${value.foodName ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          <p>Food</p>
          <p className="mt-1 truncate text-sm text-ink">{value.foodName || "Choose"}</p>
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
          setMobileStep(value.meal ? value.foodName ? "Review" : "Food" : "Meal");
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
      <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Add food">
        <button
          aria-label="Close add food"
          className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
          type="button"
          onClick={() => setIsMobileSheetOpen(false)}
        />
        <div className="mobile-sheet-enter absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-700">
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {mobileStep === "Meal" ? (
              <div className="grid gap-4">
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
              <div className="grid gap-4">
                <div className="inline-grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${entryMode === "saved" ? "bg-ink text-white" : "text-slate-600"}`}
                    type="button"
                    onClick={() => switchMode("saved")}
                  >
                    Saved
                  </button>
                  <button
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${entryMode === "custom" ? "bg-ink text-white" : "text-slate-600"}`}
                    type="button"
                    onClick={() => switchMode("custom")}
                  >
                    Custom
                  </button>
                </div>

                {entryMode === "saved" ? (
                  <>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Search size={16} />
                        Find food
                      </span>
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                        placeholder="Search saved foods"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
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
                    <div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1">
                      {filteredFoods.map((food) => (
                        <button
                          key={food.id}
                          className={`rounded-xl border p-3 text-left transition ${selectedFood?.id === food.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white dark:bg-slate-900"}`}
                          type="button"
                          onClick={() => applyMobileFood(food)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{food.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{food.serving || "1 serving"}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{food.calories} kcal</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">P {food.protein} / F {food.fat} / C {food.carbs}</p>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Custom food name
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                        placeholder="AI estimated chicken rice plate"
                        value={value.foodName}
                        onChange={(event) => updateCustomField("foodName", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Amount / serving
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                        placeholder="1 plate"
                        value={value.amount}
                        onChange={(event) => updateCustomField("amount", event.target.value)}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input checked={value.isAiEstimated ?? false} type="checkbox" onChange={(event) => updateCustomField("isAiEstimated", event.target.checked)} />
                        <Sparkles size={16} className="text-blue-700" />
                        AI estimated
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
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
              <div className="grid gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready to log</p>
                  <h3 className="mt-1 text-lg font-semibold">{value.foodName || "Choose a food"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{value.meal || "No meal"} · {value.amount || "1 serving"}</p>
                </div>

                {entryMode === "saved" ? (
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    Servings
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                      min="0"
                      step="0.1"
                      type="number"
                      value={servings}
                      onChange={(event) => updateServings(Number(event.target.value))}
                    />
                    <span className="mt-1 grid grid-cols-4 gap-1">
                      {[0.5, 1, 1.5, 2].map((amount) => (
                        <button
                          key={amount}
                          className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${servings === amount ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                          type="button"
                          onClick={() => updateServings(amount)}
                        >
                          {amount}x
                        </button>
                      ))}
                    </span>
                  </label>
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
                            <input className="w-full rounded-md border border-slate-300 px-2 py-2" min="0" step="0.1" type="number" value={labelScale.baseAmount} onChange={(event) => updateLabelScale("baseAmount", event.target.value)} />
                          </label>
                          <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                            I had
                            <input className="w-full rounded-md border border-slate-300 px-2 py-2" min="0" step="0.1" type="number" value={labelScale.consumedAmount} onChange={(event) => updateLabelScale("consumedAmount", event.target.value)} />
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
                              <input
                                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold"
                                min="0"
                                step="0.1"
                                type="number"
                                value={labelScale[field]}
                                onChange={(event) => updateLabelScale(field, event.target.value)}
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
                        <input
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-lg font-semibold"
                          min="0"
                          step="0.1"
                          type="number"
                          value={value[field]}
                          onChange={(event) => updateCustomField(field, event.target.value)}
                        />
                      ) : (
                        <p className="mt-1 text-lg font-semibold">
                          {value[field]} <span className="text-xs font-normal text-slate-500">{field === "calories" ? "kcal" : "g"}</span>
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

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-[auto_1fr] gap-2">
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

    <section className="hidden animate-enter min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Utensils size={20} />
            Add food
          </h2>
          <p className="mt-1 text-sm text-slate-500">Choose a saved food or enter a custom AI-estimated meal.</p>
        </div>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-40"
          type="date"
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
        />
      </div>

      <div className="mt-4 inline-grid rounded-lg border border-slate-200 bg-slate-50 p-1 sm:grid-cols-2">
        <button
          className={`rounded-md px-4 py-2 text-sm font-semibold ${entryMode === "saved" ? "bg-ink text-white" : "text-slate-600"}`}
          type="button"
          onClick={() => switchMode("saved")}
        >
          Saved foods
        </button>
        <button
          className={`rounded-md px-4 py-2 text-sm font-semibold ${entryMode === "custom" ? "bg-ink text-white" : "text-slate-600"}`}
          type="button"
          onClick={() => switchMode("custom")}
        >
          Custom food
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">Meal</p>
          {!value.meal ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Required</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {mealOptions.map((meal) => (
            <button
              key={meal}
              className={`hover-lift rounded-full border px-3 py-1.5 text-sm font-medium ${value.meal === meal ? "border-accent bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700"}`}
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
        {!value.meal ? <p className="mt-2 text-sm font-medium text-amber-700">Choose a meal before adding food.</p> : null}
      </div>

      {entryMode === "saved" ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-[220px_1fr]">
          <div>
            <p className="text-sm font-medium text-slate-700">Category</p>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          </div>

          <div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <Search size={16} />
                Find food
              </span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                placeholder="Search saved foods"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="mt-3 grid max-h-72 min-w-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredFoods.map((food) => (
                <button
                  key={food.id}
                  className={`rounded-lg border p-3 text-left transition hover:border-accent hover:bg-blue-50 hover:shadow-sm ${selectedFood?.id === food.id ? "border-accent bg-blue-50" : "border-slate-200"}`}
                  type="button"
                  onClick={() => applyFood(food, 1)}
                >
                  <p className="font-medium">{food.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{food.serving || "1 serving"}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {food.calories} kcal / P {food.protein} / F {food.fat} / C {food.carbs}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-4 lg:grid-cols-[1fr_180px]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Custom food name
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              placeholder="e.g. AI estimated chicken rice plate"
              value={value.foodName}
              onChange={(event) => updateCustomField("foodName", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Amount / serving
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              placeholder="1 plate"
              value={value.amount}
              onChange={(event) => updateCustomField("amount", event.target.value)}
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <input checked={value.isAiEstimated ?? false} type="checkbox" onChange={(event) => updateCustomField("isAiEstimated", event.target.checked)} />
            <Sparkles size={16} className="text-blue-700" />
            AI estimated macros
          </label>
          <label className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <input checked={value.saveToDatabase ?? false} type="checkbox" onChange={(event) => updateCustomField("saveToDatabase", event.target.checked)} />
            <Database size={16} className="text-slate-700" />
            Save to foods database
          </label>
          {value.saveToDatabase ? (
            <div className="lg:col-span-2">
              <CategorySelect
                categories={["AI estimates", ...categories]}
                label="Database category"
                value={value.databaseCategory || "AI estimates"}
                onChange={(nextCategory) => updateCustomField("databaseCategory", nextCategory)}
              />
            </div>
          ) : null}
          <div className="grid gap-3 rounded-lg bg-white p-3 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Calculator size={16} className="text-blue-700" />
                  Nutrition label helper
                </p>
                <p className="mt-1 text-xs text-slate-500">Use this when the label says per 100 ml/g, but you log the whole bottle or pack.</p>
              </div>
              <div className="inline-grid rounded-md border border-slate-200 bg-slate-50 p-1 sm:grid-cols-2">
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
            </div>

            {customMacroMode === "label" ? (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                    Label amount
                    <input
                      className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal"
                      min="0"
                      step="0.1"
                      type="number"
                      value={labelScale.baseAmount}
                      onChange={(event) => updateLabelScale("baseAmount", event.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                    I consumed
                    <input
                      className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal"
                      min="0"
                      step="0.1"
                      type="number"
                      value={labelScale.consumedAmount}
                      onChange={(event) => updateLabelScale("consumedAmount", event.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                    Unit
                    <select
                      className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal"
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
                    <label key={field} className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {macroLabels[field]} / label
                      <input
                        className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold text-slate-900"
                        min="0"
                        step="0.1"
                        type="number"
                        value={labelScale[field]}
                        onChange={(event) => updateLabelScale(field, event.target.value)}
                      />
                    </label>
                  ))}
                </div>

                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                  Multiplier: {labelScale.baseAmount > 0 ? roundMacro(labelScale.consumedAmount / labelScale.baseAmount) : 0}x. The log uses the scaled total below.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {entryMode === "saved" && recentFoods.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock3 size={16} className="text-blue-700" />
            Recent picks
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {recentFoods.map((food) => (
              <button
                key={food.id}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-blue-700"
                type="button"
                onClick={() => applyFood(food, 1)}
              >
                {food.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`mt-5 grid gap-3 ${entryMode === "saved" ? "xl:grid-cols-[180px_minmax(0,1fr)_auto]" : "xl:grid-cols-[minmax(0,1fr)_auto]"} xl:items-end`}>
        {entryMode === "saved" ? (
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Servings
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              min="0"
              step="0.1"
              type="number"
              value={servings}
              onChange={(event) => updateServings(Number(event.target.value))}
            />
            <span className="mt-1 grid grid-cols-4 gap-1">
              {[0.5, 1, 1.5, 2].map((amount) => (
                <button
                  key={amount}
                  className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${servings === amount ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  type="button"
                  onClick={() => updateServings(amount)}
                >
                  {amount}x
                </button>
              ))}
            </span>
          </label>
        ) : null}
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
          {macroFields.map((field) => (
            <div key={field} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{macroLabels[field]}</p>
              {entryMode === "custom" ? (
                customMacroMode === "label" ? (
                  <p className="mt-1 truncate text-lg font-semibold text-slate-900">
                    {value[field]} <span className="text-xs font-normal text-slate-500">{field === "calories" ? "kcal" : "g"}</span>
                  </p>
                ) : (
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-lg font-semibold text-slate-900"
                    min="0"
                    step="0.1"
                    type="number"
                    value={value[field]}
                    onChange={(event) => updateCustomField(field, event.target.value)}
                  />
                )
              ) : (
                <p className="mt-1 truncate text-lg font-semibold text-slate-900">
                  {value[field]} <span className="text-xs font-normal text-slate-500">{field === "calories" ? "kcal" : "g"}</span>
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          className="rounded-md bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
          disabled={!canSubmit}
          type="button"
          onClick={submitLog}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Plus size={18} />
            {isSaving ? "Adding..." : "Add food"}
          </span>
        </button>
      </div>
      {missingRequirements.length > 0 ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
          Add food is disabled until you choose a {missingRequirements.join(" and ")}.
        </p>
      ) : null}
      {feedbackMessage ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} />
          {feedbackMessage}
        </p>
      ) : null}

      <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
        Notes
        <textarea
          className="rounded-md border border-slate-300 px-3 py-2 font-normal"
          placeholder={entryMode === "custom" ? "Optional. AI estimated entries will be tagged automatically." : "Optional"}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
        />
      </label>
    </section>
    </>
  );
}
