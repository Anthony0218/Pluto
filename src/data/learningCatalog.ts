import { foundationLessons } from "./mathFoundations.ts";
import { percentageLessons } from "./everydayPercentages.ts";

export type LearningSubject = {
  id: string;
  title: string;
  description: string;
  accent: string;
  later?: boolean;
  resourceLabel?: string;
};

export type LearningPath = {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  topics: string[];
  relatedTools?: string[];
};

export const learningSubjects: LearningSubject[] = [
  { id: "math", title: "Math", description: "Build intuition, solve problems, and learn to check your answers.", accent: "#a5b4fc" },
  { id: "music", title: "Music", description: "Learn to read pitches, rhythms, and musical notation.", accent: "#f0abfc" },
  { id: "football", title: "Football", description: "Understand the rules, player roles, and how teams play.", accent: "#6ee7b7" },
  { id: "game-guides", title: "Game guides", description: "Explore the rules and puzzles for the games you play.", accent: "#fcd34d", resourceLabel: "Rules & puzzles" },
  { id: "game-analysis", title: "Game Analysis", description: "Review your saved chess and Go games, and learn from key moves.", accent: "#93c5fd", resourceLabel: "Review your games" },
  { id: "signal-processing", title: "Signal processing", description: "Explore sound, waves, filters, and radar after the core subjects.", accent: "#7dd3fc", later: true },
];

export const learningPaths: LearningPath[] = [
  { id: "foundations", subjectId: "math", title: "Math foundations", description: "Get comfortable with numbers and the operations behind everyday calculations.", topics: ["Addition and subtraction", "Multiplication and division", "Negative numbers", "Fractions and decimals", "Order of operations", "Estimation and inverse-operation checks"], relatedTools: ["unit-converter", "recipe-scaler"] },
  { id: "percentages", subjectId: "math", title: "Everyday percentages", description: "Understand percentages through decisions you make in everyday life.", topics: ["Shopping discounts and competing offers", "Successive discounts", "VAT: net and gross prices", "Price increases, decreases, and reversing changes", "Salary and rent changes", "Tips and shared bills", "Recipes and serving sizes", "Survey results: percentages and percentage points", "Savings and hypothetical compound growth"], relatedTools: ["percentage-calculator", "bill-splitter", "recipe-scaler"] },
  { id: "algebra-functions", subjectId: "math", title: "Algebra and functions", description: "Connect equations, graphs, and the relationships they describe.", topics: ["Equations and inequalities", "Ratios and proportions", "Powers, roots, and logarithms", "Functions and graphs", "Domains and substitution checks"], relatedTools: ["function-plotter"] },
  { id: "calculus", subjectId: "math", title: "Derivatives and integrals", description: "See rates of change and accumulation, then connect them to calculations.", topics: ["Slopes and rates of change", "Derivatives", "Areas and accumulation", "Integrals", "Optimization", "Numerical checks and differentiating antiderivatives"], relatedTools: ["function-plotter"] },
  { id: "linear-algebra", subjectId: "math", title: "Linear algebra", description: "Make vectors, matrices, and transformations visible.", topics: ["Vectors", "Matrices", "Systems of linear equations", "Geometric transformations", "Eigenvalues and eigenvectors", "Substitution and residual checks"] },
  { id: "analysis", subjectId: "math", title: "Analysis in depth", description: "Understand the definitions and assumptions behind calculus.", topics: ["Limits and continuity", "Sequences", "Series and convergence", "Definitions and proofs", "Boundary cases and counterexamples"], relatedTools: ["function-plotter"] },
  { id: "probability-statistics", subjectId: "math", title: "Probability and statistics", description: "Reason about chance, data, and uncertainty.", topics: ["Probability and conditional probability", "Distributions", "Averages and variability", "Sampling and uncertainty", "Misleading charts", "Complementary events and simulation checks"] },
  { id: "reading-pitches", subjectId: "music", title: "Reading pitches", description: "Find your way around the staff and recognize written notes.", topics: ["Staff, treble clef, and bass clef", "Note names and ledger lines", "Octaves", "Sharps, flats, and naturals", "Key signatures", "Matching notation to sound"] },
  { id: "reading-rhythm", subjectId: "music", title: "Reading rhythm", description: "Read note lengths, count beats, and follow short passages.", topics: ["Note values and rests", "Dotted notes and ties", "Time signatures and measures", "Counting and tapping rhythms", "Reading pitches and rhythm together"] },
  { id: "rules", subjectId: "football", title: "Football rules", description: "A reference for the laws of the game, supported by visual situations.", topics: ["Pitch, equipment, players, and officials", "Match duration and scoring", "Offside", "Fouls, misconduct, and cards", "Free kicks and penalties", "Throw-ins, goal kicks, corners, and other restarts", "Competition-specific regulations and rule editions"] },
  { id: "positions-tactics", subjectId: "football", title: "Positions and tactics", description: "Discover player responsibilities and how a team's shape changes.", topics: ["Goalkeepers, defenders, midfielders, and forwards", "Responsibilities with and without possession", "Formations", "Pressing and transitions", "Overlapping fullbacks", "False nine and supporting runs"] },
];

export const lessonStages = ["learn", "explore", "practice", "check"] as const;
export type LessonStage = typeof lessonStages[number];
export const lessonStageLabels: Record<LessonStage, string> = { learn: "Learn", explore: "Explore", practice: "Practice", check: "Check" };

export type LessonSection = { title: string; paragraphs: string[]; points?: string[] };
export type LearningLesson = {
  id: string;
  title: string;
  description: string;
  route: string;
  minutes: number;
  subjectId?: string;
  pathId?: string;
  sections: Record<LessonStage, LessonSection>;
};

/** Math uses three stages; verification belongs beside the lesson and practice. */
export const getLessonStages = (lesson: Pick<LearningLesson, "subjectId">): readonly LessonStage[] => lesson.subjectId === "math" ? ["learn", "explore", "practice"] : lessonStages;

// Only published lessons count toward saved progress.
export const learningLessons: LearningLesson[] = [{
  id: "getting-started",
  title: "Make learning your own",
  description: "A short introduction to learning, exploring, practicing, and checking your answers.",
  route: "/learn/start",
  minutes: 3,
  sections: {
    learn: { title: "Start where you are", paragraphs: ["Choose a subject that interests you. You can follow a path in order or return to a topic whenever you need it.", "Each lesson brings together an explanation, something to explore, practice, and a way to check your understanding."], points: ["Learn the idea before memorizing a method.", "Use bookmarks to keep useful lessons close.", "Your reading progress is saved on this browser."] },
    explore: { title: "Ask what changes", paragraphs: ["When an interactive example is available, change one thing at a time. Predict what will happen before revealing the result.", "A graph, a musical staff, or a football pitch can help connect an explanation to something you can see or hear."], points: ["Try a simple case first.", "Look at extremes and boundaries.", "Notice which assumptions the example uses."] },
    practice: { title: "Explain your own steps", paragraphs: ["Try a problem before opening the solution. If you get stuck, use a hint and then try again.", "Getting an answer right once is a start. Explaining why each step works helps you use the idea in a different situation."], points: ["Write down what you know and what you need to find.", "Keep units and assumptions visible.", "Return to mistakes as opportunities to practice."] },
    check: { title: "Know what your check tells you", paragraphs: ["A second method can catch a mistake that repeating the first method would miss. Ask whether your result is plausible and whether it satisfies the original problem.", "Checks have different strengths. An approximation can support an answer; a proof establishes a claim under its stated assumptions. Substitution can confirm a solution without showing that you found every solution."], points: ["Exact check: substitute a solution into the original equation.", "Independent method: calculate the same quantity another way.", "Reasonableness check: compare with an estimate or a boundary case.", "Proof: justify the claim using definitions and valid reasoning."] },
  },
}, ...foundationLessons, ...percentageLessons];

export const subjectRoute = (subjectId: string) => `/learn/${subjectId}`;
export const pathRoute = (path: Pick<LearningPath, "subjectId" | "id">) => `${subjectRoute(path.subjectId)}/${path.id}`;
export const getSubjectPaths = (subjectId: string) => learningPaths.filter(path => path.subjectId === subjectId);
export const getPathLessons = (subjectId: string, pathId: string) => learningLessons.filter(lesson => lesson.subjectId === subjectId && lesson.pathId === pathId);
