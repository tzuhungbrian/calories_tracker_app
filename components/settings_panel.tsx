"use client";

import { Download, Save, Settings, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { UserProfileSettings } from "@/lib/types";

type SettingsPanelProps = {
  onChanged: () => Promise<void>;
};

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

export function SettingsPanel({ onChanged }: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserProfileSettings>(emptySettings);
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

      setSettings((await response.json()) as UserProfileSettings);
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
  const canExport = exportMode === "all" || Boolean(exportStartDate && exportEndDate && exportStartDate <= exportEndDate);
  const exportHref =
    exportMode === "range" && canExport
      ? `/api/export?start=${encodeURIComponent(exportStartDate)}&end=${encodeURIComponent(exportEndDate)}`
      : "/api/export";

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Settings size={20} />
            Settings
          </h2>
          <p className="mt-1 text-sm text-slate-500">Manage your profile, calorie model, and data exports.</p>
        </div>
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 xl:max-w-xl">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="animate-enter-soft rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
          <h3 className="text-lg font-semibold">Personal settings</h3>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading settings...</p>
          ) : (
            <div className="mt-4 grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">Energy model</p>
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

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">Targets</p>
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

          <div className="mt-5">
            <button className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isLoading || isSaving} type="button" onClick={saveSettings}>
              <span className="inline-flex items-center gap-2">
                <Save size={16} />
                {isSaving ? "Saving..." : "Save settings"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
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
