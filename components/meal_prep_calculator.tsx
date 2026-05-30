"use client";

import { ClipboardCopy, CookingPot, Plus, Scale, Trash2, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CommonFood, NutritionTotals } from "@/lib/types";

type PrepIngredient = {
  id: string;
  food: CommonFood;
  servings: number;
};

type MealPrepCalculatorProps = {
  foods?: CommonFood[];
};

function emptyTotals(): NutritionTotals {
  return { calories: 0, protein: 0, fat: 0, carbs: 0 };
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function multiplyFood(food: CommonFood, servings: number): NutritionTotals {
  return {
    calories: food.calories * servings,
    protein: food.protein * servings,
    fat: food.fat * servings,
    carbs: food.carbs * servings
  };
}

export function MealPrepCalculator({ foods: providedFoods }: MealPrepCalculatorProps) {
  const [loadedFoods, setLoadedFoods] = useState<CommonFood[]>([]);
  const foods = providedFoods ?? loadedFoods;
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFoodName, setSelectedFoodName] = useState("");
  const [ingredients, setIngredients] = useState<PrepIngredient[]>([]);
  const [mealName, setMealName] = useState("");
  const [outputFoodId, setOutputFoodId] = useState(() => crypto.randomUUID());
  const [category, setCategory] = useState("Meal prep");
  const [servingLabel, setServingLabel] = useState("1 portion");
  const [servingSize, setServingSize] = useState("");
  const [servingCount, setServingCount] = useState(4);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providedFoods) {
      return;
    }

    fetch("/api/common_foods")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load common foods.");
        }
        return response.json() as Promise<CommonFood[]>;
      })
      .then(setLoadedFoods)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load common foods.");
      });
  }, [providedFoods]);

  const categories = useMemo(
    () =>
      Array.from(new Set(foods.map((food) => food.category || "Uncategorized")))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [foods]
  );
  const filteredFoods = useMemo(
    () => foods.filter((food) => !selectedCategory || (food.category || "Uncategorized") === selectedCategory),
    [foods, selectedCategory]
  );

  const totals = useMemo(
    () =>
      ingredients.reduce<NutritionTotals>((sum, ingredient) => {
        const ingredientTotals = multiplyFood(ingredient.food, ingredient.servings);
        return {
          calories: sum.calories + ingredientTotals.calories,
          protein: sum.protein + ingredientTotals.protein,
          fat: sum.fat + ingredientTotals.fat,
          carbs: sum.carbs + ingredientTotals.carbs
        };
      }, emptyTotals()),
    [ingredients]
  );

  const perServing = useMemo<NutritionTotals>(() => {
    const portions = Math.max(servingCount, 1);
    return {
      calories: roundMacro(totals.calories / portions),
      protein: roundMacro(totals.protein / portions),
      fat: roundMacro(totals.fat / portions),
      carbs: roundMacro(totals.carbs / portions)
    };
  }, [servingCount, totals]);

  const commonFoodRow = useMemo(() => {
    const now = new Date().toISOString();
    const notes = ingredients
      .map((ingredient) => `${ingredient.food.name} x ${ingredient.servings}`)
      .join("; ");
    return [
      outputFoodId,
      mealName,
      category,
      servingLabel,
      servingSize || `${servingCount} portions total`,
      perServing.calories,
      perServing.protein,
      perServing.fat,
      perServing.carbs,
      notes,
      now,
      now
    ].join("\t");
  }, [category, ingredients, mealName, outputFoodId, perServing, servingCount, servingLabel, servingSize]);

  function addSelectedFood() {
    const food = foods.find((item) => item.name === selectedFoodName);
    if (!food) {
      return;
    }

    setIngredients((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        food,
        servings: 1
      }
    ]);
    setSelectedFoodName("");
  }

  function updateServings(id: string, servings: number) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, servings: Number.isFinite(servings) ? servings : 0 } : ingredient
      )
    );
  }

  async function copyRow() {
    await navigator.clipboard.writeText(commonFoodRow);
    setCopyStatus("Copied row for foods.");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 lg:col-span-2">{error}</div> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <CookingPot size={20} />
              Meal prep builder
            </h2>
            <p className="mt-1 text-sm text-slate-500">Build a batch from saved foods, then copy one per-portion food row.</p>
          </div>
          <label className="grid gap-1 text-sm font-medium text-slate-700 sm:w-56">
            Category
            <select
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              value={selectedCategory}
              onChange={(event) => {
                setSelectedCategory(event.target.value);
                setSelectedFoodName("");
              }}
            >
              <option value="">All categories</option>
              {categories.map((foodCategory) => (
                <option key={foodCategory} value={foodCategory}>
                  {foodCategory}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Add ingredient
            <select
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              value={selectedFoodName}
              onChange={(event) => setSelectedFoodName(event.target.value)}
            >
              <option value="">Choose a food</option>
              {filteredFoods.map((food) => (
                <option key={`${food.name}-${food.serving}`} value={food.name}>
                  {food.name} ({food.serving})
                </option>
              ))}
            </select>
          </label>
          <button className="self-end rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60" disabled={!selectedFoodName} onClick={addSelectedFood}>
            <span className="inline-flex items-center gap-2">
              <Plus size={16} />
              Add
            </span>
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {ingredients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Add ingredients to calculate this prep batch.
            </div>
          ) : null}
          {ingredients.map((ingredient) => {
            const ingredientTotals = multiplyFood(ingredient.food, ingredient.servings);
            return (
              <div key={ingredient.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_110px_auto] sm:items-center">
                <div>
                  <p className="font-medium">{ingredient.food.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {ingredient.food.serving || "1 serving"} · {roundMacro(ingredientTotals.calories)} kcal · P {roundMacro(ingredientTotals.protein)} · F {roundMacro(ingredientTotals.fat)} · C {roundMacro(ingredientTotals.carbs)}
                  </p>
                </div>
                <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Servings
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-base font-normal text-slate-900"
                    min="0"
                    step="0.1"
                    type="number"
                    value={ingredient.servings}
                    onChange={(event) => updateServings(ingredient.id, Number(event.target.value))}
                  />
                </label>
                <button className="text-sm font-medium text-red-600" onClick={() => setIngredients((current) => current.filter((item) => item.id !== ingredient.id))}>
                  <span className="inline-flex items-center gap-1.5">
                    <Trash2 size={15} />
                    Remove
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Utensils size={20} />
            Output food
          </h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Meal name
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                placeholder="e.g. 0601 chicken rice prep"
                value={mealName}
                onChange={(event) => {
                  setMealName(event.target.value);
                  setOutputFoodId((current) => current || crypto.randomUUID());
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Category
              <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={category} onChange={(event) => setCategory(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Serving label
              <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={servingLabel} onChange={(event) => setServingLabel(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Serving size
              <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional, e.g. 420 g" value={servingSize} onChange={(event) => setServingSize(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Number of portions
              <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="1" step="1" type="number" value={servingCount} onChange={(event) => setServingCount(Number(event.target.value))} />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Scale size={20} />
            Per portion
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MacroCard label="Calories" value={perServing.calories} unit="kcal" />
            <MacroCard label="Protein" value={perServing.protein} unit="g" />
            <MacroCard label="Fat" value={perServing.fat} unit="g" />
            <MacroCard label="Carbs" value={perServing.carbs} unit="g" />
          </div>
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Batch total: {roundMacro(totals.calories)} kcal, {roundMacro(totals.protein)} P, {roundMacro(totals.fat)} F, {roundMacro(totals.carbs)} C
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <ClipboardCopy size={20} />
            Paste row
          </h2>
          <p className="mt-1 text-sm text-slate-500">Copy this row and paste it under the `foods` header row.</p>
          <textarea className="mt-3 h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" readOnly value={commonFoodRow} />
          <button className="mt-3 rounded-md bg-ink px-4 py-2 font-medium text-white disabled:opacity-60" disabled={!mealName || ingredients.length === 0} onClick={copyRow}>
            <span className="inline-flex items-center gap-2">
              <ClipboardCopy size={16} />
              Copy row
            </span>
          </button>
          {copyStatus ? <p className="mt-2 text-sm font-medium text-green-700">{copyStatus}</p> : null}
        </div>
      </aside>
    </section>
  );
}

function MacroCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
