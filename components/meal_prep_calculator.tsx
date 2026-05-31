"use client";

import { CheckCircle2, ClipboardCopy, CookingPot, Database, Minus, Plus, Search, Trash2, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CommonFood, NutritionTotals } from "@/lib/types";

type PrepIngredient = {
  id: string;
  food: CommonFood;
  servings: number;
};

type MealPrepCalculatorProps = {
  foods?: CommonFood[];
  onChanged?: () => Promise<void>;
};

const macroCards: Array<{ key: keyof NutritionTotals; label: string; unit: string }> = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" }
];

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

export function MealPrepCalculator({ foods: providedFoods, onChanged }: MealPrepCalculatorProps) {
  const [loadedFoods, setLoadedFoods] = useState<CommonFood[]>([]);
  const foods = providedFoods ?? loadedFoods;
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState<PrepIngredient[]>([]);
  const [mealName, setMealName] = useState("");
  const [category, setCategory] = useState("Meal prep");
  const [servingLabel, setServingLabel] = useState("1 portion");
  const [servingSize, setServingSize] = useState("");
  const [servingCount, setServingCount] = useState(4);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return foods
      .filter((food) => !selectedCategory || (food.category || "Uncategorized") === selectedCategory)
      .filter((food) => !normalizedQuery || food.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [foods, query, selectedCategory]);

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

  const notes = useMemo(
    () => ingredients.map((ingredient) => `${ingredient.food.name} x ${ingredient.servings}`).join("; "),
    [ingredients]
  );

  const rowPreview = useMemo(
    () =>
      [
        mealName,
        category,
        servingLabel,
        servingSize || `${servingCount} portions total`,
        perServing.calories,
        perServing.protein,
        perServing.fat,
        perServing.carbs,
        notes
      ].join("\t"),
    [category, mealName, notes, perServing, servingCount, servingLabel, servingSize]
  );

  function addFood(food: CommonFood) {
    setMessage("");
    setIngredients((current) => {
      const existing = current.find((ingredient) => ingredient.food.id === food.id);
      if (existing) {
        return current.map((ingredient) => (ingredient.id === existing.id ? { ...ingredient, servings: roundMacro(ingredient.servings + 1) } : ingredient));
      }

      return [...current, { id: crypto.randomUUID(), food, servings: 1 }];
    });
  }

  function updateServings(id: string, servings: number) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, servings: Number.isFinite(servings) ? Math.max(servings, 0) : 0 } : ingredient
      )
    );
  }

  async function copyPreview() {
    await navigator.clipboard.writeText(rowPreview);
    setMessage("Copied meal row preview.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  async function saveMealToFoods() {
    setIsSaving(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mealName,
          category,
          serving: servingLabel,
          servingSize: servingSize || `${servingCount} portions total`,
          calories: perServing.calories,
          protein: perServing.protein,
          fat: perServing.fat,
          carbs: perServing.carbs,
          notes
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save meal to foods database.");
      }

      await onChanged?.();
      setMessage("Saved to foods database.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save meal to foods database.");
    } finally {
      setIsSaving(false);
    }
  }

  const canSave = Boolean(mealName.trim()) && ingredients.length > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)_360px]">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 xl:col-span-3">{error}</div> : null}

      <div className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Search size={20} />
            Add ingredients
          </h2>
          <p className="mt-1 text-sm text-slate-500">Search foods and tap cards to add them to the batch.</p>
        </div>

        <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
          Search
          <input
            className="rounded-md border border-slate-300 px-3 py-2 font-normal"
            placeholder="Chicken, rice, sauce..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedCategory === "" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
            type="button"
            onClick={() => setSelectedCategory("")}
          >
            All
          </button>
          {categories.map((foodCategory) => (
            <button
              key={foodCategory}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedCategory === foodCategory ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
              type="button"
              onClick={() => setSelectedCategory(foodCategory)}
            >
              {foodCategory}
            </button>
          ))}
        </div>

        <div className="mt-4 grid max-h-[640px] gap-2 overflow-y-auto pr-1">
          {filteredFoods.map((food) => (
            <button
              key={food.id}
              className="hover-lift rounded-lg border border-slate-200 p-3 text-left transition hover:border-accent hover:bg-blue-50"
              type="button"
              onClick={() => addFood(food)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{food.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{food.category || "Uncategorized"} / {food.serving || "1 serving"}</p>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{food.calories} kcal</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">P {food.protein} / F {food.fat} / C {food.carbs}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <CookingPot size={20} />
              Batch basket
            </h2>
            <p className="mt-1 text-sm text-slate-500">Adjust servings for the whole cooked batch.</p>
          </div>
          <button
            className="w-fit rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
            disabled={ingredients.length === 0}
            type="button"
            onClick={() => setIngredients([])}
          >
            Clear
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {ingredients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Add ingredients from the left. Your per-portion macros will update instantly.
            </div>
          ) : null}
          {ingredients.map((ingredient) => {
            const ingredientTotals = multiplyFood(ingredient.food, ingredient.servings);
            return (
              <div key={ingredient.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{ingredient.food.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {roundMacro(ingredientTotals.calories)} kcal / P {roundMacro(ingredientTotals.protein)} / F {roundMacro(ingredientTotals.fat)} / C {roundMacro(ingredientTotals.carbs)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-md border border-slate-200 p-2 text-slate-600" type="button" onClick={() => updateServings(ingredient.id, roundMacro(ingredient.servings - 0.5))}>
                      <Minus size={15} />
                    </button>
                    <input
                      className="w-20 rounded-md border border-slate-300 px-2 py-2 text-center font-semibold"
                      min="0"
                      step="0.1"
                      type="number"
                      value={ingredient.servings}
                      onChange={(event) => updateServings(ingredient.id, Number(event.target.value))}
                    />
                    <button className="rounded-md border border-slate-200 p-2 text-slate-600" type="button" onClick={() => updateServings(ingredient.id, roundMacro(ingredient.servings + 0.5))}>
                      <Plus size={15} />
                    </button>
                    <button className="rounded-md border border-red-100 p-2 text-red-600" type="button" onClick={() => setIngredients((current) => current.filter((item) => item.id !== ingredient.id))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Utensils size={20} />
            Meal output
          </h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Meal name
              <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Chicken rice prep" value={mealName} onChange={(event) => setMealName(event.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Portions
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="1" step="1" type="number" value={servingCount} onChange={(event) => setServingCount(Number(event.target.value) || 1)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Category
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={category} onChange={(event) => setCategory(event.target.value)} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Serving label
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={servingLabel} onChange={(event) => setServingLabel(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Serving size
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional" value={servingSize} onChange={(event) => setServingSize(event.target.value)} />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-blue-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-blue-700">Per portion</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-700">{servingCount || 1} portions</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {macroCards.map((macro) => (
                <MacroCard key={macro.key} label={macro.label} unit={macro.unit} value={perServing[macro.key]} />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Batch total: {roundMacro(totals.calories)} kcal, {roundMacro(totals.protein)} P, {roundMacro(totals.fat)} F, {roundMacro(totals.carbs)} C
          </div>

          <div className="mt-4 grid gap-2">
            <button className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={!canSave || isSaving} type="button" onClick={saveMealToFoods}>
              <span className="inline-flex items-center justify-center gap-2">
                <Database size={16} />
                {isSaving ? "Saving..." : "Save to foods database"}
              </span>
            </button>
            <button className="rounded-md border border-slate-200 px-4 py-2 font-semibold text-slate-700 disabled:opacity-60" disabled={!canSave} type="button" onClick={copyPreview}>
              <span className="inline-flex items-center justify-center gap-2">
                <ClipboardCopy size={16} />
                Copy row preview
              </span>
            </button>
          </div>

          {message ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} />
              {message}
            </p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}

function MacroCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
