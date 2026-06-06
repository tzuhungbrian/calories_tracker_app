"use client";

import { LockKeyhole, Loader2, Sprout } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = searchParams.get("next") || "/";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(formData.get("username") || ""),
        password: String(formData.get("password") || "")
      })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Sign in failed.");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-ink dark:bg-slate-950">
      <div className="animate-enter-soft w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
        <div className="border-b border-slate-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-6 dark:border-slate-800 dark:from-blue-950/50 dark:via-slate-900 dark:to-emerald-950/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Sprout size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to Calories Tracker</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use your app username and password. Password managers can fill this form normally.</p>
        </div>

        <form className="grid gap-4 p-6" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Username
            <input
              autoComplete="username"
              autoFocus
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950"
              name="username"
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Password
            <input
              autoComplete="current-password"
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950"
              name="password"
              required
              type="password"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-600"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={17} /> : <LockKeyhole size={17} />}
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
