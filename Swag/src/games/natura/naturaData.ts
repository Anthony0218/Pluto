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
  { x: 104, width: 112 },
  { x: 440, width: 105 },
  { x: 770, width: 112 },
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
  | "alarm"
  | "bridges"
  | "echo"
  | "archerfish"
  | "flyingfish"
  | "humpback"
  | "dungbeetle"
  | "greenheron"
  | "bolas"
  | "coconut"
  | "trapjaw"
  | "cuttlefish";
export type Stage = "menu" | "briefing" | "game" | "quiz" | "results";
export type PlayMode = "hotseat" | "ai";
export type GameResult = { winner: Player | null; detail: string };
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
export const BRIDGE_MAPS = [
  { name: "Fern creek", required: 3, detour: 12, shortcut: 4 },
  { name: "Fallen branch", required: 6, detour: 9, shortcut: 5 },
  { name: "Root ravine", required: 4, detour: 15, shortcut: 3 },
  { name: "Moss crossing", required: 8, detour: 8, shortcut: 4 },
];
export const SCENARIOS: Scenario[] = [
  ...WILD_SCENARIOS,
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
      "The round alternates every 9 seconds between a sky phase and a water phase. Move only left and right: dodge seabirds while gliding above the waves, then dodge tuna after diving below the surface.",
      "Each fish has 3 hearts. A collision costs one heart and gives a short recovery window. Every predator that passes cleanly counts as one dodge.",
      "Vs AI is a solo survival run: A/D moves your coral fish and the ocean is the opponent. Hotseat activates a second gold fish on the same screen using left/right arrows. The round lasts 54 seconds; in hotseat, score breaks ties before remaining hearts.",
      "Space or the Pause button pauses the round. Touch controls below the canvas let one or two players play without a keyboard.",
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
    id: "humpback",
    icon: "🐋",
    title: "Bubble Corral",
    setting: "Open ocean · humpback whales and schooling fish",
    behaviour:
      "Humpbacks bubble-netting around prey can concentrate a tight shoal before a feeding lunge. The whale uses a ring of bubbles to trap fish in a small patch of water.",
    rules: [
      "Steer the whale around the school and release bubbles to compress the prey into a tighter pocket. Wider loops take longer and let the school scatter.",
      "When the prey is crowded, dive and lunge through the centre to collect a bigger score. A quick strike brings a smaller haul; a patient line-up can pay off.",
      "Coral: WASD move, Space bubble, Left Shift dive. Gold: arrows move, Enter bubble, Right Shift dive. The round lasts 45 seconds, and the bigger prey claust develops the highest reward.",
    ],
    abstraction:
      "The crowding mechanic, bubble trail and dive reward are simplified game rules. The real whale behaviour is far more variable, but the basic idea is a bubble corral around food.",
    source: {
      label: "University of Hawaiʻi: bubble-net feeding video",
      url: "https://www.himb.hawaii.edu/news/whale-bubble-net-feeding-documented-by-uh-researchers-through-groundbreaking-video/",
    },
    questions: [
      quiz(
        "What is a humpback whale trying to do with a bubble ring?",
        [
          "Trap prey into a tighter patch",
          "Build an island",
          "Hide from sunlight",
        ],
        0,
        "Bubble nets concentrate schooling fish close together.",
      ),
      quiz(
        "What does a wider enclosure cost?",
        [
          "More bubble volume",
          "More time and more escape chances",
          "No visible change",
        ],
        1,
        "A wider corral gives prey more room to scatter.",
      ),
      quiz(
        "Why might a player delay a lunge?",
        [
          "To wait for a denser school",
          "To get colder water",
          "To stop the bubbles",
        ],
        0,
        "A tighter patch can give a bigger payoff.",
      ),
      quiz(
        "Which part is a game simplification?",
        [
          "Whales feed on schools of fish",
          "Bubble nets concentrate prey",
          "Exact time-to-catch is fixed for gameplay",
        ],
        2,
        "The timer and reward structure are designed for a playable round.",
      ),
      quiz(
        "What are the fish doing in the school?",
        [
          "Swimming in a dense cluster",
          "Sleeping on the bottom",
          "Making nests",
        ],
        0,
        "The fish are moving together as a compact schooling group.",
      ),
      quiz(
        "What does the player control?",
        [
          "A whale’s position and bubble trail",
          "A coral reef",
          "A cloud layer",
        ],
        0,
        "The game is about steering the whale to make the bubble corral.",
      ),
    ],
  },
  {
    id: "dungbeetle",
    icon: "🪲",
    title: "Milky Way Express",
    setting: "Night dunes · dung beetle and the Milky Way",
    behaviour:
      "Some nocturnal dung beetles maintain a straight course by orienting to the Milky Way. A temporary cloud cover can briefly interrupt that celestial reference.",
    rules: [
      "Roll the beetle’s ball across uneven ground while keeping the little sky map aligned with the Milky Way. A single detour is easy; recovering the original path is the challenge.",
      "Clouds pass over the sky and briefly hide the stars, so the heading drifts unless you correct it. Avoid obstacles, then re-align before the next turn.",
      "Coral: WASD roll and brake; Space or Left Shift re-centre on the sky. Gold: arrows roll and brake; Enter or Right Shift re-centre. The objective is a clean straight run with the fewest course corrections.",
    ],
    abstraction:
      "The sky map, drifting direction, obstacle detours and temporary cloud blocks are game rules. The underlying beetle behaviour is inspired by real celestial orientation.",
    source: {
      label: "Lund University: dung beetle celestial navigation",
      url: "https://www.lu.se/publikation/6e6b0a11-b2b5-4d8b-b37d-2a1a7e675149",
    },
    questions: [
      quiz(
        "What helps a dung beetle keep direction at night?",
        [
          "The Milky Way",
          "The sound of running water",
          "A bright patch of grass",
        ],
        0,
        "Beetles can use the Milky Way as a celestial compass.",
      ),
      quiz(
        "Why is detouring around an obstacle tricky?",
        [
          "It breaks the original heading",
          "It makes the beetle too large",
          "It makes the ball heavier",
        ],
        0,
        "A detour can make the animal lose its original direction.",
      ),
      quiz(
        "What do clouds do in the game?",
        [
          "Briefly hide the star reference",
          "Increase the beetle’s speed",
          "Create rain",
        ],
        0,
        "Cloud cover temporarily obscures the celestial guide.",
      ),
      quiz(
        "Which is the main challenge?",
        [
          "Recovering course after a detour",
          "Stopping all movement",
          "Moving backward",
        ],
        0,
        "The real challenge is re-aligning and continuing smoothly.",
      ),
      quiz(
        "Why use a small sky view?",
        [
          "To keep a heading reference while the beetle rolls",
          "To measure rain",
          "To find tree roots",
        ],
        0,
        "The tiny sky map is a simplified navigator display.",
      ),
      quiz(
        "What does the game simplify?",
        [
          "A full night sky into a small compass scene",
          "The beetle’s body shape",
          "The dung ball shape",
        ],
        0,
        "The game highlights the navigation problem rather than full real-world terrain complexity.",
      ),
    ],
  },
  {
    id: "greenheron",
    icon: "🪶",
    title: "Bait & Wait",
    setting: "Pond edge · green heron and wary fish",
    behaviour:
      "Green herons may drop floating objects into water to bait fish closer, then strike when prey comes within reach. Timing matters as the lure drifts away.",
    rules: [
      "Place bait in the pond, then watch the lure drift with the current. Fish move toward the bait, but they also scatter if the lure drifts too far.",
      "Strike early for a smaller catch, or wait for a fuller shoal and a better angle while risking that the bait floats away before the fish finish circling it.",
      "Coral: WASD move, Space place bait, Left Shift strike. Gold: arrows move, Enter place bait, Right Shift strike. A quick lunge is rewarding, but patience can make a better chance.",
    ],
    abstraction:
      "Helplessly drifting bait, fish behaviour and the reach threshold are all game rules to represent the lure-and-wait decision in a compact round.",
    source: {
      label: "Audubon: green heron",
      url: "https://www.audubon.org/field-guide/bird/green-heron",
    },
    questions: [
      quiz(
        "Why would a heron drop bait or a lure?",
        ["To attract nearby fish", "To build a nest", "To mark a territory"],
        0,
        "Lures can draw fish within striking distance.",
      ),
      quiz(
        "What is the trade-off in waiting?",
        [
          "Better opportunity versus bait drift",
          "Longer wingspan versus deeper water",
          "More mud versus more light",
        ],
        0,
        "The bait can drift away before the heron gets the best chance.",
      ),
      quiz(
        "Why might an early strike be tempting?",
        [
          "It is quick and low risk",
          "The fish are always larger",
          "The water becomes calm",
        ],
        0,
        "The first fish to approach may be a smaller, safer catch.",
      ),
      quiz(
        "What does the fish react to?",
        [
          "The bait drifting in the water",
          "The heron’s song",
          "The pond depth alone",
        ],
        0,
        "The lure can attract fish into the strike zone.",
      ),
      quiz(
        "Which part is a game invention?",
        [
          "Herons use lures in some situations",
          "Bait drifts in a set way for play",
          "Fish always swim in circles",
        ],
        1,
        "The exact drifting and timing rules are simplified for better play.",
      ),
      quiz(
        "What is the player’s main decision?",
        ["When to strike", "Whether to eat the fish", "Where to nest"],
        0,
        "The timing of the strike is the core challenge.",
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
      "Kestrel: catch the vole three times before the hunt ends. Vole: hide in grass or use the burrow to escape.",
      "After 55 seconds, the fantasy giant-vole phase begins. The kestrel wins with three dives; the vole wins with a strike or survives another 26 seconds.",
      "Local: kestrel uses WASD + Space; vole uses arrows + Enter. Vs AI: use WASD + Space for your assigned animal. A keyboard is required.",
    ],
    abstraction:
      "The giant vole, cooldowns and three lives are invented game rules.",
    source: {
      label: "Cornell Lab: American kestrel",
      url: "https://www.allaboutbirds.org/guide/American_Kestrel/lifehistory",
    },
    questions: QUESTIONS,
  },
  {
    id: "alarm",
    icon: "🐦",
    title: "False Alarm",
    setting: "Savannah · drongo & meerkat",
    behaviour:
      "Fork-tailed drongos give real predator warnings, but sometimes use false alarms to make meerkats abandon food. The drongo can then steal the meal.",
    rules: [
      "Play six encounters, changing animal each time. Only the drongo sees whether a predator is present; it chooses alarm or silence.",
      "The meerkat chooses: eat (+2 food if safe, −2 if danger), inspect (+1 if safe, −1 if danger), or flee (0).",
      "A drongo gets +2 for a successful bluff, −1 for an unsuccessful bluff, +1 for a genuine warning, or +1 for quietly foraging when safe. Most food after six encounters wins. In hotseat, look away during your opponent’s private turn.",
    ],
    abstraction:
      "Food points, the inspection action and encounter schedule simplify the real behaviour. Each encounter independently has a 50% chance of danger.",
    source: {
      label: "Research: deceptive drongo alarms",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3081750/",
    },
    questions: [
      quiz(
        "Why might a drongo give a false alarm?",
        ["To steal abandoned food", "To build a nest", "To guide migration"],
        0,
        "A fleeing animal may leave a meal behind.",
      ),
      quiz(
        "What is the risk of ignoring an alarm?",
        ["Losing feathers", "Missing a real predator", "Making a burrow"],
        1,
        "Some alarms really do warn of danger.",
      ),
      quiz(
        "Which part is a game simplification?",
        [
          "Animals react to warnings",
          "Drongos steal food",
          "Each meal is exactly two points",
        ],
        2,
        "Fixed point values are designed for play.",
      ),
      quiz(
        "Do drongos also give genuine warnings?",
        ["Yes", "No, only false ones", "Only when asleep"],
        0,
        "Both real and false alarms occur.",
      ),
      quiz(
        "Why can fleeing cost a meerkat food?",
        [
          "The food becomes poisonous",
          "It can leave its meal behind",
          "The food flies away",
        ],
        1,
        "The drongo can take the abandoned meal.",
      ),
      quiz(
        "Which ability does this scenario explore?",
        ["Photosynthesis", "Echolocation", "Communication and deception"],
        2,
        "Animals respond to information from other species.",
      ),
    ],
  },
  {
    id: "bridges",
    icon: "🐜",
    title: "Living Bridges",
    setting: "Forest floor · army ant colonies",
    behaviour:
      "Army ants can link their bodies into living bridges. A bridge shortens the route, but ants holding it together cannot carry food at the same time.",
    rules: [
      "Each colony has 12 ants. On each of four maps, choose how many ants form a bridge; the others carry food.",
      "A bridge only opens when its minimum ant requirement is met. Otherwise carriers take the detour. Food = floor(carriers × 12 ÷ route length).",
      "Choices lock before the other colony plays. Both get the same map. Most food after four maps wins; a bridge is not always the best choice.",
    ],
    abstraction:
      "The fixed colony size and food equation are a puzzle model. Real ant bridges emerge from local interactions, without a player directing the colony.",
    source: {
      label: "Princeton: living ant bridges",
      url: "https://www.princeton.edu/news/2015/11/30/ants-build-living-bridges-their-bodies-speak-volumes-about-group-intelligence",
    },
    questions: [
      quiz(
        "What makes an army ant bridge?",
        ["Linked ant bodies", "A wooden plank", "A spider web"],
        0,
        "Ants form the structure with their own bodies.",
      ),
      quiz(
        "What is the cost of putting ants into a bridge?",
        [
          "They become another species",
          "They cannot carry food at that moment",
          "They lose their antennae",
        ],
        1,
        "Bridge workers are unavailable for transport.",
      ),
      quiz(
        "How do real ant bridges form?",
        [
          "A human draws plans",
          "Every ant sees the whole map",
          "Through local interactions",
        ],
        2,
        "Collective structures can emerge without a central planner.",
      ),
      quiz(
        "How can a bridge help the colony?",
        ["By shortening a route", "By producing sunlight", "By growing food"],
        0,
        "A shortcut can improve movement through the habitat.",
      ),
      quiz(
        "Does using more ants for a bridge always help?",
        [
          "Yes, without any cost",
          "No, fewer carriers remain",
          "Only if ants can fly",
        ],
        1,
        "The colony faces a trade-off between structure and transport.",
      ),
      quiz(
        "Which is a rule of this puzzle, rather than a biological fact?",
        [
          "Ants cooperate",
          "Ant bodies form bridges",
          "Every colony has exactly 12 ants",
        ],
        2,
        "Real colonies are not restricted to this puzzle's size.",
      ),
    ],
  },
  {
    id: "echo",
    icon: "🦇",
    title: "Echo Chase",
    setting: "Night sky · bat & tiger moth",
    behaviour:
      "Bats locate prey using returning sound echoes. The tiger moth Bertholdia trigona produces ultrasonic clicks that can interfere with an attacking bat’s sonar.",
    rules: [
      "Each player gets one hunt as the bat. The moth starts in a hidden cell on a 5 × 5 board and moves one cell sideways/up/down, stays, or uses one of two jams.",
      "After the moth acts, the bat selects a cell and either pings or strikes. A ping reports Manhattan distance (horizontal + vertical steps); a jam blocks that turn’s ping. A strike catches the moth only in the selected cell.",
      "The bat gets eight actions. Capture earns 9 minus actions used (8 points for a first-action catch). Failure earns 0. Compare both hunts; higher hunting score wins. Hotseat uses private handoff screens.",
    ],
    abstraction:
      "Grid cells, exact distances and two jam charges are game rules. Real sonar is continuous; moth clicks interfere with echo processing rather than creating a literal shield.",
    source: {
      label: "Research: tiger moths jam bat sonar",
      url: "https://pubmed.ncbi.nlm.nih.gov/19608920/",
    },
    questions: [
      quiz(
        "What does a bat use to locate prey in this scenario?",
        ["Returning sound echoes", "Sunlight alone", "Magnetic footprints"],
        0,
        "The bat emits sound and listens for echoes.",
      ),
      quiz(
        "What does Bertholdia trigona produce defensively?",
        ["A smoke cloud", "Ultrasonic clicks", "A stone wall"],
        1,
        "Its clicks can interfere with bat sonar.",
      ),
      quiz(
        "Which feature belongs to the game model?",
        [
          "Bats hunt moths",
          "Sound carries information",
          "A moth has exactly two jam charges",
        ],
        2,
        "The charge limit is a balancing rule.",
      ),
      quiz(
        "What is echolocation?",
        [
          "Finding things through sound echoes",
          "Changing skin colour",
          "Following a scent trail",
        ],
        0,
        "Returning echoes provide information about surroundings.",
      ),
      quiz(
        "What can the moth's clicks disrupt?",
        ["The bat's feathers", "The bat's processing of echoes", "Gravity"],
        1,
        "The interference can make attacks less successful.",
      ),
      quiz(
        "Do all moths necessarily use this exact defence?",
        [
          "Yes, all species",
          "Only in daylight",
          "No, this example concerns a particular species",
        ],
        2,
        "Species differ in their defences against predators.",
      ),
    ],
  },
];
