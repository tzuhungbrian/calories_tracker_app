import { notFound } from "next/navigation";
import { TrackerApp, type AppTab } from "@/components/tracker_app";
import { isDateKey } from "@/lib/date";

const viewTabs: Record<string, AppTab> = {
  dashboard: "stats",
  today: "dashboard",
  logs: "logs",
  foods: "foods",
  "meal-prep": "prep",
  settings: "settings"
};

type TrackerViewPageProps = {
  params: { view: string };
  searchParams?: { date?: string | string[] };
};

export default function TrackerViewPage({ params, searchParams }: TrackerViewPageProps) {
  const initialTab = viewTabs[params.view];
  const requestedDate = typeof searchParams?.date === "string" && isDateKey(searchParams.date) ? searchParams.date : "";

  if (!initialTab) {
    notFound();
  }

  return <TrackerApp initialTab={initialTab} initialLogDate={requestedDate} />;
}
