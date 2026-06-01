"use client";

import { useMemo, useState } from "react";

type CategorySelectProps = {
  categories: string[];
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function CategorySelect({ categories, label = "Category", value, onChange, placeholder = "New category" }: CategorySelectProps) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const options = useMemo(() => {
    const categorySet = new Set(categories.filter(Boolean));
    if (value.trim()) {
      categorySet.add(value.trim());
    }
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [categories, value]);

  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
      {label}
      {isAddingCategory ? (
        <div className="grid gap-2">
          <input
            className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            className="w-fit rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
            type="button"
            onClick={() => {
              onChange(value.trim() || options[0] || "");
              setIsAddingCategory(false);
            }}
          >
            Use selected category list
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          <select
            className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 font-normal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            className="w-fit rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
            type="button"
            onClick={() => setIsAddingCategory(true)}
          >
            + Add new category
          </button>
        </div>
      )}
    </label>
  );
}
