import { expect, test, type Page } from "@playwright/test";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());

function moveMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
}
const foods = [
  { id: "food-1", name: "Chicken bowl", category: "Meal prep", serving: "1 portion", servingSize: "350 g", calories: 520, protein: 48, fat: 12, carbs: 56, notes: "" },
  { id: "food-2", name: "Greek yogurt", category: "Snacks", serving: "1 cup", servingSize: "200 g", calories: 140, protein: 20, fat: 0, carbs: 14, notes: "" },
  { id: "food-3", name: "Banana", category: "Fruit", serving: "1 fruit", servingSize: "120 g", calories: 105, protein: 1.3, fat: 0.4, carbs: 27, notes: "" }
];

let logs = [
  { id: "log-1", date: today, meal: "Lunch", foodId: "food-1", foodName: "Chicken bowl", amount: "1", calories: 520, protein: 48, fat: 12, carbs: 56, notes: "", createdAt: `${today}T12:00:00.000Z` },
  { id: "log-2", date: today, meal: "Snack", foodId: "food-2", foodName: "Greek yogurt", amount: "1", calories: 140, protein: 20, fat: 0, carbs: 14, notes: "", createdAt: `${today}T15:00:00.000Z` }
];

const status = { id: "status-1", date: today, goalType: "cut", steps: 8200, strengthSession: false, creatineTaken: true, basketballMinutes: 0, isTravelDay: false };
const targets = { calories: 1900, protein: 125, fat: 58, carbs: 230 };
const totals = { calories: 660, protein: 68, fat: 12, carbs: 70 };
const settings = { displayName: "Brian", heightCm: 171, age: 28, sex: "male", bmrMode: "auto", weightKg: 62, bmr: 1529, baseActivityFactor: 1.2, caloriesPerStep: 0.04, exerciseStepGoal: 8000, strengthTrainingKcal: 250, basketballKcalPerMinute: 8, proteinTargetPerKg: 2, fatTargetPerKg: 0.9, cutAdjustmentKcal: -300, maintainAdjustmentKcal: 0, bulkAdjustmentKcal: 250 };

async function mockApi(page: Page) {
  await page.route("**/api/dashboard**", (route) => route.fulfill({ json: { date: today, totals, targets, dynamicTdee: 2200, exerciseStepGoal: 8000, remaining: { calories: 1240, protein: 57, fat: 46, carbs: 160 }, status } }));
  await page.route("**/api/common_foods", (route) => route.fulfill({ json: foods }));
  await page.route("**/api/foods**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: foods });
    const body = route.request().postDataJSON();
    return route.fulfill({ status: route.request().method() === "POST" ? 201 : 200, json: { id: body.id ?? "food-new", ...body } });
  });
  await page.route("**/api/daily_log**", async (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: logs });
    if (method === "DELETE") return route.fulfill({ json: { ok: true } });
    const body = route.request().postDataJSON();
    const saved = { id: body.id ?? `log-${logs.length + 1}`, createdAt: `${today}T18:00:00.000Z`, ...body };
    logs = method === "PUT" ? logs.map((log) => log.id === saved.id ? saved : log) : [saved, ...logs];
    return route.fulfill({ status: method === "POST" ? 201 : 200, json: saved });
  });
  await page.route("**/api/daily_status**", (route) => route.fulfill({ json: route.request().method() === "GET" ? status : { ...status, ...route.request().postDataJSON() } }));
  await page.route("**/api/summary**", (route) => route.fulfill({ json: Array.from({ length: 14 }, (_, index) => ({ date: new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10), calories: 1800 - index * 20, calorieTarget: 1900, dynamicTdee: 2200, protein: 120, proteinGoal: 125, fat: 56, fatGoal: 58, carbs: 215, carbsGoal: 230, goalType: "cut", isTravelDay: false, steps: 8200, strengthSession: index % 2 === 0, creatineTaken: true, basketballMinutes: 0 })) }));
  await page.route("**/api/settings", async (route) => route.fulfill({ json: route.request().method() === "GET" ? settings : { ...settings, ...route.request().postDataJSON() } }));
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("e2e-user");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  logs = logs.slice(0, 2);
  await mockApi(page);
  await login(page);
});

test("URL navigation survives reload and browser history", async ({ page }) => {
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await expect(page).toHaveURL(/\/logs$/);
  await expect(page.getByRole("heading", { name: "Food log manager" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/logs$/);
  await page.getByRole("navigation").getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/logs$/);
});

test("desktop Logs opens and closes the edit inspector", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit logged food" })).toHaveCount(0);
  await page.getByRole("button", { name: "Chicken bowl 1" }).click();
  await expect(page.getByRole("heading", { name: "Edit logged food" })).toBeVisible();
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page.getByRole("heading", { name: "Edit logged food" })).toHaveCount(0);
});

test("Dashboard nutrition summary keeps only essential copy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const summary = page.getByRole("region", { name: "Today's nutrition summary" });
  const mobileCards = summary.getByRole("group", { name: "Mobile nutrition cards" });
  await expect(summary).toBeVisible();
  await expect(page.getByRole("button", { name: "14D", exact: true })).toBeVisible();
  await expect(mobileCards.getByText("Calories", { exact: true })).toBeVisible();
  await expect(mobileCards.getByText("Protein", { exact: true })).toBeVisible();
  await expect(mobileCards.getByText("Fat", { exact: true })).toBeVisible();
  await expect(mobileCards.getByText("Carbs", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent history", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Analysis window", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Choose how much recent history to include.", { exact: true })).toHaveCount(0);
  await expect(summary.getByText(/(?:kcal|g) (?:left|to go)/i)).toHaveCount(0);
  await expect(summary.getByText(/\d+-\d+g range/i)).toHaveCount(0);
  await expect(summary.getByText("Dynamic today", { exact: true })).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("Dashboard calendar opens a daily review and deep-links the Logs date", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reviewLogs = [
    ...logs,
    {
      id: "log-wide",
      date: today,
      meal: "Dinner",
      foodId: "food-wide",
      foodName: "Extra long meal name that must remain inside the mobile review",
      amount: "1 oversized serving",
      calories: 1234,
      protein: 1234.5,
      fat: 1234.5,
      carbs: 1234.5,
      notes: "",
      createdAt: `${today}T19:00:00.000Z`
    }
  ];
  await page.unroute("**/api/daily_log**");
  await page.route("**/api/daily_log**", (route) => route.fulfill({ json: reviewLogs }));
  await page.reload();

  const calendar = page.getByRole("region", { name: "Food log calendar" });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText(/^\d+ items?$/)).toHaveCount(0);
  await calendar.getByRole("button", { name: new RegExp(`${today}.*goal met`, "i") }).click();

  const dialog = page.getByRole("dialog", { name: `Food logs for ${today}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Lunch", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Chicken bowl", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Snack", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Greek yogurt", { exact: true })).toBeVisible();
  const reviewScroller = dialog.locator(".overflow-y-auto");
  await expect(reviewScroller).toBeVisible();
  expect(await reviewScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await dialog.getByRole("button", { name: "Open in Logs" }).click();
  await expect(page).toHaveURL(new RegExp(`/logs\\?date=${today}$`));
  await expect(page.getByLabel("Date")).toHaveValue(today);

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/logs\\?date=${today}$`));
  await expect(page.getByLabel("Date")).toHaveValue(today);
});

test("Dashboard calendar visualizes calorie and protein progress rings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const currentMonth = today.slice(0, 7);
  const statusMonth = Number(today.slice(-2)) >= 11 ? currentMonth : moveMonthKey(currentMonth, -1);
  const dates = Array.from({ length: 11 }, (_, index) => `${statusMonth}-${String(index + 1).padStart(2, "0")}`);
  const calories = [1800, 2100, 2300, 2500, 2200, 2600, 1800, 2000, 500, 500];
  const protein = [99.5, 100, 125, 130, 124.5, 125, 125, 80, 50, 50];
  const calendarLogs = dates.slice(0, 10).map((date, index) => ({
    id: `calendar-log-${index}`,
    date,
    meal: "Dinner",
    foodName: `Calendar meal ${index + 1}`,
    amount: "1",
    calories: calories[index],
    protein: protein[index],
    fat: 60,
    carbs: 200,
    notes: "",
    createdAt: `${date}T12:00:00.000Z`
  }));
  const calendarRows = [
    { date: dates[0], calories: 1800, calorieTarget: 1900, dynamicTdee: 2200, protein: 99.5, proteinGoal: 125, goalType: "cut", isTravelDay: false },
    { date: dates[1], calories: 2100, calorieTarget: 1900, dynamicTdee: 2200, protein: 100, proteinGoal: 125, goalType: "cut", isTravelDay: false },
    { date: dates[2], calories: 2300, calorieTarget: 1900, dynamicTdee: 2200, protein: 125, proteinGoal: 125, goalType: "cut", isTravelDay: false },
    { date: dates[3], calories: 2500, calorieTarget: 1900, dynamicTdee: 2200, protein: 130, proteinGoal: 125, goalType: "cut", isTravelDay: true },
    { date: dates[4], calories: 2200, calorieTarget: 2500, dynamicTdee: 2200, protein: 124.5, proteinGoal: 125, goalType: "bulk", isTravelDay: false },
    { date: dates[5], calories: 2600, calorieTarget: 2500, dynamicTdee: 2200, protein: 125, proteinGoal: 125, goalType: "bulk", isTravelDay: false },
    { date: dates[6], calories: 1800, calorieTarget: 1900, dynamicTdee: 2200, protein: 125, proteinGoal: 125, goalType: "maintain", isTravelDay: false },
    { date: dates[7], calories: 2000, calorieTarget: 1900, dynamicTdee: 2200, protein: 80, proteinGoal: 0, goalType: "maintain", isTravelDay: false },
    { date: dates[8], calories: 500, calorieTarget: 1900, dynamicTdee: 0, protein: 50, proteinGoal: 125, goalType: "cut", isTravelDay: false },
    { date: dates[9], calories: 500, calorieTarget: 0, dynamicTdee: 2200, protein: 50, proteinGoal: 125, goalType: "cut", isTravelDay: false },
    { date: dates[10], calories: 0, calorieTarget: 1900, dynamicTdee: 2200, protein: 0, proteinGoal: 125, goalType: "maintain", isTravelDay: false }
  ].map((row) => ({
    ...row,
    fat: 60,
    fatGoal: 58,
    carbs: 200,
    carbsGoal: 230,
    steps: 8000,
    strengthSession: false,
    creatineTaken: false,
    basketballMinutes: 0
  }));

  await page.unroute("**/api/daily_log**");
  await page.unroute("**/api/summary**");
  await page.route("**/api/daily_log**", (route) => route.fulfill({ json: calendarLogs }));
  await page.route("**/api/summary**", (route) => {
    const requestUrl = route.request().url();
    const includesStatusMonth = requestUrl.includes(`start=${statusMonth}`) || requestUrl.includes("days=30");
    return route.fulfill({ json: includesStatusMonth ? calendarRows : [] });
  });
  await page.reload();

  const calendar = page.getByRole("region", { name: "Food log calendar" });
  await expect(calendar.getByRole("button", { name: "Next month" })).toBeDisabled();
  await expect(calendar.getByText(/Protein: red/i)).toHaveCount(0);
  await expect(calendar.getByText(/Calories: Cut/i)).toHaveCount(0);
  if (statusMonth !== currentMonth) {
    await calendar.getByRole("button", { name: "Previous month" }).click();
  }

  const cutMet = calendar.getByRole("button", { name: new RegExp(`${dates[0]}: Goal met.*Calories 81.8% of TDEE.*Protein 79.6% of goal.*1 logged item`) });
  await expect(cutMet.locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-tone", "green");
  await expect(cutMet.locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-progress", "81.82");
  await expect(cutMet.locator('[data-calendar-ring="protein"]')).toHaveAttribute("data-tone", "red");
  await expect(cutMet.locator('[data-calendar-ring="protein"]')).toHaveAttribute("data-progress", "79.6");

  const cutPartial = calendar.getByRole("button", { name: new RegExp(`${dates[1]}: Partially on track.*Calories 95.5% of TDEE.*Protein 80% of goal`) });
  await expect(cutPartial.locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-tone", "amber");
  await expect(cutPartial.locator('[data-calendar-ring="protein"]')).toHaveAttribute("data-tone", "amber");

  const cutMissed = calendar.getByRole("button", { name: new RegExp(`${dates[2]}: Goal missed.*Calories 104.5% of TDEE.*Protein 100% of goal`) });
  await expect(cutMissed.locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-tone", "red");
  await expect(cutMissed.locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-progress", "100");
  await expect(cutMissed.locator('[data-calendar-ring="protein"]')).toHaveAttribute("data-tone", "green");

  const travel = calendar.getByRole("button", { name: `${dates[3]}: Travel day, 1 logged item` });
  await expect(travel.locator('[data-calendar-ring]')).toHaveCount(0);

  await expect(calendar.getByRole("button", { name: new RegExp(`${dates[4]}: Partially on track.*Calories 100% of TDEE`) }).locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-tone", "amber");
  await expect(calendar.getByRole("button", { name: new RegExp(`${dates[4]}: Partially on track.*Protein 99.6% of goal`) }).locator('[data-calendar-ring="protein"]')).toHaveAttribute("data-tone", "amber");
  await expect(calendar.getByRole("button", { name: new RegExp(`${dates[5]}: Goal met.*Calories 118.2% of TDEE`) }).locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-tone", "green");
  await expect(calendar.getByRole("button", { name: new RegExp(`${dates[6]}: Goal met.*Calories 81.8% of TDEE`) }).locator('[data-calendar-ring="calories"]')).toHaveAttribute("data-tone", "green");

  const unavailableProtein = calendar.getByRole("button", { name: new RegExp(`${dates[7]}: Goal missed.*Protein goal unavailable`) });
  await expect(unavailableProtein.locator('[data-calendar-ring="protein"]')).toHaveCount(0);
  await expect(unavailableProtein.locator('[data-calendar-ring-track="protein"]')).toBeVisible();

  for (const unavailableDate of dates.slice(8, 10)) {
    const unavailableCalories = calendar.getByRole("button", { name: new RegExp(`${unavailableDate}: Logged.*Calories unavailable`) });
    await expect(unavailableCalories.locator('[data-calendar-ring="calories"]')).toHaveCount(0);
    await expect(unavailableCalories.locator('[data-calendar-ring-track="calories"]')).toBeVisible();
  }

  const empty = calendar.getByRole("button", { name: `${dates[10]}: No food logged, 0 logged items` });
  await expect(empty.locator('[data-calendar-ring]')).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  const lightGreenStroke = await cutMet.locator('[data-calendar-ring="calories"]').evaluate((element) => getComputedStyle(element).stroke);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(cutMet.locator('[data-calendar-ring="calories"]')).toBeVisible();
  const darkGreenStroke = await cutMet.locator('[data-calendar-ring="calories"]').evaluate((element) => getComputedStyle(element).stroke);
  expect(darkGreenStroke).not.toBe(lightGreenStroke);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedAnimationSeconds = await cutMet.locator('[data-calendar-ring="calories"]').evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
  expect(reducedAnimationSeconds).toBeLessThanOrEqual(0.00001);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(calendar).toBeVisible();
});

test("desktop Today keeps the review compact and opens AI export from the header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Today", exact: true }).click();

  const review = page.getByRole("region", { name: "Daily review" });
  await expect(review.getByText("Calories", { exact: true })).toBeVisible();
  await expect(review.getByText("Protein", { exact: true })).toBeVisible();
  await expect(review.getByText("Exercise", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Export for AI" }).click();
  const dialog = page.getByRole("dialog", { name: "Export today for AI" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("# AI-friendly nutrition log")).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("mobile Add Food sheet supports keyboard dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add food" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add food" })).toHaveCount(0);
});
