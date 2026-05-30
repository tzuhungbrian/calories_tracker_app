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
        <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={value.date} onChange={(event) => updateField("date", event.target.value)} />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Meal" value={value.meal} onChange={(event) => updateField("meal", event.target.value)} />
        <input className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2" placeholder="Food name" value={value.foodName} onChange={(event) => updateField("foodName", event.target.value)} />
        <input className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2" placeholder="Amount / serving" value={value.amount} onChange={(event) => updateField("amount", event.target.value)} />
        {macroFields.map((field) => (
          <input
            key={field}
            className="rounded-md border border-slate-300 px-3 py-2"
            min="0"
            placeholder={field}
            type="number"
            value={value[field]}
            onChange={(event) => updateField(field, event.target.value)}
          />
        ))}
        <textarea className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2" placeholder="Notes" value={value.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </div>
      <button className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isSaving}>
        {isSaving ? "Saving..." : "Add food"}
      </button>
    </form>
  );
}
