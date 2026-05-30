import Link from "next/link";
import { MealPrepCalculator } from "@/components/meal_prep_calculator";

export default function PrepCalculatorPage() {
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
      <MealPrepCalculator />
    </main>
  );
}
