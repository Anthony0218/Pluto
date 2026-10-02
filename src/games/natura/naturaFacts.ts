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
};
