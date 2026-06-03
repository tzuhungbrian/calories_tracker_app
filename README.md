# Calories Tracker App

Personal nutrition tracker for Brian. The app uses Next.js, TypeScript, Tailwind CSS, and Google Sheets as the backend database.

## Features

- Dashboard for calorie balance, macro targets, habits, and recent insights
- Today flow for food logging, daily status, and AI-friendly diet export
- Food database manager backed by Google Sheets
- Meal prep calculator
- Settings for profile and nutrition target inputs

## Architecture

- Browser code renders the app and calls internal `/api/*` endpoints.
- Google Sheets access is isolated to server-side Next.js route handlers through `lib/google_sheets.ts`.
- Google credentials are read only from server environment variables.
- Basic Auth is enforced by `middleware.ts` for pages and API routes.
- Static Next.js assets are excluded from Basic Auth so the app can load correctly.

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

3. Replace the placeholder values in `.env.local` locally. Do not commit real values.

4. Start the app.

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Required Environment Variables

Set these in `.env.local` for local development and in Vercel Project Settings for deployment. See `.env.example` for safe placeholder examples.

```bash
APP_USERNAME=
APP_PASSWORD=

GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

GOOGLE_SHEET_DAILY_LOG_TAB=
GOOGLE_SHEET_DAILY_STATUS_TAB=
GOOGLE_SHEET_COMMON_FOODS_TAB=
GOOGLE_SHEET_MEAL_PREPS_TAB=
GOOGLE_SHEET_MEAL_PREP_ITEMS_TAB=
GOOGLE_SHEET_SETTINGS_TAB=
```

Default tab names used by the app:

```text
GOOGLE_SHEET_DAILY_LOG_TAB=food_logs
GOOGLE_SHEET_DAILY_STATUS_TAB=daily_status
GOOGLE_SHEET_COMMON_FOODS_TAB=foods
GOOGLE_SHEET_MEAL_PREPS_TAB=meal_preps
GOOGLE_SHEET_MEAL_PREP_ITEMS_TAB=meal_prep_items
GOOGLE_SHEET_SETTINGS_TAB=settings
```

`GOOGLE_PRIVATE_KEY` supports both escaped newline and real multiline formats:

```text
-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

or:

```text
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

Do not prefix Google credentials with `NEXT_PUBLIC_`.

## Google Sheets Setup

1. Open the existing spreadsheet named `diet_tracker_dynamic_tdee`.
2. Copy the spreadsheet ID from the URL.
3. Create a Google Cloud service account.
4. Enable the Google Sheets API for the Google Cloud project.
5. Create a JSON key for the service account.
6. Share the spreadsheet with the service account email as an editor.
7. Put the required values into local `.env.local` or Vercel environment variables.

## Expected Sheet Tabs

The app currently expects these app database tabs:

- `foods`
- `food_logs`
- `daily_status`
- `meal_preps`
- `meal_prep_items`
- `settings`

Do not change the spreadsheet layout for deployment. This deployment prep does not modify the spreadsheet structure.

## Vercel Deployment

1. Push the repository to GitHub.
2. In Vercel, create a new project from the GitHub repository.
3. Use the default Next.js framework preset.
4. Add all required environment variables in Vercel Project Settings.
5. Keep the build command as:

```bash
npm run build
```

6. Keep the install command as the Vercel default or:

```bash
npm install
```

7. Deploy.
8. Open the deployed URL and sign in with the configured Basic Auth username and password.

## Basic Auth

`middleware.ts` protects both pages and API routes using:

```text
APP_USERNAME
APP_PASSWORD
```

If either variable is missing, protected requests return `500` so the deployment does not accidentally become public.

The middleware does not protect static Next.js assets such as `/_next/static/*`, `/_next/image/*`, `favicon.ico`, or common public asset file extensions.

## Verification

Run these before finishing a task:

```bash
npm run lint
npm run build
```

## Security Notes

- Do not commit `.env`, `.env.local`, or real Google JSON key files.
- `.env.example` contains placeholder examples only, never real credentials.
- Google Sheets credentials are used only by server-side code.
- Browser code calls only internal API endpoints.
- No Google credentials use `NEXT_PUBLIC_`.
