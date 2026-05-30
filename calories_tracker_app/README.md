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

The app is configured for app-first database tabs by default:

- `foods`
- `food_logs`
- `daily_status`
- `meal_preps`
- `meal_prep_items`
- `settings`

You can change tab names in `.env.local`:

```bash
GOOGLE_SHEET_DAILY_LOG_TAB=food_logs
GOOGLE_SHEET_DAILY_STATUS_TAB=daily_status
GOOGLE_SHEET_COMMON_FOODS_TAB=foods
GOOGLE_SHEET_MEAL_PREPS_TAB=meal_preps
GOOGLE_SHEET_MEAL_PREP_ITEMS_TAB=meal_prep_items
GOOGLE_SHEET_SETTINGS_TAB=settings
```

## Suggested columns

`food_logs`:

```text
id, date, meal, food_id, food_name, servings, calories, protein, fat, carbs, notes, created_at, updated_at
```

`daily_status`:

```text
id, date, goal_type, steps, strength_session, creatine_taken, basketball_minutes, body_weight, notes, updated_at
```

`foods`:

```text
id, name, category, serving_label, serving_size, calories, protein, fat, carbs, notes, created_at, updated_at
```

`settings`:

```text
key, value, notes, updated_at
```

The legacy tabs are no longer used by the app. They can remain in the spreadsheet as archived reference data.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Sheet migration

The current app uses app-first database tabs:

```text
foods
food_logs
daily_status
meal_preps
meal_prep_items
settings
```

To rebuild those tabs from the legacy spreadsheet tabs, run:

```bash
npm run migrate:sheet
```

The migration renames the old manual spreadsheet tabs to `legacy_*` names and rewrites the app database tabs.

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
