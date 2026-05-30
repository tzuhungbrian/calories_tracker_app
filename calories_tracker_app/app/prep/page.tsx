"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CommonFood, NutritionTotals } from "@/lib/types";

type PrepIngredient = {
  id: string;
  food: CommonFood;
  servings: number;
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

export default function PrepCalculatorPage() {
  const [foods, setFoods] = useState<CommonFood[]>([]);
  const [selectedFoodName, setSelectedFoodName] = useState("");
  const [ingredients, setIngredients] = useState<PrepIngredient[]>([]);
  const [mealName, setMealName] = useState("");
  const [category, setCategory] = useState("Meal prep");
  const [servingLabel, setServingLabel] = useState("1 portion");
  const [servingCount, setServingCount] = useState(4);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/common_foods")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load common foods.");
        }
        return response.json() as Promise<CommonFood[]>;
      })
      .then(setFoods)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load common foods.");
      });
  }, []);

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
    const notes = ingredients
      .map((ingredient) => `${ingredient.food.name} x ${ingredient.servings}`)
      .join("; ");
    return [
      mealName,
      category,
      servingLabel,
      `${servingCount} portions total`,
      perServing.calories,
      perServing.protein,
      perServing.fat,
      perServing.carbs,
      notes
    ].join("\t");
  }, [category, ingredients, mealName, perServing, servingCount, servingLabel]);

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
    setCopyStatus("Copied row for Common_Foods.");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">Meal prep calculator</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Build a reusable meal</h1>
        </div>
        <Link className="text-sm font-medium text-blue-700 hover:underline" href="/">
          Back to dashboard
        </Link>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Add from Common_Foods
              <select
                className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                value={selectedFoodName}
                onChange={(event) => setSelectedFoodName(event.target.value)}
              >
                <option value="">Choose a food</option>
                {foods.map((food) => (
                  <option key={`${food.name}-${food.serving}`} value={food.name}>
                    {food.name} ({food.serving})
                  </option>
                ))}
              </select>
            </label>
            <button className="self-end rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60" disabled={!selectedFoodName} onClick={addSelectedFood}>
              Add
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Food</th>
                  <th className="px-3 py-2">Base serving</th>
                  <th className="px-3 py-2">Servings used</th>
                  <th className="px-3 py-2">Calories</th>
                  <th className="px-3 py-2">P</th>
                  <th className="px-3 py-2">F</th>
                  <th className="px-3 py-2">C</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {ingredients.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                      Add foods to calculate this prep batch.
                    </td>
                  </tr>
                ) : null}
                {ingredients.map((ingredient) => {
                  const ingredientTotals = multiplyFood(ingredient.food, ingredient.servings);
                  return (
                    <tr key={ingredient.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{ingredient.food.name}</td>
                      <td className="px-3 py-2 text-slate-600">{ingredient.food.serving || "-"}</td>
                      <td className="px-3 py-2">
                        <input
                          className="w-24 rounded-md border border-slate-300 px-2 py-1"
                          min="0"
                          step="0.1"
                          type="number"
                          value={ingredient.servings}
                          onChange={(event) => updateServings(ingredient.id, Number(event.target.value))}
                        />
                      </td>
                      <td className="px-3 py-2">{roundMacro(ingredientTotals.calories)}</td>
                      <td className="px-3 py-2">{roundMacro(ingredientTotals.protein)}</td>
                      <td className="px-3 py-2">{roundMacro(ingredientTotals.fat)}</td>
                      <td className="px-3 py-2">{roundMacro(ingredientTotals.carbs)}</td>
                      <td className="px-3 py-2 text-right">
                        <button className="text-sm font-medium text-red-600" onClick={() => setIngredients((current) => current.filter((item) => item.id !== ingredient.id))}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Common_Foods output</h2>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Meal name
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="e.g. 0601 chicken rice prep" value={mealName} onChange={(event) => setMealName(event.target.value)} />
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
                Number of portions
                <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="1" step="1" type="number" value={servingCount} onChange={(event) => setServingCount(Number(event.target.value))} />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Per portion</h2>
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
            <h2 className="text-lg font-semibold">Paste row</h2>
            <p className="mt-1 text-sm text-slate-500">Copy this row and paste it under the `Common_Foods` header row.</p>
            <textarea className="mt-3 h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" readOnly value={commonFoodRow} />
            <button className="mt-3 rounded-md bg-ink px-4 py-2 font-medium text-white disabled:opacity-60" disabled={!mealName || ingredients.length === 0} onClick={copyRow}>
              Copy row
            </button>
            {copyStatus ? <p className="mt-2 text-sm font-medium text-green-700">{copyStatus}</p> : null}
          </div>
        </aside>
      </section>
    </main>
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
