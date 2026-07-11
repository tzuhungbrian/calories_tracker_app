"use client";

import { Activity, CalendarDays, Download, Plane, Save, Target, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { dateKey, dateRangeKeys } from "@/lib/date";
import type { DailyStatus, UserProfileSettings } from "@/lib/types";

type SettingsPanelProps = {
  onChanged: () => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
};

type SettingsSection = "profile" | "energy" | "targets" | "travel" | "data";

const emptySettings: UserProfileSettings = {
  displayName: "Brian",
  heightCm: 0,
  age: 0,
  sex: "",
  bmrMode: "manual",
  weightKg: 0,
  bmr: 0,
  baseActivityFactor: 1.2,
  caloriesPerStep: 0.04,
  exerciseStepGoal: 8000,
  strengthTrainingKcal: 250,
  basketballKcalPerMinute: 8,
  proteinTargetPerKg: 2,
  fatTargetPerKg: 0.9,
  cutAdjustmentKcal: -300,
  maintainAdjustmentKcal: 0,
  bulkAdjustmentKcal: 250
};

const numericFields: Array<keyof Omit<UserProfileSettings, "displayName" | "sex" | "bmrMode">> = [
  "heightCm",
  "age",
  "weightKg",
  "bmr",
  "baseActivityFactor",
  "caloriesPerStep",
  "exerciseStepGoal",
  "strengthTrainingKcal",
  "basketballKcalPerMinute",
  "proteinTargetPerKg",
  "fatTargetPerKg",
  "cutAdjustmentKcal",
  "maintainAdjustmentKcal",
  "bulkAdjustmentKcal"
];

function calculateBmr(settings: Pick<UserProfileSettings, "weightKg" | "heightCm" | "age" | "sex">): number {
  const sex = settings.sex.trim().toLowerCase();

  if (!settings.weightKg || !settings.heightCm || !settings.age || (sex !== "male" && sex !== "female")) {
    return 0;
  }

  const sexAdjustment = sex === "male" ? 5 : -161;
  return Math.round(10 * settings.weightKg + 6.25 * settings.heightCm - 5 * settings.age + sexAdjustment);
}

function effectiveBmr(settings: UserProfileSettings): number {
  return settings.bmrMode === "auto" ? calculateBmr(settings) || settings.bmr : settings.bmr;
}

function createEmptyStatus(date: string): DailyStatus {
  return {
    date,
    goalType: "maintain",
    steps: 0,
    strengthSession: false,
    creatineTaken: false,
    basketballMinutes: 0,
    isTravelDay: false
  };
}

export function SettingsPanel({ onChanged, onDirtyChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserProfileSettings>(emptySettings);
  const [savedSettings, setSavedSettings] = useState<UserProfileSettings>(emptySettings);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exportMode, setExportMode] = useState<"all" | "range">("all");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
          throw new Error("Failed to load settings.");
        }
        const data = (await response.json()) as UserProfileSettings;
        if (isActive) {
          setSettings(data);
          setSavedSettings(data);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();
    return () => {
      isActive = false;
    };
  }, []);

  function updateField(field: keyof UserProfileSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: numericFields.includes(field as (typeof numericFields)[number]) ? Number(value) || 0 : value
    }));
  }

  async function saveSettings() {
    setIsSaving(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          bmr: effectiveBmr(settings)
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save settings.");
      }

      const saved = (await response.json()) as UserProfileSettings;
      setSettings(saved);
      setSavedSettings(saved);
      await onChanged();
      setMessage("Settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  const calculatedBmr = calculateBmr(settings);
  const displayBmr = effectiveBmr(settings);
  const canAutoCalculateBmr = calculatedBmr > 0;
  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const canExport = exportMode === "all" || Boolean(exportStartDate && exportEndDate && exportStartDate <= exportEndDate);
  const exportHref =
    exportMode === "range" && canExport
      ? `/api/export?start=${encodeURIComponent(exportStartDate)}&end=${encodeURIComponent(exportEndDate)}`
      : "/api/export";

  useEffect(() => {
    onDirtyChange?.(isDirty);
    if (!isDirty) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, onDirtyChange]);

  return (
    <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-5">
        <div className="flex items-center gap-3 border-b border-slate-200 px-2 pb-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-700"><UserRound size={20} /></div>
          <div className="min-w-0"><p className="truncate font-semibold">{settings.displayName || "Brian"}</p><p className="text-xs text-slate-500">{isDirty ? "Unsaved changes" : "Settings saved"}</p></div>
        </div>
        <nav className="mt-3 grid gap-1">
          {([
            ["profile", "Profile", UserRound], ["energy", "Energy model", Activity], ["targets", "Targets", Target], ["travel", "Travel days", Plane], ["data", "Data export", Download]
          ] as const).map(([id, label, Icon]) => (
            <button key={id} className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition ${activeSection === id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} type="button" onClick={() => setActiveSection(id)}><Icon size={17} />{label}</button>
          ))}
        </nav>
      </aside>

      <div className="grid min-w-0 gap-4">
      <div className={`${activeSection === "travel" || activeSection === "data" ? "grid" : "hidden"} gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm`}>
        {activeSection === "travel" ? <TravelDayManager onChanged={onChanged} /> : null}

          {activeSection === "data" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Export Data</p>
                <p className="mt-1 text-xs text-slate-500">Download a CSV backup for all data or a specific date range.</p>
              </div>
              <div className="inline-grid rounded-lg border border-slate-200 bg-white p-1 sm:grid-cols-2">
                {(["all", "range"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${exportMode === mode ? "bg-ink text-white" : "text-slate-600"}`}
                    type="button"
                    onClick={() => setExportMode(mode)}
                  >
                    {mode === "all" ? "All data" : "Date range"}
                  </button>
                ))}
              </div>
            </div>

            {exportMode === "range" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
                    type="date"
                    value={exportStartDate}
                    onChange={(event) => setExportStartDate(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  End
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
                    type="date"
                    value={exportEndDate}
                    onChange={(event) => setExportEndDate(event.target.value)}
                  />
                </label>
                <a
                  aria-disabled={!canExport}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold shadow-sm ${canExport ? "bg-ink text-white hover:bg-slate-800" : "pointer-events-none bg-slate-200 text-slate-400"}`}
                  href={exportHref}
                >
                  <Download size={16} />
                  Export Data
                </a>
              </div>
            ) : (
              <a
                className="mt-3 inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                href={exportHref}
              >
                <Download size={16} />
                Export Data
              </a>
            )}

            {exportMode === "range" && exportStartDate && exportEndDate && exportStartDate > exportEndDate ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Start date must be before end date.</p>
            ) : null}
          </div>
          ) : null}
      </div>

      <div className={`${activeSection === "profile" || activeSection === "energy" || activeSection === "targets" ? "grid" : "hidden"} gap-4 ${activeSection === "profile" ? "lg:grid-cols-[320px_minmax(0,1fr)]" : "grid-cols-1"}`}>
        <aside className={`${activeSection === "profile" ? "animate-enter-soft" : "hidden"} rounded-lg border border-slate-200 bg-white p-4 shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <UserRound size={26} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Profile</p>
              <h3 className="text-xl font-semibold">{settings.displayName || "Brian"}</h3>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="Weight" value={`${settings.weightKg || 0} kg`} />
            <MiniMetric label="BMR" value={`${displayBmr || 0}`} />
            <MiniMetric label="Protein" value={`${settings.proteinTargetPerKg || 0} g/kg`} />
            <MiniMetric label="Fat" value={`${settings.fatTargetPerKg || 0} g/kg`} />
          </div>
          <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
            These values feed the dynamic TDEE and macro targets used by Dashboard and Stats.
          </div>
        </aside>

        <div className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold">{activeSection === "profile" ? "Profile" : activeSection === "energy" ? "Energy model" : "Nutrition targets"}</h3><p className="mt-1 text-sm text-slate-500">Update only the values in this section.</p></div>
            {isDirty ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Unsaved</span> : null}
          </div>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading settings...</p>
          ) : (
            <div className="mt-4 grid gap-5">
              <div className={`${activeSection === "profile" ? "grid" : "hidden"} gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
                <TextField label="Display name" value={settings.displayName} onChange={(value) => updateField("displayName", value)} />
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  <span className="flex h-10 flex-col justify-end">Sex</span>
                  <select className="rounded-md border border-slate-300 px-3 py-2 font-normal" value={settings.sex} onChange={(event) => updateField("sex", event.target.value)}>
                    <option value="">Optional</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                <NumberField label="Age" value={settings.age} onChange={(value) => updateField("age", value)} />
                <NumberField label="Height (cm)" value={settings.heightCm} onChange={(value) => updateField("heightCm", value)} />
              </div>

              <div className={activeSection === "energy" ? "block" : "hidden"}>
                <div className="mb-3 inline-grid rounded-lg border border-slate-200 bg-slate-50 p-1 sm:grid-cols-2">
                  {(["auto", "manual"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${settings.bmrMode === mode ? "bg-ink text-white" : "text-slate-600"}`}
                      type="button"
                      onClick={() => updateField("bmrMode", mode)}
                    >
                      {mode} BMR
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField label="Weight (kg)" step="0.1" value={settings.weightKg} onChange={(value) => updateField("weightKg", value)} />
                  <NumberField
                    disabled={settings.bmrMode === "auto"}
                    helperText={
                      settings.bmrMode === "auto"
                        ? canAutoCalculateBmr
                          ? "Calculated from weight, height, age, and sex."
                          : "Fill weight, height, age, and sex."
                        : "Manual value."
                    }
                    label="BMR"
                    step="0.1"
                    value={settings.bmrMode === "auto" ? calculatedBmr : settings.bmr}
                    onChange={(value) => updateField("bmr", value)}
                  />
                  <NumberField label="Activity factor" step="0.01" value={settings.baseActivityFactor} onChange={(value) => updateField("baseActivityFactor", value)} />
                  <NumberField label="Calories / step" step="0.001" value={settings.caloriesPerStep} onChange={(value) => updateField("caloriesPerStep", value)} />
                  <NumberField label="Exercise step goal" value={settings.exerciseStepGoal} onChange={(value) => updateField("exerciseStepGoal", value)} />
                  <NumberField label="Strength kcal" value={settings.strengthTrainingKcal} onChange={(value) => updateField("strengthTrainingKcal", value)} />
                  <NumberField label="Basketball kcal / min" value={settings.basketballKcalPerMinute} onChange={(value) => updateField("basketballKcalPerMinute", value)} />
                </div>
              </div>

              <div className={activeSection === "targets" ? "block" : "hidden"}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField label="Protein g / kg" step="0.1" value={settings.proteinTargetPerKg} onChange={(value) => updateField("proteinTargetPerKg", value)} />
                  <NumberField label="Fat g / kg" step="0.1" value={settings.fatTargetPerKg} onChange={(value) => updateField("fatTargetPerKg", value)} />
                  <NumberField label="Cut kcal" value={settings.cutAdjustmentKcal} onChange={(value) => updateField("cutAdjustmentKcal", value)} />
                  <NumberField label="Maintain kcal" value={settings.maintainAdjustmentKcal} onChange={(value) => updateField("maintainAdjustmentKcal", value)} />
                  <NumberField label="Bulk kcal" value={settings.bulkAdjustmentKcal} onChange={(value) => updateField("bulkAdjustmentKcal", value)} />
                </div>
              </div>
            </div>
          )}

          {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}

          <div className="sticky bottom-0 -mx-4 mt-5 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 pb-1 pt-3 backdrop-blur">
            <p className="text-xs font-medium text-slate-500">{isDirty ? "Changes are not saved yet." : "Everything is up to date."}</p>
            <button className="shrink-0 rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={isLoading || isSaving || !isDirty} type="button" onClick={saveSettings}>
              <span className="inline-flex items-center gap-2">
                <Save size={16} />
                {isSaving ? "Saving..." : "Save settings"}
              </span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

function TravelDayManager({ onChanged }: { onChanged: () => Promise<void> }) {
  const today = dateKey();
  const [mode, setMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [markAsTravel, setMarkAsTravel] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dates = mode === "single" ? (singleDate ? [singleDate] : []) : dateRangeKeys(startDate, endDate);
  const canApply = dates.length > 0 && !isApplying;

  async function loadStatus(date: string): Promise<DailyStatus> {
    const response = await fetch(`/api/daily_status?date=${encodeURIComponent(date)}`);

    if (!response.ok) {
      throw new Error(`Failed to load status for ${date}.`);
    }

    return ((await response.json()) as DailyStatus | null) ?? createEmptyStatus(date);
  }

  async function saveTravelStatus(date: string) {
    const existingStatus = await loadStatus(date);
    const response = await fetch("/api/daily_status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...existingStatus,
        date,
        isTravelDay: markAsTravel
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update travel day for ${date}.`);
    }
  }

  async function applyTravelDays() {
    if (!canApply) {
      return;
    }

    setIsApplying(true);
    setError(null);
    setMessage("");

    try {
      for (const date of dates) {
        await saveTravelStatus(date);
      }

      await onChanged();
      setMessage(`${markAsTravel ? "Marked" : "Cleared"} ${dates.length} day${dates.length === 1 ? "" : "s"}.`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to update travel days.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800">
            <Plane size={16} />
            Travel days
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Mark past or future dates so AI ignores them for adherence analysis.</p>
        </div>
        <div className="inline-grid rounded-lg border border-sky-100 bg-white p-1 sm:grid-cols-2">
          {(["single", "range"] as const).map((option) => (
            <button
              key={option}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${mode === option ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-sky-50"}`}
              type="button"
              onClick={() => setMode(option)}
            >
              {option === "single" ? "One day" : "Range"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-end">
        {mode === "single" ? (
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date
            <input
              className="rounded-md border border-sky-100 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
              type="date"
              value={singleDate}
              onChange={(event) => setSingleDate(event.target.value)}
            />
          </label>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start
              <input
                className="rounded-md border border-sky-100 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              End
              <input
                className="rounded-md border border-sky-100 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
              markAsTravel ? "bg-sky-600 text-white shadow-sm" : "border border-sky-100 bg-white text-slate-600 hover:bg-sky-50"
            }`}
            type="button"
            onClick={() => setMarkAsTravel(true)}
          >
            <Plane size={15} />
            Mark
          </button>
          <button
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
              !markAsTravel ? "bg-ink text-white shadow-sm" : "border border-sky-100 bg-white text-slate-600 hover:bg-sky-50"
            }`}
            type="button"
            onClick={() => setMarkAsTravel(false)}
          >
            Clear
          </button>
        </div>
      </div>

      {mode === "range" && startDate && endDate && startDate > endDate ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Start date must be before end date.</p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <CalendarDays size={14} />
          {dates.length ? `${dates.length} day${dates.length === 1 ? "" : "s"} selected` : "Select a valid date"}
        </p>
        <button
          className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          disabled={!canApply}
          type="button"
          onClick={() => void applyTravelDays()}
        >
          {isApplying ? "Applying..." : markAsTravel ? "Apply travel day" : "Clear travel day"}
        </button>
      </div>

      {message ? <p className="mt-2 rounded-md bg-white/80 px-3 py-2 text-xs font-semibold text-sky-700">{message}</p> : null}
      {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span className="flex h-10 flex-col justify-end">{label}</span>
      <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  disabled = false,
  helperText,
  label,
  value,
  step = "1",
  onChange
}: {
  disabled?: boolean;
  helperText?: string;
  label: string;
  value: number;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span className="flex h-10 flex-col justify-end">
        <span>{label}</span>
        {helperText ? <span className="text-xs font-normal text-slate-500">{helperText}</span> : null}
      </span>
      <input
        className="rounded-md border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-50 disabled:text-slate-500"
        disabled={disabled}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
