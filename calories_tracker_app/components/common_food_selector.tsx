"use client";

import { useMemo, useState } from "react";
import type { CommonFood, FoodLogInput } from "@/lib/types";

type CommonFoodSelectorProps = {
  foods: CommonFood[];
  onSelect: (food: Partial<FoodLogInput>) => void;
};

export function CommonFoodSelector({ foods, onSelect }: CommonFoodSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFoodName, setSelectedFoodName] = useState("");
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

  function selectFood(foodName: string) {
    setSelectedFoodName(foodName);
    const food = foods.find((item) => item.name === foodName);
    if (food) {
      onSelect({
        foodId: food.id,
        foodName: food.name,
        amount: food.serving,
        calories: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs
      });
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Common foods</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Category
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value);
              setSelectedFoodName("");
            }}
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
          Select a saved food to fill the form
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            value={selectedFoodName}
            onChange={(event) => selectFood(event.target.value)}
          >
            <option value="">Choose from foods</option>
            {filteredFoods.map((food) => (
              <option key={`${food.name}-${food.serving}`} value={food.name}>
                {food.name} ({food.serving})
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
