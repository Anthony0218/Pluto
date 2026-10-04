import { EXPEDITION_SCENARIOS } from "./expeditionData.ts";
import { WILD_SCENARIOS } from "./wildModesData.ts";

export type Role = "falcon" | "mouse";
export type Mode = "solo" | "duo";
export type Phase = "ready" | "hunt" | "capture" | "boss" | "end";
export type Vec = { x: number; y: number };
export type Particle = Vec & {
  life: number;
  vx: number;
  vy: number;
  color: string;
};
export type Game = {
  randomState: number;
  visualRandomState: number;
  phase: Phase;
  winner: Role | null;
  reason: string;
  mode: Mode;
  role: Role;
  falcon: Vec;
  mouse: Vec;
  boss: Vec;
  falconFacing: number;
  mouseFacing: number;
  catches: number;
  lives: number;
  timer: number;
  bossTimer: number;
  bossHits: number;
  dive: number;
  diveWindup: number;
  lastSeenPrey: Vec;
  attacks: number;
  recovering: boolean;
  actionHeld: boolean;
  diveCooldown: number;
  bossAttack: number;
  bossCooldown: number;
  invincible: number;
  captureTime: number;
  captureMouse: Vec;
  burrowTravel: number;
  burrowExit: number;
  burrowCooldown: number;
  coverTime: number;
  coverPatch: number;
  coverReset: number;
  perchFocus: number;
  flightTrail: Vec[];
  particles: Particle[];
  t: number;
};
export const W = 960,
  H = 540,
  GROUND = 390;
export const HUNT_SECONDS = 55,
  BOSS_SECONDS = 26,
  CAPTURE_SECONDS = 2.1;
export const GRASS = [
  { x: 45, width: 95 }, { x: 170, width: 100 },
  { x: 340, width: 90 }, { x: 470, width: 100 },
  { x: 615, width: 95 }, { x: 765, width: 100 }, { x: 880, width: 65 },
];
export const PERCH = { x: 343, width: 86, y: 152 };
export const BURROW_EXITS = [288, 666] as const;
export const FACTS = [
  {
    title: "The lookout perch",
    text: "American kestrels hunt by day, often scanning open ground from a perch. In the game, resting on the fence prepares a longer dive.",
    url: "https://www.allaboutbirds.org/guide/American_Kestrel/lifehistory",
    label: "Cornell Lab of Ornithology",
  },
  {
    title: "Grass runways",
    text: "Meadow voles travel along surface runways beneath vegetation. In the game, grass hides the vole briefly; staying too long makes it rustle and become vulnerable.",
    url: "https://extension.psu.edu/voles",
    label: "Penn State Extension",
  },
  {
    title: "Underground refuge",
    text: "Meadow voles use runways with burrow openings. The game's two-exit tunnel lets the vole escape a dive, followed by a short cooldown.",
    url: "https://extension.psu.edu/voles",
    label: "Penn State Extension",
  },
  {
    title: "Real prey, fantasy finale",
    text: "Kestrels eat small rodents, including voles. The giant vole boss, three lives, concealment timer and powered-up dive are invented game rules.",
    url: "https://www.allaboutbirds.org/guide/American_Kestrel/lifehistory",
    label: "Cornell Lab of Ornithology",
  },
];
export type Player = 0 | 1;
export type Question = {
  text: string;
  answers: [string, string, string];
  correct: number;
  explanation: string;
};
export const QUESTIONS: Question[] = [
  {
    text: "Which animal is the hunter in this meadow?",
    answers: ["Vole", "American kestrel", "Both"],
    correct: 1,
    explanation: "The kestrel is a small falcon that hunts rodents.",
  },
  {
    text: "What helps a vole avoid a predator in a meadow?",
    answers: [
      "Grass cover and burrows",
      "Flying above the grass",
      "A sharp beak",
    ],
    correct: 0,
    explanation: "Vegetation and underground tunnels offer cover.",
  },
  {
    text: "Which part of this scenario is a fantasy game element?",
    answers: [
      "A kestrel hunting rodents",
      "A vole using cover",
      "A giant vole boss battle",
    ],
    correct: 2,
    explanation: "The giant boss is invented for the game.",
  },
  {
    text: "What kind of bird is an American kestrel?",
    answers: ["Falcon", "Owl", "Duck"],
    correct: 0,
    explanation: "The American kestrel is a small falcon.",
  },
  {
    text: "Where do meadow voles often make their paths?",
    answers: ["Under vegetation", "In tree canopies", "Out at sea"],
    correct: 0,
    explanation: "Voles move through cover among grasses and other plants.",
  },
  {
    text: "Which of these is an invented rule in the minigame?",
    answers: [
      "Birds hunt rodents",
      "Three catches win",
      "Voles use vegetation",
    ],
    correct: 1,
    explanation: "The three-catch target is a game rule.",
  },
];

export type ScenarioId =
  | "meadow"
  | "archerfish"
  | "flyingfish"
  | "bolas"
  | "coconut"
  | "trapjaw"
  | "cuttlefish"
  | "jumpingspider"
  | "spermwhale";
export type Stage = "menu" | "briefing" | "game" | "quiz" | "results";
export type PlayMode = "hotseat" | "ai";
export type BotDifficulty = "easy" | "normal" | "hard";
export type RunPerformance = { completed: boolean; progress: number; health: number; elapsed: number; label: string };
export type GameResult = { winner: Player | null; detail: string; performance?: RunPerformance; opponent?:'ocean'|'rival' };
export type Scenario = {
  id: ScenarioId;
  icon: string;
  title: string;
  setting: string;
  behaviour: string;
  rules: string[];
  abstraction: string;
  source: { label: string; url: string };
  questions: Question[];
};
const quiz = (
  text: string,
  answers: [string, string, string],
  correct: number,
  explanation: string,
): Question => ({ text, answers, correct, explanation });
export const SCENARIOS: Scenario[] = [
  ...WILD_SCENARIOS,
  ...EXPEDITION_SCENARIOS,
  {
    id: "archerfish",
    icon: "🐟",
    title: "Spit & Sprint",
    setting: "Mangroves · competing archerfish",
    behaviour:
      "Archerfish knock insects off overhanging vegetation with jets of water. They use the initial movement of falling prey to predict where to intercept it, competing with other surface-feeding fish for the catch.",
    rules: [
      "Both fish hunt at the same time. Shoot insects off the branches, then swim to the landing ring to catch them at the surface. Either fish can take a catch, whoever fired the shot. Uncaught insects sink after a short time.",
      "First to 7 food wins; after 60 seconds, the fish with more food wins. A simultaneous catch at equal distance gives ½ food each. Equal final totals are a draw. Food is separate from Natura match points.",
      "Coral (Player 1 / you): A/D swim, W/S rotate aim left/right, Space spit, Left Shift dash while swimming. You can also point to aim and click or tap above the water to spit.",
      "Gold (Player 2, or AI): left/right arrows swim, up/down arrows rotate aim left/right, Enter spit, Right Shift dash while swimming. Local players share the keyboard or use the on-screen hold buttons.",
      "Follow the dotted shot preview and falling-insect landing rings. Spit recharges in 0.85 seconds; dash recharges in 2.5 seconds. Pause with Esc or the Pause button. Opening the rules freezes the pond; leaving the window pauses it until you resume.",
    ],
    abstraction:
      "The 60-second round, food target, fixed cooldowns, shared catches, respawning insects and visible trajectory/landing guides are game rules. The water jets and rapid interception of falling prey are real behaviours; refraction and fluid dynamics are simplified.",
    source: {
      label: "Research: the archerfish predictive C-start",
      url: "https://epub.uni-bayreuth.de/id/eprint/7360/",
    },
    questions: [
      quiz(
        "How do archerfish knock insects into the water?",
        [
          "By spitting jets of water",
          "By shaking trees",
          "By blowing warm air",
        ],
        0,
        "Archerfish shoot water at prey on overhanging vegetation.",
      ),
      quiz(
        "Why race after an insect begins to fall?",
        [
          "To avoid getting wet",
          "To intercept it before competing fish",
          "To return it to its branch",
        ],
        1,
        "Other surface-feeding fish can take the same falling food.",
      ),
      quiz(
        "Which feature is a game aid rather than something floating in nature?",
        ["A water jet", "A falling insect", "A glowing landing ring"],
        2,
        "The ring visualises a prediction; real fish estimate the interception point without a marker.",
      ),
      quiz(
        "What information helps an archerfish predict a catch?",
        [
          "The prey’s initial falling movement",
          "The colour of the moon",
          "The number of nearby trees",
        ],
        0,
        "Archerfish rapidly use information from the start of prey movement to guide an interception.",
      ),
      quiz(
        "Is the fish that shoots always guaranteed the meal?",
        [
          "Yes, the meal belongs to it",
          "No, a competitor can reach it first",
          "Only if the insect has wings",
        ],
        1,
        "Shooting and securing the food are separate challenges.",
      ),
      quiz(
        "Which is an invented rule of this minigame?",
        [
          "Fish compete for food",
          "Archerfish shoot water",
          "Every dash recharges in exactly 2.5 seconds",
        ],
        2,
        "The dash timer balances gameplay; it is not a measured biological rule.",
      ),
    ],
  },
  {
    id: "flyingfish",
    icon: "🐠",
    title: "Surface & Sprint",
    setting: "Open ocean · flying fish, tuna & seabirds",
    behaviour:
      "Flying fish use enlarged fins to glide above the sea. Leaving the water can help them escape large predatory fish such as tuna, but it can also expose them to hunting seabirds.",
    rules: [
      "The round alternates every 9 seconds between a sky phase and a water phase. Tap left or right to switch between three lanes. Seabirds and tuna approach from ahead and grow larger as they near you. Each wave leaves at least one safe lane.",
      "Each fish has 3 hearts. A collision costs one heart and gives a short recovery window. Every predator that passes cleanly counts as one dodge.",
      "Vs AI is a solo survival run: A/D moves your coral fish and the ocean is the opponent. Hotseat activates a second gold fish on the same screen using left/right arrows. The round lasts 54 seconds; in hotseat, score breaks ties before remaining hearts.",
      "Escape or the Pause button pauses the round. Touch controls below the canvas let one or two players play without a keyboard.",
    ],
    abstraction:
      "The fixed 9-second phase changes, three hearts, exact spawn rates, collision sizes, score system and 54-second round are game rules. The sky enemies are stylized seabirds rather than a claim that one specific gull species is the main predator.",
    source: {
      label: "Australian Museum: Flying without wings",
      url: "https://publications.australian.museum/blog/amri-news/flying-without-wings/",
    },
    questions: [
      quiz(
        "What do flying fish use to glide above the water?",
        ["Greatly enlarged fins", "Feathers", "Inflated swim bladders"],
        0,
        "Flying fish use enlarged fins as gliding surfaces.",
      ),
      quiz(
        "Why can leaving the water help a flying fish?",
        [
          "It can escape larger predatory fish below",
          "It can breathe air like a bird",
          "It can build a nest",
        ],
        0,
        "A glide can put distance between a flying fish and an underwater predator.",
      ),
      quiz(
        "What new danger can appear when a flying fish glides above the sea?",
        ["Seabirds", "Burrowing mammals", "Freshwater frogs"],
        0,
        "The air is an escape route from fish predators, but it can expose flying fish to seabirds.",
      ),
      quiz(
        "Are tuna a biologically plausible underwater predator in this game?",
        ["Yes", "No, tuna only eat plants", "Only in freshwater"],
        0,
        "Flying fish are documented prey of tunas, so tuna are a plausible underwater hazard.",
      ),
      quiz(
        "Which feature is an invented game rule?",
        [
          "Flying fish glide",
          "Seabirds can catch flying fish",
          "The phase changes exactly every 9 seconds",
        ],
        2,
        "The exact phase timer is designed for the arcade mode.",
      ),
      quiz(
        "Does the sky phase mean flying fish truly fly by flapping?",
        ["Yes", "No, they glide", "Only at night"],
        1,
        "Their enlarged fins act as gliding surfaces; they do not flap them like bird wings.",
      ),
    ],
  },
  {
    id: "meadow",
    icon: "🪶",
    title: "Wings & Whiskers",
    setting: "Meadow · kestrel & vole",
    behaviour:
      "American kestrels hunt small animals, often watching from a perch. Meadow voles move through vegetation and use burrows as shelter.",
    rules: [
      "Kestrel: catch the vole three times before the hunt ends. Vole: use seven grass shelters or the burrow to escape; cover hides you from all shared-screen viewers for a limited time. Each kestrel dive consumes one of five attacks, briefly warns before accelerating, and automatically climbs back up. Rest still on the perch for 2 seconds to refill all five attacks.",
      "After 55 seconds, the fantasy giant-vole phase begins. The kestrel wins with three dives; the vole wins with a strike or survives another 26 seconds.",
      "Local: kestrel uses WASD + Space; vole uses arrows + Enter. Vs AI: use WASD + Space for your assigned animal. On-screen controls also support touch.",
    ],
    abstraction:
      "The giant vole, cooldowns and three lives are invented game rules.",
    source: {
      label: "Cornell Lab: American kestrel",
      url: "https://www.allaboutbirds.org/guide/American_Kestrel/lifehistory",
    },
    questions: QUESTIONS,
  },
];
