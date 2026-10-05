import { Activity, Binary, BookOpen, Calculator, CalendarDays, ChartNoAxesCombined, CircleDollarSign, CloudSun, CookingPot, CreditCard, Dumbbell, Globe2, Grid2X2, Music2, Ruler, Sigma, Users, Volleyball, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  math: Sigma, music: Music2, football: Volleyball, "game-guides": BookOpen, "game-analysis": ChartNoAxesCombined, "signal-processing": Activity,
  "percentage-calculator": Calculator, "number-system-converter": Binary, "unit-converter": Ruler,
  "recipe-scaler": CookingPot, "workout-timer": Dumbbell, "bill-splitter": Users, "time-zone-planner": Globe2,
  "function-plotter": ChartNoAxesCombined, "budget-tracker": CircleDollarSign, "subscription-tracker": CreditCard,
  "calorie-tracker": Activity, "weather-explorer": CloudSun, "day-planner": CalendarDays, tools: Grid2X2,
};

export default function CatalogIcon({ id, size = 24 }: { id: string; size?: number }) {
  const Icon = icons[id] ?? BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}
