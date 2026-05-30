"use client";

import type { CommonFood, FoodLogInput } from "@/lib/types";

type CommonFoodSelectorProps = {
  foods: CommonFood[];
  onSelect: (food: Partial<FoodLogInput>) => void;
};

export function CommonFoodSelector({ foods, onSelect }: CommonFoodSelectorProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Common foods</h2>
      <select
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2"
        defaultValue=""
        onChange={(event) => {
          const food = foods.find((item) => item.name === event.target.value);
          if (food) {
            onSelect({
              foodName: food.name,
              amount: food.serving,
              calories: food.calories,
              protein: food.protein,
              fat: food.fat,
              carbs: food.carbs
            });
          }
        }}
      >
        <option value="">Select a common food</option>
        {foods.map((food) => (
          <option key={`${food.name}-${food.serving}`} value={food.name}>
            {food.name} ({food.serving})
          </option>
        ))}
      </select>
    </div>
  );
}
