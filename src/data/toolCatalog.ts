export const toolCategories = ["Calculators & conversions", "Food & fitness", "Money & shared expenses", "Planning & time", "Explore"] as const;
export type ToolCategory = typeof toolCategories[number];
export type ToolApp = {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  accent: string;
  features: string[];
  relatedPath?: { subjectId: string; id: string };
  status: "planned" | "available";
};

export const toolApps: ToolApp[] = [
  { id: "percentage-calculator", title: "Percentage Calculator", description: "Work out discounts, changes, VAT, and reverse percentages.", category: "Calculators & conversions", accent: "#a5b4fc", features: ["Percentage amounts and changes", "Reverse percentages", "Discounts, VAT, and percentage points", "Step-by-step explanations"], relatedPath: { subjectId: "math", id: "percentages" }, status: "available" },
  { id: "number-system-converter", title: "Number-System Converter", description: "Convert between binary, decimal, hexadecimal, and octal.", category: "Calculators & conversions", accent: "#7dd3fc", features: ["Binary, decimal, hexadecimal, and octal", "Clickable bits", "Place-value explanations"], status: "available" },
  { id: "unit-converter", title: "Unit Converter", description: "Convert everyday measurements with clear units.", category: "Calculators & conversions", accent: "#67e8f9", features: ["Length, mass, temperature, and speed", "Area, volume, and data sizes", "Clear precision and rounding"], relatedPath: { subjectId: "math", id: "foundations" }, status: "available" },
  { id: "recipe-scaler", title: "Recipe Scaler", description: "Adjust ingredient quantities to the servings you need.", category: "Food & fitness", accent: "#fdba74", features: ["Adjust servings", "Scale ingredient quantities", "Save reusable recipes"], relatedPath: { subjectId: "math", id: "percentages" }, status: "available" },
  { id: "workout-timer", title: "Workout Timer", description: "Plan work and rest intervals for your workout.", category: "Food & fitness", accent: "#6ee7b7", features: ["Work and rest intervals", "Rounds and sound cues", "Saved workout routines"], status: "planned" },
  { id: "bill-splitter", title: "Bill Splitter", description: "Split bills and keep track of shared expenses.", category: "Money & shared expenses", accent: "#fcd34d", features: ["Equal and custom shares", "Tips and rounding", "Groups, balances, and recorded repayments"], relatedPath: { subjectId: "math", id: "percentages" }, status: "planned" },
  { id: "time-zone-planner", title: "Time-Zone Planner", description: "Compare local times and find a time that works together.", category: "Planning & time", accent: "#c4b5fd", features: ["Compare locations", "Overlapping availability", "Dates and daylight-saving changes"], status: "planned" },
  { id: "function-plotter", title: "Function Plotter", description: "Explore functions, slopes, and areas on a graph.", category: "Calculators & conversions", accent: "#f0abfc", features: ["Plot and compare functions", "Zoom and inspect graphs", "Slope and area visualizations"], relatedPath: { subjectId: "math", id: "algebra-functions" }, status: "planned" },
  { id: "budget-tracker", title: "Budget Tracker", description: "See your spending and plan your monthly budget.", category: "Money & shared expenses", accent: "#86efac", features: ["Manual income and expenses", "Categories and monthly totals", "Recurring costs and export"], status: "planned" },
  { id: "subscription-tracker", title: "Subscription Tracker", description: "Keep recurring subscriptions and renewal dates in view.", category: "Money & shared expenses", accent: "#f9a8d4", features: ["Recurring subscriptions", "Renewal dates", "Monthly and yearly cost overview"], status: "planned" },
  { id: "calorie-tracker", title: "Calorie Tracker", description: "Log foods, portions, and reusable meals.", category: "Food & fitness", accent: "#fca5a5", features: ["Manual food and portion entries", "Reusable meals", "Daily history and export"], status: "planned" },
  { id: "weather-explorer", title: "Weather Explorer", description: "Choose a place on a map and explore its forecast.", category: "Explore", accent: "#7dd3fc", features: ["Click a map location", "Hourly forecasts", "Favorite places and comparisons"], status: "planned" },
  { id: "day-planner", title: "Day Planner", description: "Give tasks a time and duration, and make room for breaks.", category: "Planning & time", accent: "#a5b4fc", features: ["Tasks, start times, and durations", "Daily timeline and scheduling conflicts", "Optional reminders"], status: "planned" },
];

export const toolRoute = (id: string) => `/tools/${id}`;
