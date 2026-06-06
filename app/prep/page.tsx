import Link from "next/link";
import { LogoutButton } from "@/components/logout_button";
import { MealPrepCalculator } from "@/components/meal_prep_calculator";
import { ThemeToggle } from "@/components/theme_toggle";

export default function PrepCalculatorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">Meal prep calculator</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Build a reusable meal</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:border-accent dark:border-slate-700 dark:bg-slate-900" href="/">
            Back to dashboard
          </Link>
          <ThemeToggle />
          <LogoutButton compact />
        </div>
      </header>
      <MealPrepCalculator />
    </main>
  );
}
