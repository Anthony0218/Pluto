import { BOLAS_SOURCE, COCONUT_SOURCE } from "./toolAnimalsData.ts";
import type { ScenarioId } from "./naturaData";
import { FLYING_FISH_FACTS } from "./flyingFishData.ts";

export type AnimalFact = {
  animal: string;
  title: string;
  text: string;
  label: string;
  url: string;
};
const antSource = {
  label: "UC Berkeley",
  url: "https://newsarchive.berkeley.edu/news/media/releases/2006/08/21_ant_video.shtml",
};
const cuttleSource = {
  label: "Marine Biological Laboratory",
  url: "https://www.mbl.edu/news/how-cuttlefish-spikes-out-its-skin-neurological-study-reveals-surprising-control",
};
export const NATURA_FACTS: Record<ScenarioId, AnimalFact[]> = {
  bolas: [
    {
      animal: "BOLAS SPIDER",
      title: "A chemical impersonation.",
      text: "Adult females imitate moth mating signals to attract male prey within striking distance.",
      ...BOLAS_SOURCE,
    },
    {
      animal: "BOLAS SPIDER",
      title: "A tiny sticky lasso.",
      text: "The spider swings a silk thread tipped with a sticky droplet, rather than relying on a broad capture web.",
      ...BOLAS_SOURCE,
    },
  ],
  coconut: [
    {
      animal: "COCONUT OCTOPUS",
      title: "Shelter for later.",
      text: "An octopus can carry discarded coconut shells across the seabed and assemble them into cover later.",
      ...COCONUT_SOURCE,
    },
    {
      animal: "COCONUT OCTOPUS",
      title: "An awkward journey.",
      text: "Transporting shells involves a cumbersome stilt-like walk: an immediate cost for protection at a future stop.",
      ...COCONUT_SOURCE,
    },
  ],
  trapjaw: [
    {
      animal: "TRAP-JAW ANT",
      title: "A jaw-powered catapult.",
      text: "A strike against a hard surface can launch the entire ant into the air. Its jaws become an escape mechanism.",
      ...antSource,
    },
    {
      animal: "ODONTOMACHUS BAURI",
      title: "Over before a blink.",
      text: "Researchers measured an average jaw strike lasting just 0.13 milliseconds in this species.",
      ...antSource,
    },
    {
      animal: "TRAP-JAW ANT",
      title: "Up, or away?",
      text: "Researchers observed upward escape jumps and more horizontal defensive launches. The direction of the strike changes the escape.",
      ...antSource,
    },
  ],
  cuttlefish: [
    {
      animal: "CUTTLEFISH",
      title: "Camouflage has a third dimension.",
      text: "Cuttlefish can raise bumps called papillae to resemble rough, algae-covered rocks, then flatten them again.",
      ...cuttleSource,
    },
    {
      animal: "CUTTLEFISH",
      title: "A disguise that stays put.",
      text: "In a study, extended papillae held their shape for more than an hour without continuing neural signals controlling them.",
      ...cuttleSource,
    },
    {
      animal: "CUTTLEFISH",
      title: "Pattern and texture work together.",
      text: "Pigment organs called chromatophores contribute to skin patterns; muscular papillae change its physical outline.",
      ...cuttleSource,
    },
  ],
  archerfish: [
    {
      animal: "ARCHERFISH",
      title: "The shot is only half the hunt.",
      text: "After prey starts falling, archerfish rapidly select a turn toward the future interception point. Other surface-feeding fish can compete for the same meal.",
      label: "University of Bayreuth",
      url: "https://epub.uni-bayreuth.de/id/eprint/7360/",
    },
    {
      animal: "ARCHERFISH",
      title: "A head start from a falling insect.",
      text: "The initial movement of dislodged prey supplies enough information for an archerfish to begin its predictive start before the food reaches the water.",
      label: "University of Bayreuth",
      url: "https://epub.uni-bayreuth.de/id/eprint/7360/",
    },
  ],
  flyingfish: FLYING_FISH_FACTS,
  humpback: [
    {
      animal: "HUMPBACK WHALE",
      title: "A bubble ring can turn a shoal to jelly.",
      text: "Whales use spiralling bubbles to herd schooling fish into a tighter cluster before a lunge. A brief, localized barrier can change the fish’s escape geometry.",
      label: "University of Hawaiʻi",
      url: "https://www.himb.hawaii.edu/news/whale-bubble-net-feeding-documented-by-uh-researchers-through-groundbreaking-video/",
    },
    {
      animal: "HUMPBACK WHALE",
      title: "The timing matters as much as the bubble wall.",
      text: "The feeding burst is short and intense. Once the school is packed together, the whale can lunge quickly before the fish scatter again.",
      label: "University of Hawaiʻi",
      url: "https://www.himb.hawaii.edu/news/whale-bubble-net-feeding-documented-by-uh-researchers-through-groundbreaking-video/",
    },
  ],
  dungbeetle: [
    {
      animal: "DUNG BEETLE",
      title: "A night compass is part of the journey.",
      text: "Nocturnal dung beetles can orient themselves using the Milky Way, helping them roll their balls in a straight line away from competitors.",
      label: "Lund University",
      url: "https://www.lu.se/publikation/6e6b0a11-b2b5-4d8b-b37d-2a1a7e675149",
    },
    {
      animal: "DUNG BEETLE",
      title: "A detour is easy; realignment is the hard part.",
      text: "A temporary loss of the celestial reference can send a beetle off course, making the correction phase the true test of its navigation.",
      label: "Lund University",
      url: "https://www.lu.se/publikation/6e6b0a11-b2b5-4d8b-b37d-2a1a7e675149",
    },
  ],
  greenheron: [
    {
      animal: "GREEN HERON",
      title: "A lure can be a patient strategy.",
      text: "Green herons sometimes drop floating objects to attract fish close enough for a strike. The bird chooses when the bait is good enough to make a short, high-value attack.",
      label: "Audubon",
      url: "https://www.audubon.org/field-guide/bird/green-heron",
    },
    {
      animal: "GREEN HERON",
      title: "Waiting can pay off, but only if the bait stays useful.",
      text: "The risk is that the fish scatter, the drift carries the lure away, or the bird misses the best moment to strike.",
      label: "Audubon",
      url: "https://www.audubon.org/field-guide/bird/green-heron",
    },
  ],
  meadow: [
    {
      animal: "AMERICAN KESTREL",
      title: "A fence can be a lookout.",
      text: "Kestrels often watch for prey from a perch before dropping toward the ground. A high vantage point helps them scan open habitat.",
      label: "Cornell Lab of Ornithology",
      url: "https://www.allaboutbirds.org/guide/American_Kestrel/lifehistory",
    },
    {
      animal: "MEADOW VOLE",
      title: "A hidden network underfoot.",
      text: "Voles use surface runways beneath vegetation as well as burrows. Long grass is part of their living space, not just scenery.",
      label: "Penn State Extension",
      url: "https://extension.psu.edu/voles",
    },
  ],
  alarm: [
    {
      animal: "FORK-TAILED DRONGO",
      title: "A warning can hide a trick.",
      text: "Drongos sometimes use false alarms to make other animals abandon food, which the bird can then steal.",
      label: "Research: deceptive drongo alarms",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3081750/",
    },
    {
      animal: "DRONGO & MEERKAT",
      title: "Trust has a trade-off.",
      text: "Drongos also give genuine predator warnings. For an animal listening nearby, ignoring a call can mean missing real danger.",
      label: "Research: deceptive drongo alarms",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3081750/",
    },
  ],
  bridges: [
    {
      animal: "ARMY ANTS",
      title: "The workers are the bridge.",
      text: "Army ants can link their bodies into a living bridge. Those ants shorten the route but cannot carry food while holding the structure.",
      label: "Princeton University",
      url: "https://www.princeton.edu/news/2015/11/30/ants-build-living-bridges-their-bodies-speak-volumes-about-group-intelligence",
    },
    {
      animal: "ARMY ANTS",
      title: "No architect needed.",
      text: "A living bridge emerges from interactions between individual ants. There is no central planner assigning every ant a position.",
      label: "Princeton University",
      url: "https://www.princeton.edu/news/2015/11/30/ants-build-living-bridges-their-bodies-speak-volumes-about-group-intelligence",
    },
  ],
  echo: [
    {
      animal: "TIGER MOTH",
      title: "A tiny sonar jammer.",
      text: "The tiger moth Bertholdia trigona produces ultrasonic clicks that can interfere with an attacking bat’s echolocation.",
      label: "Research: tiger moths jam bat sonar",
      url: "https://pubmed.ncbi.nlm.nih.gov/19608920/",
    },
    {
      animal: "BAT & MOTH",
      title: "Sound is information.",
      text: "Bats use returning echoes to locate prey. The moth’s clicks interfere with that process; they do not form a physical shield.",
      label: "Research: tiger moths jam bat sonar",
      url: "https://pubmed.ncbi.nlm.nih.gov/19608920/",
    },
  ],
};
