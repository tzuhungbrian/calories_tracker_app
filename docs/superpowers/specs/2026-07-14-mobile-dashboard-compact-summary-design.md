# Mobile Dashboard Compact Summary Design

## Goal

Reduce text crowding in the mobile Dashboard summary while preserving the existing nutrition signals and desktop layout.

## Selected Direction

Use the approved Compact Cards layout on mobile:

- Keep the familiar 2-by-2 grid for Calories, Protein, Fat, and Carbs.
- Give each card three levels only: metric name with short status, primary value, and one supporting line.
- Remove the icon block and repeated target text from mobile cards.
- Add a thin progress indicator instead of another text row.
- Render TDEE as one full-width compact row below the macro cards.
- Keep goal mode and TDEE balance as compact context chips; hide the separate calorie target chip on mobile because the card already communicates progress.

Desktop keeps the current five-column summary and full detail.

## Mobile Content Rules

- Calories: total, short status, and calories left or over.
- Protein: total, short status, and grams to goal or target met.
- Fat: total, short status, and recommended range.
- Carbs: total, short status, and grams left or over.
- TDEE: label, `Dynamic today`, and the current kcal value.
- Travel days keep the existing neutral status behavior.

The Analysis Window heading becomes `Recent history` on mobile and its explanatory sentence is hidden. The 7D, 14D, and 30D control remains unchanged.

## Interaction And Accessibility

- Existing calculations, status colors, data flow, and Google Sheets schema remain unchanged.
- Cards must not horizontally overflow at 375px, 390px, or 430px widths.
- Status is always communicated by text as well as color.
- Existing motion and reduced-motion behavior remain intact.

## Validation

- Add a mobile Playwright assertion for the compact summary and TDEE row.
- Verify 375x812, 390x844, and 430x932 in light and dark mode.
- Run typecheck, lint, full Playwright suite, and production build.
