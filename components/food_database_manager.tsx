"use client";

import { AlertTriangle, Calculator, CookingPot, Database, FolderCog, ListChecks, Plus, RotateCcw, Save, Search, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CategorySelect } from "@/components/category_select";
import { DecimalNumberInput } from "@/components/decimal_number_input";
import { useModalAccessibility } from "@/components/use_modal_accessibility";
import type { CommonFood, FoodLog } from "@/lib/types";

type FoodDatabaseManagerProps = {
  foods: CommonFood[];
  logs: FoodLog[];
  onChanged: () => Promise<void>;
  onEditMealPrep: (food: CommonFood) => void;
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

type QualityFilter = "all" | "duplicates" | "unused" | "ai";
type FoodSortMode = "name" | "category" | "calories" | "protein" | "recent";

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

function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isAiEstimatedFood(food: CommonFood): boolean {
  return `${food.name} ${food.category} ${food.notes}`.toLowerCase().includes("ai estimated");
}

function isMealPrepFood(food: CommonFood): boolean {
  const notes = food.notes.toLowerCase();
  return notes.includes("meal prep:") && notes.includes("ingredients:");
}

function servingStandard(food: CommonFood): string {
  const servingText = `${food.serving} ${food.servingSize}`.toLowerCase();
  if (servingText.includes("100 ml")) {
    return "per 100 ml";
  }
  if (servingText.includes("100 g") || servingText.includes("100g")) {
    return "per 100 g";
  }
  if (servingText.includes("pack") || servingText.includes("package")) {
    return "per pack";
  }
  return "per serving";
}

function wasUsedRecently(food: CommonFood, logs: FoodLog[], dayWindow = 30): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayWindow);
  const normalizedFoodName = normalizeFoodName(food.name);

  return logs.some((log) => {
    const logDate = new Date(`${log.date}T12:00:00`);
    const sameFood = (log.foodId && log.foodId === food.id) || normalizeFoodName(log.foodName) === normalizedFoodName;
    return sameFood && logDate >= cutoff;
  });
}

function lastUsedDate(food: CommonFood, logs: FoodLog[]): string {
  const normalizedFoodName = normalizeFoodName(food.name);
  return logs
    .filter((log) => (log.foodId && log.foodId === food.id) || normalizeFoodName(log.foodName) === normalizedFoodName)
    .map((log) => log.date)
    .sort((a, b) => b.localeCompare(a))[0] ?? "";
}

export function FoodDatabaseManager({ foods, logs, onChanged, onEditMealPrep }: FoodDatabaseManagerProps) {
  const [form, setForm] = useState<FoodFormState>(emptyFood);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<FoodSortMode>("name");
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [macroMode, setMacroMode] = useState<"total" | "label">("total");
  const [labelScale, setLabelScale] = useState<LabelScaleState>(defaultLabelScale);
  const [renameFromCategory, setRenameFromCategory] = useState("");
  const [renameToCategory, setRenameToCategory] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isFoodEditorOpen, setIsFoodEditorOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedFoodIds, setSelectedFoodIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [lastAddedFood, setLastAddedFood] = useState<CommonFood | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const categoryDialogRef = useModalAccessibility(isCategoryManagerOpen, () => setIsCategoryManagerOpen(false));
  const foodEditorDialogRef = useModalAccessibility(isFoodEditorOpen, () => setIsFoodEditorOpen(false));

  const categories = useMemo(
    () =>
      Array.from(new Set(foods.map((food) => food.category || "Uncategorized")))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [foods]
  );

  const duplicateNameSet = useMemo(() => {
    const counts = foods.reduce<Record<string, number>>((result, food) => {
      const key = normalizeFoodName(food.name);
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {});

    return new Set(Object.entries(counts).filter(([, count]) => count > 1).map(([name]) => name));
  }, [foods]);

  const categoryStats = useMemo(
    () =>
      categories.map((category) => {
        const categoryFoods = foods.filter((food) => (food.category || "Uncategorized") === category);
        return {
          category,
          count: categoryFoods.length,
          aiCount: categoryFoods.filter(isAiEstimatedFood).length,
          unusedCount: categoryFoods.filter((food) => !wasUsedRecently(food, logs)).length
        };
      }),
    [categories, foods, logs]
  );

  const qualityCounts = useMemo(
    () => ({
      duplicates: foods.filter((food) => duplicateNameSet.has(normalizeFoodName(food.name))).length,
      unused: foods.filter((food) => !wasUsedRecently(food, logs)).length,
      ai: foods.filter(isAiEstimatedFood).length
    }),
    [duplicateNameSet, foods, logs]
  );

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return foods
      .filter((food) => !selectedCategory || (food.category || "Uncategorized") === selectedCategory)
      .filter((food) => {
        if (qualityFilter === "duplicates") {
          return duplicateNameSet.has(normalizeFoodName(food.name));
        }
        if (qualityFilter === "unused") {
          return !wasUsedRecently(food, logs);
        }
        if (qualityFilter === "ai") {
          return isAiEstimatedFood(food);
        }
        return true;
      })
      .filter((food) => !normalizedQuery || food.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sortMode === "category") return (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name);
        if (sortMode === "calories") return b.calories - a.calories || a.name.localeCompare(b.name);
        if (sortMode === "protein") return b.protein - a.protein || a.name.localeCompare(b.name);
        if (sortMode === "recent") return lastUsedDate(b, logs).localeCompare(lastUsedDate(a, logs)) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
  }, [duplicateNameSet, foods, logs, qualityFilter, query, selectedCategory, sortMode]);
  const visibleFoods = filteredFoods.slice(0, visibleLimit);

  function editFood(food: CommonFood) {
    setForm(food);
    setMacroMode("total");
    setLabelScale(defaultLabelScale);
    setIsFoodEditorOpen(true);
    setLastAddedFood(null);
    setMessage("");
    setError(null);
  }

  function toggleFoodSelection(foodId: string) {
    setSelectedFoodIds((current) => {
      const next = new Set(current);
      if (next.has(foodId)) {
        next.delete(foodId);
      } else {
        next.add(foodId);
      }
      return next;
    });
  }

  function selectVisibleFoods() {
    setSelectedFoodIds(new Set(filteredFoods.map((food) => food.id).filter(Boolean)));
  }

  function clearSelectedFoods() {
    setSelectedFoodIds(new Set());
  }

  function toggleBatchMode() {
    setIsBatchMode((current) => {
      if (current) {
        clearSelectedFoods();
      }
      return !current;
    });
  }

  function resetForm() {
    setForm(emptyFood);
    setMacroMode("total");
    setLabelScale(defaultLabelScale);
    setIsFoodEditorOpen(true);
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
      setIsFoodEditorOpen(false);
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
      setIsFoodEditorOpen(false);
      setLastAddedFood(null);
      setMessage("Food deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete food.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelectedFoods() {
    const selectedFoods = foods.filter((food) => selectedFoodIds.has(food.id));
    if (!selectedFoods.length || !window.confirm(`Delete ${selectedFoods.length} selected foods? Existing logs will keep their saved macro values.`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage("");

    try {
      await Promise.all(
        selectedFoods.map((food) =>
          fetch(`/api/foods?id=${encodeURIComponent(food.id)}`, {
            method: "DELETE"
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Failed to delete selected foods.");
            }
          })
        )
      );

      if (form.id && selectedFoodIds.has(form.id)) {
        setForm(emptyFood);
      }
      clearSelectedFoods();
      setLastAddedFood(null);
      setMessage(`Deleted ${selectedFoods.length} foods.`);
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete selected foods.");
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

  async function renameCategory() {
    const from = renameFromCategory.trim();
    const to = renameToCategory.trim();
    if (!from || !to || from === to) {
      return;
    }

    const foodsToUpdate = foods.filter((food) => (food.category || "Uncategorized") === from);
    if (!foodsToUpdate.length || !window.confirm(`Rename category "${from}" to "${to}" for ${foodsToUpdate.length} foods?`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage("");

    try {
      await Promise.all(
        foodsToUpdate.map((food) =>
          fetch("/api/foods", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...food, category: to })
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Failed to rename category.");
            }
          })
        )
      );
      await onChanged();
      setSelectedCategory(to);
      setRenameFromCategory("");
      setRenameToCategory("");
      setMessage(`Renamed ${foodsToUpdate.length} foods to ${to}.`);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Failed to rename category.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedFoodCount = selectedFoodIds.size;

  return (
    <section className="min-w-0 overflow-hidden">
      <div
        className={`mx-auto grid w-full gap-4 transition-[max-width] duration-300 ease-out ${
          isFoodEditorOpen ? "max-w-5xl lg:max-w-[1220px] lg:grid-cols-[minmax(0,1fr)_420px]" : "max-w-5xl"
        }`}
        style={isFoodEditorOpen ? { maxWidth: "1220px" } : undefined}
      >
      <div
        className={`min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition duration-300 ease-out ${
          isFoodEditorOpen ? "lg:pointer-events-none" : ""
        }`}
        style={{
          filter: isFoodEditorOpen ? "blur(1.25px)" : "blur(0px)",
          opacity: isFoodEditorOpen ? 0.72 : 1,
          transform: isFoodEditorOpen ? "translateX(-1.25rem)" : "translateX(0)",
          transition: "transform 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms ease-out, opacity 260ms ease-out",
          willChange: isFoodEditorOpen ? "transform, filter, opacity" : undefined
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Database size={20} />
              Foods database
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage the saved foods used by logging and meal prep.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${isCategoryManagerOpen ? "bg-blue-50 text-blue-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              type="button"
              onClick={() => setIsCategoryManagerOpen((current) => !current)}
            >
              <FolderCog size={16} />
              Categories
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${isBatchMode ? "bg-ink text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              type="button"
              onClick={toggleBatchMode}
            >
              <ListChecks size={16} />
              {isBatchMode ? "Done" : "Batch"}
            </button>
            <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" type="button" onClick={resetForm}>
              <span className="inline-flex items-center gap-2">
                <Plus size={16} />
                New food
              </span>
            </button>
          </div>
        </div>

        <div className="sticky top-0 z-20 mt-4 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-2.5 backdrop-blur sm:grid-cols-[180px_170px_1fr]">
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
            Sort
            <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={sortMode} onChange={(event) => setSortMode(event.target.value as FoodSortMode)}>
              <option value="name">Name A-Z</option><option value="category">Category</option><option value="calories">Highest calories</option><option value="protein">Highest protein</option><option value="recent">Recently used</option>
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

        <div className="mt-3 flex flex-wrap gap-2">
          <QualityButton active={qualityFilter === "all"} label="All foods" value={foods.length} onClick={() => setQualityFilter("all")} />
          <QualityButton active={qualityFilter === "duplicates"} label="Duplicates" value={qualityCounts.duplicates} onClick={() => setQualityFilter("duplicates")} />
          <QualityButton active={qualityFilter === "unused"} label="Unused 30d" value={qualityCounts.unused} onClick={() => setQualityFilter("unused")} />
          <QualityButton active={qualityFilter === "ai"} label="AI estimated" value={qualityCounts.ai} onClick={() => setQualityFilter("ai")} />
        </div>

        {isCategoryManagerOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Category management">
          <button aria-label="Close category management" className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm" type="button" onClick={() => setIsCategoryManagerOpen(false)} />
        <div ref={categoryDialogRef} className="relative z-10 w-full max-w-2xl animate-enter-soft rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FolderCog size={16} className="text-blue-700" />
              Category management
            </p>
            <button aria-label="Close category management" className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-500" type="button" onClick={() => setIsCategoryManagerOpen(false)}><X size={16} /></button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categoryStats.map((stat) => (
              <button
                key={stat.category}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition ${selectedCategory === stat.category ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                type="button"
                onClick={() => setSelectedCategory(stat.category)}
              >
                <span className="block font-semibold">{stat.category}</span>
                <span className="mt-1 block">{stat.count} foods / {stat.unusedCount} unused / {stat.aiCount} AI</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={renameFromCategory} onChange={(event) => setRenameFromCategory(event.target.value)}>
              <option value="">Rename from</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="New category name" value={renameToCategory} onChange={(event) => setRenameToCategory(event.target.value)} />
            <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isSaving || !renameFromCategory || !renameToCategory} type="button" onClick={renameCategory}>
              Rename
            </button>
          </div>
        </div>
        </div>
        ) : null}

        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? (
          <div className="mt-4 flex flex-col gap-3 rounded-md bg-green-50 p-3 text-sm text-green-700 sm:flex-row sm:items-center sm:justify-between">
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

        {isBatchMode ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ListChecks size={16} className="text-blue-700" />
            {selectedFoodCount} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600" type="button" onClick={selectVisibleFoods}>
              Select visible
            </button>
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50" disabled={!selectedFoodCount} type="button" onClick={clearSelectedFoods}>
              Clear
            </button>
            <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50" disabled={isSaving || !selectedFoodCount} type="button" onClick={deleteSelectedFoods}>
              Delete selected
            </button>
          </div>
        </div>
        ) : null}

        <div className="mt-4 hidden max-h-[620px] overflow-y-auto rounded-lg border border-slate-200 lg:block">
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(190px,1.6fr)_110px_105px_64px_50px_50px_50px_92px_120px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Name</span><span>Category</span><span>Serving</span><span>Kcal</span><span>P</span><span>F</span><span>C</span><span>Last used</span><span>Quality</span>
          </div>
          {visibleFoods.map((food) => {
            const lastUsed = lastUsedDate(food, logs);
            const quality = duplicateNameSet.has(normalizeFoodName(food.name)) ? "Duplicate" : isAiEstimatedFood(food) ? "AI estimated" : !wasUsedRecently(food, logs) ? "Unused 30d" : "Clean";
            return (
              <div key={food.id} className={`grid grid-cols-[minmax(190px,1.6fr)_110px_105px_64px_50px_50px_50px_92px_120px] items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm transition last:border-b-0 hover:bg-blue-50/60 ${selectedFoodIds.has(food.id) ? "bg-blue-50" : "bg-white"}`}>
                <div className="flex min-w-0 items-center gap-2">
                  {isBatchMode ? <input aria-label={`Select ${food.name}`} checked={selectedFoodIds.has(food.id)} type="checkbox" onChange={() => toggleFoodSelection(food.id)} /> : null}
                  <button className="min-w-0 truncate text-left font-semibold hover:text-blue-700" type="button" onClick={() => (isBatchMode ? toggleFoodSelection(food.id) : editFood(food))}>{food.name}</button>
                </div>
                <span className="truncate text-slate-600">{food.category || "Uncategorized"}</span>
                <span className="truncate text-slate-500">{food.serving}</span>
                <span className="font-semibold">{roundMacro(food.calories)}</span><span>{roundMacro(food.protein)}</span><span>{roundMacro(food.fat)}</span><span>{roundMacro(food.carbs)}</span>
                <span className="text-xs text-slate-500">{lastUsed ? lastUsed.slice(5) : "Never"}</span>
                <div className="flex min-w-0 items-center gap-1">
                  <span className={`truncate rounded-full px-2 py-1 text-[11px] font-semibold ${quality === "Clean" ? "bg-emerald-50 text-emerald-700" : quality === "Duplicate" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{quality}</span>
                  {isMealPrepFood(food) ? <button aria-label={`Edit ${food.name} in meal prep`} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-blue-700 hover:bg-blue-100" type="button" onClick={() => onEditMealPrep(food)}><CookingPot size={14} /></button> : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid max-h-[620px] min-w-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:hidden">
          {visibleFoods.map((food) => (
            <div
              key={food.id}
              className={`rounded-lg border p-3 transition hover:border-accent hover:bg-blue-50 hover:shadow-sm ${form.id === food.id ? "border-accent bg-blue-50" : selectedFoodIds.has(food.id) ? "border-blue-200 bg-blue-50/60" : "border-slate-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {isBatchMode ? (
                    <input
                      aria-label={`Select ${food.name}`}
                      className="mt-1"
                      checked={selectedFoodIds.has(food.id)}
                      type="checkbox"
                      onChange={() => toggleFoodSelection(food.id)}
                    />
                  ) : null}
                  <button className="min-w-0 text-left" type="button" onClick={() => (isBatchMode ? toggleFoodSelection(food.id) : editFood(food))}>
                    <p className="font-medium">{food.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{food.category || "Uncategorized"} / {food.serving}</p>
                  </button>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{food.calories} kcal</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">P {food.protein} / F {food.fat} / C {food.carbs}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{servingStandard(food)}</span>
                {isMealPrepFood(food) ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"
                    type="button"
                    onClick={() => onEditMealPrep(food)}
                  >
                    <CookingPot size={12} />
                    Edit in meal prep
                  </button>
                ) : null}
                {duplicateNameSet.has(normalizeFoodName(food.name)) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                    <AlertTriangle size={12} />
                    Duplicate
                  </span>
                ) : null}
                {!wasUsedRecently(food, logs) ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Unused 30d</span> : null}
                {isAiEstimatedFood(food) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    <Sparkles size={12} />
                    AI
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {visibleLimit < filteredFoods.length ? <button className="mx-auto mt-3 flex min-h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50" type="button" onClick={() => setVisibleLimit((current) => current + 50)}>Load 50 more</button> : null}
      </div>

      {isFoodEditorOpen ? (
        <div className="fixed inset-0 z-50 lg:static lg:z-auto" role="dialog" aria-modal="true" aria-label={form.id ? "Edit food" : "Add food"}>
          <button
            aria-label="Close food editor"
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm lg:hidden"
            type="button"
            onClick={() => setIsFoodEditorOpen(false)}
          />
          <aside ref={foodEditorDialogRef} className="mobile-sheet-enter absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-full lg:translate-x-0 lg:animate-enter-soft lg:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
                  {form.id ? <Save size={20} /> : <Plus size={20} />}
                  {form.id ? "Edit food" : "Add food"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{form.id ? "Update the saved database item." : "Create a reusable food for faster logging."}</p>
              </div>
              <button
                aria-label="Close food editor"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                type="button"
                onClick={() => setIsFoodEditorOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
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
                        <DecimalNumberInput
                          className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
                          value={labelScale.baseAmount}
                          onValueChange={(nextValue) => updateLabelScale("baseAmount", String(nextValue))}
                        />
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
                        Serving
                        <DecimalNumberInput
                          className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
                          value={labelScale.servingAmount}
                          onValueChange={(nextValue) => updateLabelScale("servingAmount", String(nextValue))}
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
                          <DecimalNumberInput
                            className="w-full min-w-0 rounded-md border border-slate-300 px-2 py-2 font-normal"
                            value={labelScale[field]}
                            onValueChange={(nextValue) => updateLabelScale(field, String(nextValue))}
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
                      <DecimalNumberInput className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={form[field]} onValueChange={(nextValue) => updateField(field, String(nextValue))} />
                    )}
                  </label>
                ))}
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Notes
                <textarea className="min-h-36 rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
              </label>
            </div>

            <div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap gap-2 border-t border-slate-200 bg-white px-4 py-3">
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
              {form.id && isMealPrepFood(form as CommonFood) ? (
                <button className="rounded-md border border-blue-200 px-4 py-2 font-semibold text-blue-700 disabled:opacity-60" disabled={isSaving} type="button" onClick={() => onEditMealPrep(form as CommonFood)}>
                  <span className="inline-flex items-center gap-2">
                    <CookingPot size={16} />
                    Edit in meal prep
                  </span>
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
      </div>
    </section>
  );
}

function QualityButton({ active, label, value, onClick }: { active: boolean; label: string; value: number; onClick: () => void }) {
  return (
    <button
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 ${active ? "bg-white/80" : "bg-slate-100"}`}>{value}</span>
    </button>
  );
}
