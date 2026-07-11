import { notFound } from "next/navigation";
import { TrackerApp, type AppTab } from "@/components/tracker_app";

const viewTabs: Record<string, AppTab> = {
  dashboard: "stats",
  today: "dashboard",
  logs: "logs",
  foods: "foods",
  "meal-prep": "prep",
  settings: "settings"
};

export default function TrackerViewPage({ params }: { params: { view: string } }) {
  const initialTab = viewTabs[params.view];

  if (!initialTab) {
    notFound();
  }

  return <TrackerApp initialTab={initialTab} />;
}
