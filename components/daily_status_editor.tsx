"use client";

import { Activity, CalendarDays, Dumbbell, Footprints } from "lucide-react";
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
  const yesterday = offsetDateKey(today, -1);

  return (
    <form
      className="animate-enter rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
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
      <button className="mt-4 w-full rounded-md bg-ink px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save status"}
      </button>
    </form>
  );
}
