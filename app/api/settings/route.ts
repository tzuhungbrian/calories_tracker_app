import { NextResponse } from "next/server";
import { readSheetObjects, sheetTabs, upsertSettings } from "@/lib/google_sheets";
import { profileSettingsToKeyValues, rowsToProfileSettings } from "@/lib/nutrition";
import type { UserProfileSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

const settingNotes: Record<string, string> = {
  display_name: "Display name used in the app.",
  height_cm: "Height in centimeters.",
  age: "Age used for personal reference.",
  sex: "Sex used for personal reference.",
  weight_kg: "Current body weight used for target calculations.",
  bmr: "Base metabolic rate.",
  base_activity_factor: "Multiplier for non-step daily activity.",
  calories_per_step: "Estimated calories burned per step.",
  strength_training_kcal: "Calories added when strength_session is true.",
  basketball_kcal_per_minute: "Calories added per basketball minute.",
  protein_target_per_kg: "Protein target in grams per kg.",
  fat_target_per_kg: "Fat target in grams per kg.",
  cut_adjustment_kcal: "Calories added to TDEE for cut days.",
  maintain_adjustment_kcal: "Calories added to TDEE for maintain days.",
  bulk_adjustment_kcal: "Calories added to TDEE for bulk days."
};

export async function GET() {
  const rows = await readSheetObjects(sheetTabs.settings);
  return NextResponse.json(rowsToProfileSettings(rows));
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as UserProfileSettings;
  const values = profileSettingsToKeyValues(payload);

  await upsertSettings(values, settingNotes);

  const rows = await readSheetObjects(sheetTabs.settings);
  return NextResponse.json(rowsToProfileSettings(rows));
}
