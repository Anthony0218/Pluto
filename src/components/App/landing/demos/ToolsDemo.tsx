import { lazy, Suspense } from "react";
import { landingTools } from "../../planetary/universeCatalog";
import { ui, useUiLanguage } from "@/i18n/ui";
import "@/components/learning/learningTools.css";
import DemoFrame from "./DemoFrame";

// The real tools, loaded only when their section is near the viewport.
const apps = {
  calculator: lazy(() => import("@/components/tools/Calculator")),
  "percentage-calculator": lazy(() => import("@/components/tools/PercentageWorkbench")),
  "unit-converter": lazy(() => import("@/components/tools/UnitConverter")),
  "number-system-converter": lazy(() => import("@/components/tools/NumberSystemConverter")),
  "workout-timer": lazy(() => import("@/components/tools/WorkoutTimer")),
  "bill-splitter": lazy(() => import("@/components/tools/BillSplitter")),
  "time-zone-planner": lazy(() => import("@/components/tools/TimeZonePlanner")),
  "budget-tracker": lazy(() => import("@/components/tools/BudgetTracker")),
  "calorie-tracker": lazy(() => import("@/components/tools/CalorieTracker")),
  "day-planner": lazy(() => import("@/components/tools/DayPlanner")),
  "qr-code-creator": lazy(() => import("@/components/tools/QrCodeCreator")),
  "birthday-reminders": lazy(() => import("@/components/tools/BirthdayReminder")),
  notes: lazy(() => import("@/components/tools/NotesApp")),
} as const;

/** One featured tool, working for real, inside the landing page. */
export default function ToolsDemo({ toolId }: { toolId: string }) {
  useUiLanguage();
  const App = apps[toolId as keyof typeof apps];
  const tool = landingTools.find(item => item.id === toolId);
  if (!App || !tool) return null;
  return <DemoFrame tone="tools" title={ui(tool.title)}>
    <Suspense fallback={<div className="demo-skeleton" style={{ minHeight: 280 }} aria-hidden="true" />}><div className="tools-demo"><App /></div></Suspense>
  </DemoFrame>;
}
