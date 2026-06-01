"use client";

import { Calculator, CheckCircle2, Database, Plus, Search, Sparkles, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { CategorySelect } from "@/components/category_select";
import type { CommonFood, FoodLogInput } from "@/lib/types";

type FoodLogComposerProps = {
  foods: CommonFood[];
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

export function FoodLogComposer({ foods, value, isSaving, onChange, onSubmit }: FoodLogComposerProps) {
  const [entryMode, setEntryMode] = useState<"saved" | "custom">("saved");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<CommonFood | null>(null);
  const [servings, setServings] = useState(1);
  const [customMacroMode, setCustomMacroMode] = useState<"total" | "label">("total");
  const [labelScale, setLabelScale] = useState<LabelScaleState>(defaultLabelScale);
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
      isAiEstimated: false,
      saveToDatabase: false,
      databaseCategory: ""
    });
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

  async function submitLog() {
    const wasSaved = await onSubmit();
    if (!wasSaved) {
      return;
    }

    setSelectedFood(null);
    setServings(1);
    setQuery("");
    setEntryMode("saved");
    setFeedbackMessage("Food added to your log.");
  }

  const missingRequirements = [
    !value.meal ? "meal" : "",
    !value.foodName ? "food" : ""
  ].filter(Boolean);
  const canSubmit = !isSaving && missingRequirements.length === 0;

  return (
    <section className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
            <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredFoods.map((food) => (
                <button
                  key={food.id}
                  className={`hover-lift rounded-lg border p-3 text-left transition hover:border-accent hover:bg-blue-50 ${selectedFood?.id === food.id ? "border-accent bg-blue-50" : "border-slate-200"}`}
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
  );
}
