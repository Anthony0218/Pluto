import { Activity, Binary, BookOpen, Calculator, CalendarDays, ChartNoAxesCombined, CircleDollarSign, Dumbbell, Gift, Globe2, Grid2X2, Music2, NotebookPen, Percent, QrCode, Ruler, Sigma, Users, Volleyball, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  math: Sigma, music: Music2, football: Volleyball, "game-guides": BookOpen, "game-analysis": ChartNoAxesCombined, "signal-processing": Activity,
  calculator: Calculator, "percentage-calculator": Percent, "number-system-converter": Binary, "unit-converter": Ruler,
  "workout-timer": Dumbbell, "bill-splitter": Users, "time-zone-planner": Globe2,
  "budget-tracker": CircleDollarSign,
  "calorie-tracker": Activity, notes: NotebookPen, "day-planner": CalendarDays, tools: Grid2X2,
  "qr-code-creator": QrCode, "birthday-reminders": Gift,
};

export default function CatalogIcon({ id, size = 24 }: { id: string; size?: number }) {
  const Icon = icons[id] ?? BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}
