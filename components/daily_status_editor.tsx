"use client";

import { Activity, CalendarDays, CircleDot, Dumbbell, Footprints, Pencil, Plane, Plus, Timer, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useModalAccessibility } from "@/components/use_modal_accessibility";
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
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [draftStrengthSession, setDraftStrengthSession] = useState(false);
  const [draftBasketballSelected, setDraftBasketballSelected] = useState(false);
  const [draftBasketballMinutes, setDraftBasketballMinutes] = useState(0);
  const [exerciseError, setExerciseError] = useState("");
  const yesterday = offsetDateKey(today, -1);
  const exerciseDone = value.strengthSession || value.basketballMinutes > 0;
  const exerciseSummary = value.strengthSession && value.basketballMinutes > 0
    ? `Strength + Basketball · ${Math.round(value.basketballMinutes)} min`
    : value.strengthSession
      ? "Strength training"
      : value.basketballMinutes > 0
        ? `Basketball · ${Math.round(value.basketballMinutes)} min`
        : "No exercise logged";
  const exerciseDialogRef = useModalAccessibility(isExercisePickerOpen, closeExercisePicker);

  function openExercisePicker() {
    setDraftStrengthSession(value.strengthSession);
    setDraftBasketballSelected(value.basketballMinutes > 0);
    setDraftBasketballMinutes(value.basketballMinutes);
    setExerciseError("");
    setIsExercisePickerOpen(true);
  }

  function closeExercisePicker() {
    setIsExercisePickerOpen(false);
    setExerciseError("");
  }

  function confirmExercise() {
    if (!draftStrengthSession && !draftBasketballSelected) {
      setExerciseError("Choose at least one activity.");
      return;
    }

    if (draftBasketballSelected && draftBasketballMinutes <= 0) {
      setExerciseError("Add the basketball duration.");
      return;
    }

    onChange({
      ...value,
      strengthSession: draftStrengthSession,
      basketballMinutes: draftBasketballSelected ? draftBasketballMinutes : 0
    });
    closeExercisePicker();
  }

  function removeExercise() {
    onChange({ ...value, strengthSession: false, basketballMinutes: 0 });
  }

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
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
          value.isTravelDay
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
        }`}
      >
        <input
          className="mt-1"
          type="checkbox"
          checked={value.isTravelDay}
          onChange={(event) => onChange({ ...value, isTravelDay: event.target.checked })}
        />
        <span className="min-w-0">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Plane size={16} />
            Travel day
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            Exclude this date from AI adherence judgment while keeping the food logs.
          </span>
        </span>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <Footprints size={16} />
          Steps
        </span>
        <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" min="0" type="number" value={value.steps} onChange={(event) => onChange({ ...value, steps: Number(event.target.value) })} />
      </label>
      {exerciseDone ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <Activity size={15} />
                Exercise logged
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{exerciseSummary}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                aria-label="Edit exercise"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950"
                type="button"
                onClick={openExercisePicker}
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label="Remove exercise"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                type="button"
                onClick={removeExercise}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300" type="button" onClick={openExercisePicker}>
            <Pencil size={14} />
            Edit exercise
          </button>
        </div>
      ) : (
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
          type="button"
          onClick={openExercisePicker}
        >
          <Plus size={17} />
          Log exercise
        </button>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.creatineTaken} onChange={(event) => onChange({ ...value, creatineTaken: event.target.checked })} />
        Creatine taken
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
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${value.isTravelDay ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
          {value.isTravelDay ? "travel" : value.goalType}
        </span>
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

    {isExercisePickerOpen && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label={exerciseDone ? "Edit exercise" : "Log exercise"}>
        <button
          aria-label="Close exercise picker"
          className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
          type="button"
          onClick={closeExercisePicker}
        />
        <div
          ref={exerciseDialogRef}
          className="mobile-sheet-enter relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 lg:max-w-md lg:animate-enter-soft lg:rounded-2xl"
        >
          <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-3 dark:border-slate-700 lg:px-5 lg:pt-5">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 lg:hidden" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Exercise</p>
                <h2 className="mt-0.5 text-xl font-semibold">{exerciseDone ? "Edit exercise" : "Log exercise"}</h2>
              </div>
              <button
                aria-label="Close exercise picker"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                type="button"
                onClick={closeExercisePicker}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <form
            className="min-h-0 flex-1 overflow-y-auto"
            onSubmit={(event) => {
              event.preventDefault();
              confirmExercise();
            }}
          >
            <div className="grid gap-4 p-4 lg:p-5">
              <fieldset>
                <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">What did you do?</legend>
                <p className="mt-1 text-xs text-slate-500">Select one or both activities.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    aria-pressed={draftStrengthSession}
                    className={`min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${draftStrengthSession ? "border-blue-400 bg-blue-50 text-blue-800 ring-1 ring-blue-200 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"}`}
                    type="button"
                    onClick={() => {
                      setDraftStrengthSession((current) => !current);
                      setExerciseError("");
                    }}
                  >
                    <Dumbbell size={21} />
                    <span className="mt-3 block text-sm font-semibold">Strength training</span>
                  </button>
                  <button
                    aria-pressed={draftBasketballSelected}
                    className={`min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${draftBasketballSelected ? "border-orange-400 bg-orange-50 text-orange-800 ring-1 ring-orange-200 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900" : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-orange-800 dark:hover:bg-orange-950/20"}`}
                    type="button"
                    onClick={() => {
                      setDraftBasketballSelected((current) => !current);
                      setExerciseError("");
                    }}
                  >
                    <CircleDot size={21} />
                    <span className="mt-3 block text-sm font-semibold">Basketball</span>
                  </button>
                </div>
              </fieldset>

              {draftBasketballSelected ? (
                <fieldset className="animate-enter-soft rounded-lg border border-orange-100 bg-orange-50/60 p-3 dark:border-orange-900 dark:bg-orange-950/20">
                  <legend className="inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <Timer size={16} />
                    Basketball duration
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[30, 60, 90].map((minutes) => (
                      <button
                        key={minutes}
                        aria-pressed={draftBasketballMinutes === minutes}
                        className={`h-10 rounded-md border text-sm font-semibold transition ${draftBasketballMinutes === minutes ? "border-orange-400 bg-orange-500 text-white" : "border-orange-200 bg-white text-slate-600 hover:bg-orange-100 dark:border-orange-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-orange-950"}`}
                        type="button"
                        onClick={() => {
                          setDraftBasketballMinutes(minutes);
                          setExerciseError("");
                        }}
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Custom minutes
                    <input
                      className="h-11 rounded-md border border-slate-300 px-3 font-normal dark:border-slate-700"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      type="number"
                      value={draftBasketballMinutes || ""}
                      onChange={(event) => {
                        setDraftBasketballMinutes(Math.max(0, Number(event.target.value)));
                        setExerciseError("");
                      }}
                    />
                  </label>
                </fieldset>
              ) : null}

              {exerciseError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{exerciseError}</p> : null}
            </div>

            <div className="sticky bottom-0 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:px-5">
              <button className="h-11 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" type="button" onClick={closeExercisePicker}>
                Cancel
              </button>
              <button className="h-11 rounded-lg bg-ink text-sm font-semibold text-white transition hover:bg-slate-800" type="submit">
                {exerciseDone ? "Update exercise" : "Add exercise"}
              </button>
            </div>
          </form>
        </div>
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
