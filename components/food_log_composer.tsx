"use client";

import { useMemo, useState } from "react";
import type { CommonFood, FoodLogInput } from "@/lib/types";

type FoodLogComposerProps = {
  foods: CommonFood[];
  value: FoodLogInput;
  isSaving: boolean;
  onChange: (value: FoodLogInput) => void;
  onSubmit: () => Promise<void>;
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

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

export function FoodLogComposer({ foods, value, isSaving, onChange, onSubmit }: FoodLogComposerProps) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<CommonFood | null>(null);
  const [servings, setServings] = useState(1);

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
    onChange({
      ...value,
      foodId: food.id,
      foodName: food.name,
      amount: String(nextServings),
      calories: roundMacro(food.calories * nextServings),
      protein: roundMacro(food.protein * nextServings),
      fat: roundMacro(food.fat * nextServings),
      carbs: roundMacro(food.carbs * nextServings)
    });
  }

  function updateServings(nextServings: number) {
    const safeServings = Number.isFinite(nextServings) ? Math.max(nextServings, 0) : 0;
    setServings(safeServings);
    if (selectedFood) {
      applyFood(selectedFood, safeServings);
    } else {
      onChange({ ...value, amount: String(safeServings) });
    }
  }

  async function submitLog() {
    await onSubmit();
    setSelectedFood(null);
    setServings(1);
    setQuery("");
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Add food</h2>
          <p className="mt-1 text-sm text-slate-500">Pick the meal, choose a saved food, adjust servings, then add it.</p>
        </div>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-40"
          type="date"
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
        />
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700">Meal</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {mealOptions.map((meal) => (
            <button
              key={meal}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${value.meal === meal ? "border-accent bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700"}`}
              type="button"
              onClick={() => onChange({ ...value, meal })}
            >
              {meal}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[220px_1fr]">
        <div>
          <p className="text-sm font-medium text-slate-700">Category</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            <button
              className={`whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm ${selectedCategory === "" ? "border-accent bg-blue-50 text-blue-700" : "border-slate-300"}`}
              type="button"
              onClick={() => setSelectedCategory("")}
            >
              All foods
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm ${selectedCategory === category ? "border-accent bg-blue-50 text-blue-700" : "border-slate-300"}`}
                type="button"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Find food
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
                className={`rounded-lg border p-3 text-left transition hover:border-accent hover:bg-blue-50 ${selectedFood?.id === food.id ? "border-accent bg-blue-50" : "border-slate-200"}`}
                type="button"
                onClick={() => applyFood(food, 1)}
              >
                <p className="font-medium">{food.name}</p>
                <p className="mt-1 text-xs text-slate-500">{food.serving || "1 serving"}</p>
                <p className="mt-2 text-sm text-slate-700">
                  {food.calories} kcal · P {food.protein} · F {food.fat} · C {food.carbs}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)_auto] xl:items-end">
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
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
          {macroFields.map((field) => (
            <div key={field} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{macroLabels[field]}</p>
              <p className="mt-1 truncate text-lg font-semibold text-slate-900">
                {value[field]} <span className="text-xs font-normal text-slate-500">{field === "calories" ? "kcal" : "g"}</span>
              </p>
            </div>
          ))}
        </div>
        <button
          className="rounded-md bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60"
          disabled={isSaving || !value.meal || !value.foodName}
          type="button"
          onClick={submitLog}
        >
          {isSaving ? "Adding..." : "Add food"}
        </button>
      </div>

      <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
        Notes
        <textarea
          className="rounded-md border border-slate-300 px-3 py-2 font-normal"
          placeholder="Optional"
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
        />
      </label>
    </section>
  );
}
