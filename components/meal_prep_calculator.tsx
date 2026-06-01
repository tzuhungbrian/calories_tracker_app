"use client";

import { CheckCircle2, CookingPot, Database, GripVertical, Minus, Plus, RotateCcw, Search, Trash2, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { CommonFood, NutritionTotals } from "@/lib/types";

type PrepIngredient = {
  id: string;
  food: CommonFood;
  servings: number;
};

type CustomIngredientInput = {
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

function createEmptyCustomIngredient(): CustomIngredientInput {
  return {
    name: "",
    category: "Temporary",
    serving: "1 serving",
    servingSize: "",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    notes: ""
  };
}

function isTemporaryFood(food: CommonFood): boolean {
  return food.id.startsWith("temp_");
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
  const [isUndoing, setIsUndoing] = useState(false);
  const [draggingFoodId, setDraggingFoodId] = useState<string | null>(null);
  const [isBasketActive, setIsBasketActive] = useState(false);
  const [lastAddedFood, setLastAddedFood] = useState<CommonFood | null>(null);
  const [customIngredient, setCustomIngredient] = useState<CustomIngredientInput>(() => createEmptyCustomIngredient());
  const [isSavingIngredientId, setIsSavingIngredientId] = useState<string | null>(null);
  const [isCustomIngredientOpen, setIsCustomIngredientOpen] = useState(false);
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);

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

  const customIngredientCategories = useMemo(() => {
    const currentCategory = customIngredient.category.trim();
    const categorySet = new Set(["Temporary", "Meal prep", ...categories]);
    if (currentCategory) {
      categorySet.add(currentCategory);
    }
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [categories, customIngredient.category]);

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

  function addFood(food: CommonFood) {
    setMessage("");
    setLastAddedFood(null);
    setIngredients((current) => {
      const existing = current.find((ingredient) => ingredient.food.id === food.id);
      if (existing) {
        return current.map((ingredient) => (ingredient.id === existing.id ? { ...ingredient, servings: roundMacro(ingredient.servings + 1) } : ingredient));
      }

      return [...current, { id: crypto.randomUUID(), food, servings: 1 }];
    });
  }

  function customIngredientToFood(): CommonFood {
    return {
      id: `temp_${crypto.randomUUID()}`,
      name: customIngredient.name.trim(),
      category: customIngredient.category.trim() || "Temporary",
      serving: customIngredient.serving.trim() || "1 serving",
      servingSize: customIngredient.servingSize.trim(),
      calories: Number(customIngredient.calories) || 0,
      protein: Number(customIngredient.protein) || 0,
      fat: Number(customIngredient.fat) || 0,
      carbs: Number(customIngredient.carbs) || 0,
      notes: customIngredient.notes.trim()
    };
  }

  function addCustomIngredientToBasket() {
    if (!customIngredient.name.trim()) {
      setError("Custom ingredient name is required.");
      return;
    }

    setError(null);
    addFood(customIngredientToFood());
    setCustomIngredient(createEmptyCustomIngredient());
    setIsAddingCustomCategory(false);
    setIsCustomIngredientOpen(false);
  }

  async function saveFoodToDatabase(food: CommonFood, sourceIngredientId?: string): Promise<boolean> {
    setIsSavingIngredientId(sourceIngredientId ?? "custom-form");
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          category: food.category || "Meal prep",
          serving: food.serving || "1 serving",
          servingSize: food.servingSize,
          calories: food.calories,
          protein: food.protein,
          fat: food.fat,
          carbs: food.carbs,
          notes: food.notes
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save ingredient to foods database.");
      }

      const savedFood = (await response.json()) as CommonFood;
      if (!providedFoods) {
        setLoadedFoods((current) => [savedFood, ...current]);
      }
      if (sourceIngredientId) {
        setIngredients((current) => current.map((ingredient) => (ingredient.id === sourceIngredientId ? { ...ingredient, food: savedFood } : ingredient)));
      }
      await onChanged?.();
      setLastAddedFood(savedFood);
      setMessage(`Saved ${savedFood.name} to foods database.`);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save ingredient to foods database.");
      return false;
    } finally {
      setIsSavingIngredientId(null);
    }
  }

  async function saveCustomIngredientToDatabase() {
    if (!customIngredient.name.trim()) {
      setError("Custom ingredient name is required.");
      return;
    }

    const saved = await saveFoodToDatabase(customIngredientToFood());
    if (saved) {
      setCustomIngredient(createEmptyCustomIngredient());
      setIsAddingCustomCategory(false);
      setIsCustomIngredientOpen(false);
    }
  }

  function addDraggedFood(foodId: string) {
    const food = foods.find((candidate) => candidate.id === foodId);
    if (food) {
      addFood(food);
    }
  }

  function startFoodDrag(event: DragEvent<HTMLElement>, food: CommonFood) {
    setDraggingFoodId(food.id);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", food.id);
  }

  function dropFoodIntoBasket(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const foodId = event.dataTransfer.getData("text/plain") || draggingFoodId;
    if (foodId) {
      addDraggedFood(foodId);
    }
    setDraggingFoodId(null);
    setIsBasketActive(false);
  }

  function updateServings(id: string, servings: number) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, servings: Number.isFinite(servings) ? Math.max(servings, 0) : 0 } : ingredient
      )
    );
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

      const savedFood = (await response.json()) as CommonFood;
      await onChanged?.();
      setLastAddedFood(savedFood);
      setMessage(`Saved ${savedFood.name} to foods database.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save meal to foods database.");
    } finally {
      setIsSaving(false);
    }
  }

  async function undoLastAddedFood() {
    if (!lastAddedFood) {
      return;
    }

    setIsUndoing(true);
    setError(null);

    try {
      const response = await fetch(`/api/foods?id=${encodeURIComponent(lastAddedFood.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to undo saved meal.");
      }

      await onChanged?.();
      setMessage(`Removed ${lastAddedFood.name} from foods database.`);
      setLastAddedFood(null);
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Failed to undo saved meal.");
    } finally {
      setIsUndoing(false);
    }
  }

  const canSave = Boolean(mealName.trim()) && ingredients.length > 0;
  const canUseCustomIngredient = Boolean(customIngredient.name.trim());

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)_360px]">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 xl:col-span-3">{error}</div> : null}

      <div className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Search size={20} />
            Add ingredients
          </h2>
          <p className="mt-1 text-sm text-slate-500">Drag foods into the basket, or tap a card to add it quickly.</p>
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

        <button
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
          type="button"
          onClick={() => setIsCustomIngredientOpen(true)}
        >
          <span>
            <span className="block font-semibold text-slate-800">Quick custom ingredient</span>
            <span className="mt-1 block text-xs text-slate-500">Add a temporary ingredient, or save it to the database.</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700">
            <Plus size={14} />
            Add
          </span>
        </button>

        <div className="mt-4 grid max-h-[640px] gap-2 overflow-y-auto pr-1">
          {filteredFoods.map((food) => (
            <button
              key={food.id}
              className={`hover-lift cursor-grab rounded-lg border p-3 text-left transition active:cursor-grabbing ${draggingFoodId === food.id ? "border-accent bg-blue-50 opacity-80 ring-2 ring-blue-100" : "border-slate-200 hover:border-accent hover:bg-blue-50"}`}
              draggable
              type="button"
              onClick={() => addFood(food)}
              onDragEnd={() => {
                setDraggingFoodId(null);
                setIsBasketActive(false);
              }}
              onDragStart={(event) => startFoodDrag(event, food)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 font-semibold">
                    <GripVertical size={15} className="text-slate-400" />
                    {food.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{food.category || "Uncategorized"} / {food.serving || "1 serving"}</p>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{food.calories} kcal</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">P {food.protein} / F {food.fat} / C {food.carbs}</p>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`animate-enter rounded-lg border bg-white p-4 shadow-sm transition ${isBasketActive ? "border-blue-300 bg-blue-50/60 ring-4 ring-blue-100" : "border-slate-200"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsBasketActive(true);
        }}
        onDragLeave={() => setIsBasketActive(false)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsBasketActive(true);
        }}
        onDrop={dropFoodIntoBasket}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <CookingPot size={20} />
              Batch basket
            </h2>
            <p className="mt-1 text-sm text-slate-500">Drop ingredient cards here, then adjust servings for the whole cooked batch.</p>
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
            <div className={`rounded-lg border border-dashed p-8 text-center text-sm transition ${isBasketActive ? "border-blue-300 bg-white text-blue-700" : "border-slate-300 text-slate-500"}`}>
              Drop foods here or tap cards from the left. Per-portion macros update instantly.
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
                    {isTemporaryFood(ingredient.food) ? <p className="mt-1 text-xs font-semibold text-blue-700">Temporary ingredient</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {isTemporaryFood(ingredient.food) ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
                        disabled={isSavingIngredientId === ingredient.id}
                        type="button"
                        onClick={() => saveFoodToDatabase(ingredient.food, ingredient.id)}
                      >
                        <Database size={14} />
                        {isSavingIngredientId === ingredient.id ? "Saving..." : "Save"}
                      </button>
                    ) : null}
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
            Save meal
          </h2>
          <p className="mt-1 text-sm text-slate-500">Name the finished prep and save one portion as a reusable database food.</p>
          <div className="mt-4 grid gap-3">
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Database food name
              <input className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Chicken rice prep" value={mealName} onChange={(event) => setMealName(event.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                Portions
                <input className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal" min="1" step="1" type="number" value={servingCount} onChange={(event) => setServingCount(Number(event.target.value) || 1)} />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                Category
                <input className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal" value={category} onChange={(event) => setCategory(event.target.value)} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                Serving label
                <input className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal" value={servingLabel} onChange={(event) => setServingLabel(event.target.value)} />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                Serving size
                <input className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional" value={servingSize} onChange={(event) => setServingSize(event.target.value)} />
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

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Batch total</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {macroCards.map((macro) => (
                <div key={macro.key} className="min-w-0 rounded-md bg-white px-3 py-2">
                  <span className="text-slate-500">{macro.label}</span>
                  <p className="font-semibold text-slate-800">
                    {roundMacro(totals[macro.key])} {macro.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <button className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={!canSave || isSaving} type="button" onClick={saveMealToFoods}>
              <span className="inline-flex items-center justify-center gap-2">
                <Database size={16} />
                {isSaving ? "Saving..." : "Save to foods database"}
              </span>
            </button>
          </div>

          {message ? (
            <div className="mt-3 flex flex-col gap-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} />
                {message}
              </span>
              {lastAddedFood ? (
                <button
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-emerald-700 disabled:opacity-60"
                  disabled={isUndoing}
                  type="button"
                  onClick={undoLastAddedFood}
                >
                  <RotateCcw size={15} />
                  {isUndoing ? "Undoing..." : "Undo"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>

      {isCustomIngredientOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
                  <Database size={20} />
                  Quick custom ingredient
                </h2>
                <p className="mt-1 text-sm text-slate-500">Use this for a temporary ingredient. Save it only if it becomes reusable.</p>
              </div>
              <button
                className="rounded-md border border-slate-200 p-2 text-slate-600"
                type="button"
                onClick={() => {
                  setIsAddingCustomCategory(false);
                  setIsCustomIngredientOpen(false);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Ingredient name
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Ingredient name"
                  value={customIngredient.name}
                  onChange={(event) => setCustomIngredient((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Category
                  {isAddingCustomCategory ? (
                    <div className="grid gap-2">
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                        placeholder="New category"
                        value={customIngredient.category}
                        onChange={(event) => setCustomIngredient((current) => ({ ...current, category: event.target.value }))}
                      />
                      <button
                        className="w-fit rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        type="button"
                        onClick={() => {
                          setCustomIngredient((current) => ({ ...current, category: current.category.trim() || "Temporary" }));
                          setIsAddingCustomCategory(false);
                        }}
                      >
                        Use selected category list
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <select
                        className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                        value={customIngredient.category}
                        onChange={(event) => setCustomIngredient((current) => ({ ...current, category: event.target.value }))}
                      >
                        {customIngredientCategories.map((foodCategory) => (
                          <option key={foodCategory} value={foodCategory}>
                            {foodCategory}
                          </option>
                        ))}
                      </select>
                      <button
                        className="w-fit rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                        type="button"
                        onClick={() => setIsAddingCustomCategory(true)}
                      >
                        + Add new category
                      </button>
                    </div>
                  )}
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Serving label
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                    value={customIngredient.serving}
                    onChange={(event) => setCustomIngredient((current) => ({ ...current, serving: event.target.value }))}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Serving size
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Optional"
                  value={customIngredient.servingSize}
                  onChange={(event) => setCustomIngredient((current) => ({ ...current, servingSize: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {macroCards.map((macro) => (
                  <label key={macro.key} className="grid gap-1 text-sm font-medium text-slate-700">
                    {macro.label}
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                      min="0"
                      step="0.1"
                      type="number"
                      value={customIngredient[macro.key]}
                      onChange={(event) => setCustomIngredient((current) => ({ ...current, [macro.key]: Number(event.target.value) || 0 }))}
                    />
                  </label>
                ))}
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className="min-h-20 rounded-md border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Optional"
                  value={customIngredient.notes}
                  onChange={(event) => setCustomIngredient((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50"
                disabled={!canUseCustomIngredient}
                type="button"
                onClick={addCustomIngredientToBasket}
              >
                <Plus size={16} />
                Add to basket
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-700 disabled:opacity-50"
                disabled={!canUseCustomIngredient || isSavingIngredientId === "custom-form"}
                type="button"
                onClick={saveCustomIngredientToDatabase}
              >
                <Database size={16} />
                {isSavingIngredientId === "custom-form" ? "Saving..." : "Save to database"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MacroCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
