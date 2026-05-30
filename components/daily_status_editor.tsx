"use client";

import { Activity, Dumbbell } from "lucide-react";
import type { DailyStatus, GoalType } from "@/lib/types";

type DailyStatusEditorProps = {
  value: DailyStatus;
  isSaving: boolean;
  onChange: (value: DailyStatus) => void;
  onSubmit: () => Promise<void>;
};

export function DailyStatusEditor({ value, isSaving, onChange, onSubmit }: DailyStatusEditorProps) {
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
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Date
          <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" type="date" value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Goal type
          <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={value.goalType} onChange={(event) => onChange({ ...value, goalType: event.target.value as GoalType })}>
            <option value="cut">Cut</option>
            <option value="maintain">Maintain</option>
            <option value="bulk">Bulk</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Steps
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
      <button className="mt-4 rounded-md bg-ink px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save status"}
      </button>
    </form>
  );
}
