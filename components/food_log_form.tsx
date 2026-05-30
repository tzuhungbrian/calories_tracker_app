"use client";

import type { FoodLogInput } from "@/lib/types";

type FoodLogFormProps = {
  value: FoodLogInput;
  isSaving: boolean;
  onChange: (value: FoodLogInput) => void;
  onSubmit: () => Promise<void>;
};

const macroFields: Array<keyof Pick<FoodLogInput, "calories" | "protein" | "fat" | "carbs">> = [
  "calories",
  "protein",
  "fat",
  "carbs"
];

const macroLabels: Record<(typeof macroFields)[number], string> = {
  calories: "Calories (kcal)",
  protein: "Protein (g)",
  fat: "Fat (g)",
  carbs: "Carbs (g)"
};

const mealOptions = ["Breakfast", "Lunch", "Dinner", "Snack", "Supplements", "Drinks"];

export function FoodLogForm({ value, isSaving, onChange, onSubmit }: FoodLogFormProps) {
  function updateField(field: keyof FoodLogInput, fieldValue: string) {
    onChange({
      ...value,
      [field]: macroFields.includes(field as (typeof macroFields)[number]) ? Number(fieldValue) : fieldValue
    });
  }

  return (
    <form
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit();
      }}
    >
      <h2 className="text-lg font-semibold">Add food log</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Date
          <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" type="date" value={value.date} onChange={(event) => updateField("date", event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Meal
          <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={value.meal} onChange={(event) => updateField("meal", event.target.value)}>
            <option value="">Select meal</option>
            {mealOptions.map((meal) => (
              <option key={meal} value={meal}>
                {meal}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Food name
          <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="e.g. chicken breast, ramen, protein shake" value={value.foodName} onChange={(event) => updateField("foodName", event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Amount / serving
          <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="e.g. 1 pack, 100 g, 1.5 servings" value={value.amount} onChange={(event) => updateField("amount", event.target.value)} />
        </label>
        {macroFields.map((field) => (
          <label key={field} className="grid gap-1 text-sm font-medium text-slate-700">
            {macroLabels[field]}
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-normal"
              min="0"
              step="0.1"
              type="number"
              value={value[field]}
              onChange={(event) => updateField(field, event.target.value)}
            />
          </label>
        ))}
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Notes
          <textarea className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional notes" value={value.notes} onChange={(event) => updateField("notes", event.target.value)} />
        </label>
      </div>
      <button className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isSaving}>
        {isSaving ? "Saving..." : "Add food"}
      </button>
    </form>
  );
}
