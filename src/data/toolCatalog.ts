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
  { id: "calculator", title: "Calculator", description: "Add, subtract, multiply, and divide on a classic keypad.", category: "Calculators & conversions", accent: "#93c5fd", features: ["Basic arithmetic with operator precedence", "Percent, sign change, and backspace keys", "Works with the keyboard"], status: "available" },
  { id: "percentage-calculator", title: "Percentage Calculator", description: "Work out discounts, changes, VAT, and reverse percentages.", category: "Calculators & conversions", accent: "#a5b4fc", features: ["Percentage amounts and changes", "Reverse percentages", "Discounts, VAT, and percentage points", "Step-by-step explanations"], relatedPath: { subjectId: "math", id: "percentages" }, status: "available" },
  { id: "birthday-reminders", title: "Birthday Reminders", description: "Save people and birthdays, and get a reminder each year.", category: "Planning & time", accent: "#f9a8d4", features: ["People and birthdays", "Upcoming birthdays and optional ages", "Yearly reminders"], status: "available" },
  { id: "qr-code-creator", title: "QR Code Creator", description: "Turn a link or text into a QR code you can download.", category: "Explore", accent: "#67e8f9", features: ["Links and text", "PNG and SVG downloads", "Created locally in your browser"], status: "available" },
  { id: "todo-list", title: "ToDo List", description: "Manage tasks, keep their history, and connect shopping lists with recipes and shared bills.", category: "Planning & time", accent: "#b8ec67", features: ["Tasks, completed items, and revision history", "Named shopping lists with recipe ingredients", "Connected Bill Splitter expenses and keyboard controls"], status: "available" },
  { id: "number-system-converter", title: "Number-System Converter", description: "Convert between binary, decimal, hexadecimal, and octal.", category: "Calculators & conversions", accent: "#7dd3fc", features: ["Binary, decimal, hexadecimal, and octal", "Clickable bits", "Place-value explanations"], status: "available" },
  { id: "unit-converter", title: "Unit Converter", description: "Convert everyday measurements with clear units.", category: "Calculators & conversions", accent: "#67e8f9", features: ["Length, mass, temperature, and speed", "Area, volume, and data sizes", "Clear precision and rounding"], relatedPath: { subjectId: "math", id: "foundations" }, status: "available" },
  { id: "workout-timer", title: "Workout routines", description: "Create a reusable routine for your next workout.", category: "Food & fitness", accent: "#6ee7b7", features: ["Work and rest intervals", "Rounds and sound cues", "Saved workout routines"], status: "available" },
  { id: "bill-splitter", title: "Bill Splitter", description: "Split bills and keep track of shared expenses.", category: "Money & shared expenses", accent: "#fcd34d", features: ["Equal and custom shares", "Tips and rounding", "Groups, balances, and recorded repayments"], relatedPath: { subjectId: "math", id: "percentages" }, status: "available" },
  { id: "time-zone-planner", title: "Time-Zone Planner", description: "Click a location on the map to see its local time.", category: "Planning & time", accent: "#c4b5fd", features: ["Compare locations", "Saved time zones", "Dates and daylight-saving changes"], status: "available" },
  { id: "budget-tracker", title: "Budget Tracker", description: "See your spending and plan your monthly budget.", category: "Money & shared expenses", accent: "#86efac", features: ["Manual income and expenses", "Categories and monthly totals", "Recurring costs and export"], status: "available" },
  { id: "calorie-tracker", title: "Calorie Tracker", description: "Track calories and nutrients with a food database, recipe book, and clear daily insights.", category: "Food & fitness", accent: "#b8ec67", features: ["Food database, custom foods, and label capture", "Calories, macros, goals, and weekly insight", "Reusable recipes with friend sharing"], status: "available" },
  { id: "day-planner", title: "Day Planner", description: "Give tasks a time and duration, and make room for breaks.", category: "Planning & time", accent: "#a5b4fc", features: ["Tasks, start times, and durations", "Daily timeline and scheduling conflicts", "Optional reminders"], status: "available" },
  { id: "notes", title: "Notes", description: "Write notes and tables, and style them your way.", category: "Planning & time", accent: "#fde68a", features: ["Text and tables", "Your own fonts and colours", "Save results from the calculators"], status: "available" },
];

export const toolRoute = (id: string) => `/tools/${id}`;
