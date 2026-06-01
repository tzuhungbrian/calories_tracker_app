"use client";

import { Calculator, Database, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CategorySelect } from "@/components/category_select";
import type { CommonFood } from "@/lib/types";

type FoodDatabaseManagerProps = {
  foods: CommonFood[];
  onChanged: () => Promise<void>;
};

type FoodFormState = Omit<CommonFood, "id"> & { id?: string };

const emptyFood: FoodFormState = {
  name: "",
  category: "",
  serving: "1 serving",
  servingSize: "",
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  notes: ""
};

const macroFields: Array<keyof Pick<CommonFood, "calories" | "protein" | "fat" | "carbs">> = [
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
  servingAmount: number;
  unit: "ml" | "g";
} & Pick<CommonFood, "calories" | "protein" | "fat" | "carbs">;

const defaultLabelScale: LabelScaleState = {
  baseAmount: 100,
  servingAmount: 600,
  unit: "ml",
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0
};

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateScaledMacros(labelScale: LabelScaleState): Pick<CommonFood, "calories" | "protein" | "fat" | "carbs"> {
  const multiplier = labelScale.baseAmount > 0 ? labelScale.servingAmount / labelScale.baseAmount : 0;

  return {
    calories: roundMacro(labelScale.calories * multiplier),
    protein: roundMacro(labelScale.protein * multiplier),
    fat: roundMacro(labelScale.fat * multiplier),
    carbs: roundMacro(labelScale.carbs * multiplier)
  };
}

export function FoodDatabaseManager({ foods, onChanged }: FoodDatabaseManagerProps) {
  const [form, setForm] = useState<FoodFormState>(emptyFood);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [macroMode, setMacroMode] = useState<"total" | "label">("total");
  const [labelScale, setLabelScale] = useState<LabelScaleState>(defaultLabelScale);
  const [isSaving, setIsSaving] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [lastAddedFood, setLastAddedFood] = useState<CommonFood | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function editFood(food: CommonFood) {
    setForm(food);
    setMacroMode("total");
    setLabelScale(defaultLabelScale);
    setLastAddedFood(null);
    setMessage("");
    setError(null);
  }

  function resetForm() {
    setForm(emptyFood);
    setMacroMode("total");
    setLabelScale(defaultLabelScale);
    setMessage("");
    setError(null);
  }

  function updateField(field: keyof FoodFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: macroFields.includes(field as (typeof macroFields)[number]) ? Number(value) || 0 : value
    }));
  }

  function applyLabelScale(nextLabelScale: LabelScaleState) {
    const scaledMacros = calculateScaledMacros(nextLabelScale);
    setLabelScale(nextLabelScale);
    setForm((current) => ({
      ...current,
      servingSize: nextLabelScale.servingAmount ? `${nextLabelScale.servingAmount} ${nextLabelScale.unit}` : current.servingSize,
      ...scaledMacros
    }));
  }

  function updateLabelScale(field: keyof LabelScaleState, value: string) {
    const nextLabelScale = {
      ...labelScale,
      [field]: field === "unit" ? value : Number(value) || 0
    } as LabelScaleState;

    applyLabelScale(nextLabelScale);
  }

  function switchMacroMode(nextMode: "total" | "label") {
    setMacroMode(nextMode);
    if (nextMode === "label") {
      applyLabelScale(labelScale);
    }
  }

  async function saveFood() {
    setIsSaving(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/foods", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error("Failed to save food.");
      }

      const savedFood = (await response.json()) as CommonFood;
      await onChanged();
      if (form.id) {
        setLastAddedFood(null);
        setMessage("Food updated.");
      } else {
        setLastAddedFood(savedFood);
        setMessage(`Food added: ${savedFood.name}`);
        setForm(emptyFood);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save food.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteFood() {
    if (!form.id || !window.confirm(`Delete "${form.name}" from foods? Existing logs will keep their saved macro values.`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch(`/api/foods?id=${encodeURIComponent(form.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete food.");
      }

      await onChanged();
      setForm(emptyFood);
      setLastAddedFood(null);
      setMessage("Food deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete food.");
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
        throw new Error("Failed to undo added food.");
      }

      await onChanged();
      setMessage(`Removed ${lastAddedFood.name} from foods database.`);
      setLastAddedFood(null);
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Failed to undo added food.");
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Database size={20} />
              Foods database
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage the saved foods used by logging and meal prep.</p>
          </div>
          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" type="button" onClick={resetForm}>
            <span className="inline-flex items-center gap-2">
              <Plus size={16} />
              New food
            </span>
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Category
            <select
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <Search size={16} />
              Search
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              placeholder="Search foods"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 grid max-h-[620px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredFoods.map((food) => (
            <button
              key={food.id}
              className={`hover-lift rounded-lg border p-3 text-left transition hover:border-accent hover:bg-blue-50 ${form.id === food.id ? "border-accent bg-blue-50" : "border-slate-200"}`}
              type="button"
              onClick={() => editFood(food)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{food.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{food.category || "Uncategorized"} / {food.serving}</p>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{food.calories} kcal</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">P {food.protein} / F {food.fat} / C {food.carbs}</p>
            </button>
          ))}
        </div>
      </div>

      <aside className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
          {form.id ? <Save size={20} /> : <Plus size={20} />}
          {form.id ? "Edit food" : "Add food"}
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Name
            <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <CategorySelect categories={["Uncategorized", ...categories]} value={form.category || "Uncategorized"} onChange={(nextCategory) => updateField("category", nextCategory)} />
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Serving label
            <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.serving} onChange={(event) => updateField("serving", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Serving size
            <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional, e.g. 100 g" value={form.servingSize} onChange={(event) => updateField("servingSize", event.target.value)} />
          </label>
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Calculator size={16} className="text-blue-700" />
                  Nutrition label helper
                </p>
                <p className="mt-1 text-xs text-slate-500">Convert labels like per 100 ml/g into one saved serving.</p>
              </div>
              <div className="inline-grid rounded-md border border-slate-200 bg-white p-1 sm:grid-cols-2">
                <button
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${macroMode === "total" ? "bg-ink text-white" : "text-slate-600"}`}
                  type="button"
                  onClick={() => switchMacroMode("total")}
                >
                  Enter total
                </button>
                <button
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${macroMode === "label" ? "bg-ink text-white" : "text-slate-600"}`}
                  type="button"
                  onClick={() => switchMacroMode("label")}
                >
                  Scale label
                </button>
              </div>
            </div>

            {macroMode === "label" ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-[1fr_1fr_82px] gap-2">
                  <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                    Label amount
                    <input
                      className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
                      min="0"
                      step="0.1"
                      type="number"
                      value={labelScale.baseAmount}
                      onChange={(event) => updateLabelScale("baseAmount", event.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                    Serving
                    <input
                      className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
                      min="0"
                      step="0.1"
                      type="number"
                      value={labelScale.servingAmount}
                      onChange={(event) => updateLabelScale("servingAmount", event.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                    Unit
                    <select
                      className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
                      value={labelScale.unit}
                      onChange={(event) => updateLabelScale("unit", event.target.value)}
                    >
                      <option value="ml">ml</option>
                      <option value="g">g</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {macroFields.map((field) => (
                    <label key={field} className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                      {macroLabels[field]} / label
                      <input
                        className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
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
                  Multiplier: {labelScale.baseAmount > 0 ? roundMacro(labelScale.servingAmount / labelScale.baseAmount) : 0}x. Saved macros below are the scaled serving total.
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {macroFields.map((field) => (
              <label key={field} className="grid gap-1 text-sm font-medium capitalize text-slate-700">
                {macroLabels[field]}
                {macroMode === "label" ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900">
                    {form[field]} <span className="text-xs font-normal text-slate-500">{field === "calories" ? "kcal" : "g"}</span>
                  </p>
                ) : (
                  <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="0" step="0.1" type="number" value={form[field]} onChange={(event) => updateField(field, event.target.value)} />
                )}
              </label>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Notes
            <textarea className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </label>
        </div>

        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? (
          <div className="mt-3 flex flex-col gap-3 rounded-md bg-green-50 p-3 text-sm text-green-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{message}</span>
            {lastAddedFood ? (
              <button
                className="inline-flex w-fit items-center gap-2 rounded-md border border-green-200 bg-white px-3 py-1.5 font-semibold text-green-700 disabled:opacity-60"
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

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isSaving || !form.name} type="button" onClick={saveFood}>
            <span className="inline-flex items-center gap-2">
              {form.id ? <Save size={16} /> : <Plus size={16} />}
              {isSaving ? "Saving..." : form.id ? "Save changes" : "Add food"}
            </span>
          </button>
          {form.id ? (
            <button className="rounded-md border border-red-200 px-4 py-2 font-semibold text-red-600 disabled:opacity-60" disabled={isSaving} type="button" onClick={deleteFood}>
              <span className="inline-flex items-center gap-2">
                <Trash2 size={16} />
                Delete
              </span>
            </button>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
