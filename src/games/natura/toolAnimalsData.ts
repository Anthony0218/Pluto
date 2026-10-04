import type { Scenario, Question } from './naturaData';
const q = (text: string, answers: [string, string, string], correct: number, explanation: string): Question => ({ text, answers, correct, explanation });
export const BOLAS_SOURCE = { label: 'University of Kentucky: bolas spiders', url: 'https://www.uky.edu/Ag/Entomology/entdept/faculty/yeargan/yeargan2.htm' };
export const COCONUT_SOURCE = { label: 'Natural History Museum: octopus tools', url: 'https://www.nhm.ac.uk/discover/octopuses-keep-surprising-us-here-are-eight-examples-how.html' };
export const TOOL_SCENARIOS: Scenario[] = [
  { id: 'bolas', icon: '🕷️', title: 'Midnight Lasso', setting: 'Night-time branches · bolas spider',
    behaviour: 'Adult female bolas spiders lure male moths with chemical mimicry and catch them with a sticky droplet on a silk thread.',
    rules: ['Move along the branch, aim your sticky thread, lure moths closer and swing. The ball at the tip must touch a moth; one catch per swing. First to eight catches wins, or most catches after 60 seconds. A simultaneous catch splits the point.',
      'Coral: A/D move, W/S aim left/right, Space swing, Left Shift lure. Gold: left/right arrows move, up/down arrows aim, Enter swing, Right Shift lure. Touch buttons are available. Release action keys between uses.',
      'A lure lasts 3.5 seconds and recharges in five seconds. A swing needs almost a second to reset. Aim before swinging; the angle locks during the sweep.',
      'Play against AI or locally with two players. Escape, Pause, rules, or leaving the window suspend play. Equal final scores draw.'],
    abstraction: 'Controllable scent bursts, moving along a shared branch, adjustable aim, cooldowns and scoring are game inventions based on real luring and sticky-thread hunting.', source: BOLAS_SOURCE,
    questions: [q('What catches the moth?', ['A sticky droplet on silk', 'A water jet', 'A leaf'], 0, 'The droplet adheres to prey.'),
      q('What does the lure imitate?', ['Rain', 'Moth sex pheromones', 'Birdsong'], 1, 'Chemical mimicry attracts male moths.'),
      q('Which spider is represented here?', ['A jumping spider', 'A tarantula', 'An adult female bolas spider'], 2, 'This hunting technique is used by adult female bolas spiders.'),
      q('What supports the sticky ball?', ['Silk', 'A feather', 'A bone'], 0, 'The ball hangs from a short silk thread.'),
      q('Which detail is a game rule?', ['Chemical mimicry', 'A five-second lure recharge', 'Sticky silk'], 1, 'Wild spiders do not follow a game cooldown.'),
      q('Which prey is attracted by the mimicked signal?', ['Crabs', 'Earthworms', 'Male moths'], 2, 'The lure exploits moth mating signals.')],
  },
  { id: 'coconut', icon: '🐙', title: 'Carry Your Cover', setting: 'Open seabed · coconut octopus',
    behaviour: 'Coconut octopuses transport discarded shells and assemble them into shelters when needed.',
    rules: ['Collect six food points from shared meals. Either player can take each meal; equally close arrivals split one point. Meals return after five seconds. Pick up your numbered shell within reach, carry it between stops, and assemble cover before a predator reaches you. Carrying is slower than travelling without shelter.',
      'Coral: WASD move, Space pick up/drop, Left Shift cover/emerge. Gold: arrow keys move, Enter pick up/drop, Right Shift cover/emerge. Touch buttons are available. Release action keys between uses.',
      'Warning lanes mark an approaching patrol. Cover takes 0.45 seconds to assemble. You cannot move or collect food while covered. Emerge, then pick your shell up again after danger passes.',
      'An exposed hit costs one of three hearts. The predator drags you away, then you respawn beside your shell with brief protection. First to six food, or last survivor, wins. At 60 seconds compare food, then hearts; equal scores draw. AI and local two-player are supported. Escape, Pause, rules and window changes suspend play.'],
    abstraction: 'Personal numbered shells, shared food respawns, assembly timers, warning lanes, hearts and races simplify observed shelter transport. The carrying cost represents a real trade-off, not a measured speed ratio.', source: COCONUT_SOURCE,
    questions: [q('Why transport a shell?', ['For later shelter', 'To grow wings', 'To make sunlight'], 0, 'The object can provide protection later.'),
      q('What is a cost of carrying shelter?', ['It becomes invisible', 'Awkward movement', 'It cannot see colour'], 1, 'Transporting shells can make travel cumbersome.'),
      q('What can this octopus use as cover?', ['Only living coral', 'Only seaweed', 'Discarded coconut shells'], 2, 'Discarded shells can be assembled as shelter.'),
      q('How can it clean a recovered shell?', ['With water jets', 'With fire', 'With feathers'], 0, 'Water jets help clear sediment.'),
      q('Which is a game aid?', ['Carrying objects', 'Glowing predator warning lanes', 'Using shelter'], 1, 'The lanes help players anticipate danger.'),
      q('Why is this behaviour remarkable?', ['The shell is part of its body', 'It never leaves shelter', 'It carries an object for later use'], 2, 'The shelter becomes useful after transport.')],
  },
];
