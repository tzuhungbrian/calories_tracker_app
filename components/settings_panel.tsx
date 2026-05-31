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
  weightKg: 0,
  bmr: 0,
  baseActivityFactor: 1.2,
  caloriesPerStep: 0.04,
  strengthTrainingKcal: 250,
  basketballKcalPerMinute: 8,
  proteinTargetPerKg: 2,
  fatTargetPerKg: 0.9,
  cutAdjustmentKcal: -300,
  maintainAdjustmentKcal: 0,
  bulkAdjustmentKcal: 250
};

const numericFields: Array<keyof Omit<UserProfileSettings, "displayName" | "sex">> = [
  "heightCm",
  "age",
  "weightKg",
  "bmr",
  "baseActivityFactor",
  "caloriesPerStep",
  "strengthTrainingKcal",
  "basketballKcalPerMinute",
  "proteinTargetPerKg",
  "fatTargetPerKg",
  "cutAdjustmentKcal",
  "maintainAdjustmentKcal",
  "bulkAdjustmentKcal"
];

export function SettingsPanel({ onChanged }: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserProfileSettings>(emptySettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
        body: JSON.stringify(settings)
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

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Settings size={20} />
            Settings
          </h2>
          <p className="mt-1 text-sm text-slate-500">Manage your profile, calorie model, and data exports.</p>
        </div>
        <a
          className="inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          href="/api/export"
        >
          <Download size={16} />
          Export all data
        </a>
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
            <MiniMetric label="BMR" value={`${settings.bmr || 0}`} />
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
                <TextField label="Sex" value={settings.sex} placeholder="Optional" onChange={(value) => updateField("sex", value)} />
                <NumberField label="Age" value={settings.age} onChange={(value) => updateField("age", value)} />
                <NumberField label="Height (cm)" value={settings.heightCm} onChange={(value) => updateField("heightCm", value)} />
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">Energy model</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField label="Weight (kg)" step="0.1" value={settings.weightKg} onChange={(value) => updateField("weightKg", value)} />
                  <NumberField label="BMR" step="0.1" value={settings.bmr} onChange={(value) => updateField("bmr", value)} />
                  <NumberField label="Activity factor" step="0.01" value={settings.baseActivityFactor} onChange={(value) => updateField("baseActivityFactor", value)} />
                  <NumberField label="Calories / step" step="0.001" value={settings.caloriesPerStep} onChange={(value) => updateField("caloriesPerStep", value)} />
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
      {label}
      <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, step = "1", onChange }: { label: string; value: number; step?: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <input className="rounded-md border border-slate-300 px-3 py-2 font-normal" step={step} type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
