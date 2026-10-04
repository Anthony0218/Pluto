import { TOOL_SCENARIOS } from "./toolAnimalsData.ts";
import type { Question, Scenario } from "./naturaData";

const question = (text: string, answers: [string, string, string], correct: number, explanation: string): Question => ({ text, answers, correct, explanation });
export const WILD_SCENARIOS: Scenario[] = [
  ...TOOL_SCENARIOS,
  {
    id: "trapjaw", icon: "🐜", title: "Snap Launch", setting: "Forest floor · trap-jaw ants",
    behaviour: "Trap-jaw ants such as Odontomachus bauri can strike a hard surface with their powerful mandibles and launch themselves into the air to escape danger.",
    rules: [
      "Choose one of sixteen courses, then race across its ledges to the nest. Walk into position, watch the automatically cycling launch angle, then press snap to lock it and strike your jaws against the ground. You cannot jump again or steer until you land. New courses add moving shelves, wind, timed seedpod gates and bark that crumbles if you stand still too long.",
      "Coral: A/D walk and face left/right, Space locks the arc and snaps. Gold: left/right arrows walk, Enter locks the arc and snaps. Release the snap button before the next launch. On-screen hold buttons also work.",
      "A steep angle gives more height and less distance. The dotted arc previews your launch. Each new ledge saves a checkpoint; missing a ledge costs a heart and returns you there. Three falls eliminate an ant.",
      "First to the nest, or last surviving ant, wins. After 60 seconds (90 in the new course pack) compare highest ledge, then remaining hearts; equal results draw. Both ants reaching the nest in the same simulation step are compared by hearts.",
      "Vs AI races a computer ant using the same physics. Esc or Pause stops the round; opening rules freezes play, and leaving the window pauses until resumed.",
    ],
    abstraction: "Aiming precise jumps, the platform course, checkpoints, hearts, trajectory guide and 60-second race are game rules. Real escape jumps are not evidence that ants plan platform routes like a player.",
    source: { label: "PNAS: ballistic jaw propulsion", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1568925/" },
    questions: [
      question("What powers the ant’s escape launch?", ["A snap of its jaws against a surface", "Flapping wings", "A water jet"], 0, "Mandible strikes can propel the ant’s body."),
      question("Which part is a game invention?", ["Fast mandibles", "Saved platform checkpoints", "Escape jumps"], 1, "Checkpoints are an arcade convenience."),
      question("Do all defensive jumps follow the same direction?", ["Yes, always straight up", "Yes, always forward", "No, different launch directions occur"], 2, "Upward and more horizontal defensive jumps have been observed."),
      question("What does mandible mean here?", ["Jaw", "Wing", "Tail"], 0, "An ant’s mandibles are its jaws."),
      question("What do the jaws strike to launch the ant?", ["A cloud", "A hard surface", "Sunlight"], 1, "The surface supplies the reaction force."),
      question("Does the dotted path mean wild ants see a trajectory guide?", ["Yes", "Only at night", "No, it is a game aid"], 2, "The preview helps players learn the game’s physics."),
    ],
  },
  {
    id: "cuttlefish", icon: "🦑", title: "Hide in Plain Sight", setting: "Coastal seabed · camouflaging cuttlefish",
    behaviour: "Cuttlefish change their skin patterns and raise or flatten muscular skin bumps called papillae. Matching nearby surfaces can help them avoid detection by predators.",
    rules: [
      "Race to collect six food points from shared shrimp. Every shrimp can be taken by either player; equal-distance catches split one point. Food returns after five seconds. Swim across 24 irregular, randomly arranged patches while three predators patrol, pause and reverse across the seabed with visible search cones.",
      "Match BOTH skin settings to the ground beneath you: read the patch labels for six pattern/texture combinations, including seagrass, shells and gravel. Stop moving while matched to blend in. Moving remains risky even with the right disguise.",
      "Coral: WASD swim, Space cycles the pattern, Left Shift toggles texture. Gold: arrow keys swim, Enter cycles the pattern, Right Shift toggles texture. Direct skin selectors and movement buttons support touch. Release cycle/toggle keys before pressing again.",
      "Being seen fills your detection meter. At 100%, lose one heart and return to the starting patch; food is kept. Three detections eliminate a cuttlefish. Outside a search cone, or still with matching camouflage, detection falls.",
      "First to 6 shrimp, or last survivor, wins. After 60 seconds compare food, then hearts; equal results draw. Vs AI supplies a competing cuttlefish. Esc or Pause stops play; rules and window changes pause it too.",
    ],
    abstraction: "Six selectable disguises, exact habitat combinations, visible search cones, detection meters, shared food respawns and hearts simplify a much richer biological system. Camouflage lowers detection risk; it is not literal invisibility.",
    source: { label: "Marine Biological Laboratory: skin camouflage", url: "https://www.mbl.edu/news/how-cuttlefish-spikes-out-its-skin-neurological-study-reveals-surprising-control" },
    questions: [
      question("What are papillae?", ["Muscular bumps in the skin", "Small wings", "Glowing teeth"], 0, "Papillae change the skin’s physical texture."),
      question("What can camouflage change besides colour and pattern?", ["The number of hearts", "The texture of the skin", "The direction of gravity"], 1, "Cuttlefish can raise or flatten their papillae."),
      question("Which is a game aid?", ["Skin patterns", "Predators", "Visible search cones"], 2, "The cones represent a simplified detection area."),
      question("What can textured camouflage resemble?", ["Algae-covered rocks", "A keyboard", "A sound wave"], 0, "Cuttlefish can resemble objects in their surroundings."),
      question("Does camouflage guarantee invisibility?", ["Yes", "No, it can reduce detection", "Only on Tuesdays"], 1, "Camouflage can fool an observer, but is not invisibility."),
      question("What does the game simplify?", ["Cuttlefish have skin", "Predators look for prey", "Camouflage into six fixed patterns"], 2, "Real skin patterning is much more varied."),
    ],
  },
];
