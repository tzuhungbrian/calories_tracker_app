# Calories Tracker App

Personal nutrition tracker for Brian. The app uses Next.js, TypeScript, Tailwind CSS, and Google Sheets as the backend database.

## MVP features

- Dashboard for today's calories, protein, fat, carbs, targets, and remaining values
- Add daily food log records
- Common foods selector powered by Google Sheets
- Daily status editor for goal type, steps, strength session, creatine, and basketball minutes
- Recent 14 days summary table

## Google Sheets setup

1. Open the existing spreadsheet named `diet_tracker_dynamic_tdee`.
2. Copy the spreadsheet ID from the URL.
3. Create a Google Cloud service account.
4. Enable the Google Sheets API for the Google Cloud project.
5. Create a JSON key for the service account.
6. Share the spreadsheet with the service account email as an editor.
7. Fill in `.env.local`.

```bash
GOOGLE_SHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Expected sheet tabs

The app is configured for the existing `diet_tracker_dynamic_tdee` tabs by default:

- `Daily_Log`
- `Daily_Status`
- `Common_Foods`
- `Summary_Data`
- `Settings`

You can change tab names in `.env.local`:

```bash
GOOGLE_SHEET_DAILY_LOG_TAB=Daily_Log
GOOGLE_SHEET_DAILY_STATUS_TAB=Daily_Status
GOOGLE_SHEET_COMMON_FOODS_TAB=Common_Foods
GOOGLE_SHEET_SUMMARY_DATA_TAB=Summary_Data
GOOGLE_SHEET_SETTINGS_TAB=Settings
```

## Suggested columns

`Daily_Log`:

```text
Date, Meal, Entry Type, Food / Item, Servings, Manual kcal, Manual P, Manual F, Manual C, Final kcal, Final P, Final F, Final C, Notes
```

`Daily_Status`:

```text
Date, Goal Type, Steps, Strength session, Creatine Taken, Basketball minutes, Dynamic TDEE, Calorie target, Protein goal, Fat goal, Carb goal
```

`Common_Foods`:

```text
Food name, Category, Serving label, Serving size, Calories / serving, Protein (g), Fat (g), Carbs (g), Notes
```

The parser automatically skips intro rows and uses the header row, so the existing explanatory rows at the top of each tab can stay in place.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Verification

Run these before finishing a task:

```bash
npm run lint
npm run build
```

## Security notes

- Google credentials are only read in server-side route handlers.
- No Google credentials use `NEXT_PUBLIC_`.
- Browser code calls only internal `/api/*` endpoints.
