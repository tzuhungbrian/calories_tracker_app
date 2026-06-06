"use client";

import { Activity, CalendarDays, Dumbbell, Footprints, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { DailyStatus, GoalType } from "@/lib/types";

type DailyStatusEditorProps = {
  value: DailyStatus;
  today: string;
  isSaving: boolean;
  onChange: (value: DailyStatus) => void;
  onDateSelect: (date: string) => Promise<void>;
  onSubmit: () => Promise<void>;
};

function offsetDateKey(date: string, days: number): string {
  const nextDate = new Date(`${date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

export function DailyStatusEditor({ value, today, isSaving, onChange, onDateSelect, onSubmit }: DailyStatusEditorProps) {
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const yesterday = offsetDateKey(today, -1);
  const exerciseDone = value.strengthSession || value.basketballMinutes > 0;

  async function submitStatus() {
    await onSubmit();
    setIsMobileEditorOpen(false);
  }

  const statusFields = (
    <div className="mt-4 grid gap-3">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={16} />
          Date
        </span>
        <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" type="date" value={value.date} onChange={(event) => void onDateSelect(event.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${value.date === today ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          type="button"
          onClick={() => void onDateSelect(today)}
        >
          Today
        </button>
        <button
          className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${value.date === yesterday ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          type="button"
          onClick={() => void onDateSelect(yesterday)}
        >
          Yesterday
        </button>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Goal type
        <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={value.goalType} onChange={(event) => onChange({ ...value, goalType: event.target.value as GoalType })}>
          <option value="cut">Cut</option>
          <option value="maintain">Maintain</option>
          <option value="bulk">Bulk</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <Footprints size={16} />
          Steps
        </span>
        <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="0" type="number" value={value.steps} onChange={(event) => onChange({ ...value, steps: Number(event.target.value) })} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.strengthSession} onChange={(event) => onChange({ ...value, strengthSession: event.target.checked })} />
        <span className="inline-flex items-center gap-1.5">
          <Dumbbell size={16} />
          Strength session
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.creatineTaken} onChange={(event) => onChange({ ...value, creatineTaken: event.target.checked })} />
        Creatine taken
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Basketball minutes
        <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="0" type="number" value={value.basketballMinutes} onChange={(event) => onChange({ ...value, basketballMinutes: Number(event.target.value) })} />
      </label>
    </div>
  );

  return (
    <>
    <section className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Activity size={20} />
            Daily status
          </h2>
          <p className="mt-1 text-sm text-slate-500">Update steps, training, and supplements.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{value.goalType}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
          <p className="text-slate-500">Steps</p>
          <p className="mt-1 text-sm text-ink">{Math.round(value.steps)}</p>
        </div>
        <div className={`rounded-lg border px-2 py-2 ${exerciseDone ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          <p>Exercise</p>
          <p className="mt-1 text-sm text-ink">{exerciseDone ? "Logged" : "Open"}</p>
        </div>
        <div className={`rounded-lg border px-2 py-2 ${value.creatineTaken ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          <p>Creatine</p>
          <p className="mt-1 text-sm text-ink">{value.creatineTaken ? "Taken" : "Open"}</p>
        </div>
      </div>

      <button
        className="mt-4 w-full rounded-xl bg-ink px-4 py-3 font-semibold text-white"
        type="button"
        onClick={() => setIsMobileEditorOpen(true)}
      >
        Edit status
      </button>
    </section>

    {isMobileEditorOpen && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Edit daily status">
        <button
          aria-label="Close daily status"
          className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
          type="button"
          onClick={() => setIsMobileEditorOpen(false)}
        />
        <form
          className="mobile-sheet-enter absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitStatus();
          }}
        >
          <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-700">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{value.date}</p>
                <h2 className="text-xl font-semibold">Daily status</h2>
              </div>
              <button
                aria-label="Close daily status"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                type="button"
                onClick={() => setIsMobileEditorOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {statusFields}
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-slate-700 dark:bg-slate-900">
            <button className="h-12 w-full rounded-xl bg-ink px-4 font-semibold text-white disabled:opacity-60" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save status"}
            </button>
          </div>
        </form>
      </div>,
      document.body
    ) : null}

    <form
      className="hidden animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit();
      }}
    >
      <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
        <Activity size={20} />
        Daily status
      </h2>
      <p className="mt-1 text-sm text-slate-500">Pick any date to correct steps or training status later.</p>
      {statusFields}
      <button className="mt-4 w-full rounded-md bg-ink px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save status"}
      </button>
    </form>
    </>
  );
}
