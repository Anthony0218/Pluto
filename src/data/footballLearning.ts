export const footballEdition = 'IFAB 2026/27';
export const footballLawsUrl = 'https://www.theifab.com/laws/latest/';
export type OffsideOrigin = 'pass' | 'throw-in' | 'goal-kick' | 'corner' | 'free-kick';
export type OpponentContact = 'none' | 'deflection' | 'save' | 'deliberate-play';
export type OffsideSituation = { attacker: number; ball: number; opponents: number[]; involved: boolean; origin: OffsideOrigin; contact: OpponentContact };
/** Coordinates denote foremost eligible body points, attacking towards x=100. */
export function judgeOffside(situation: OffsideSituation) {
  if (situation.opponents.length < 2 || [situation.attacker, situation.ball, ...situation.opponents].some(x => !Number.isFinite(x) || x < 0 || x > 100)) throw new RangeError('position');
  const secondLast = [...situation.opponents].sort((a, b) => b - a)[1];
  const line = Math.max(secondLast, situation.ball);
  const position = situation.attacker > 50 && situation.attacker > line;
  const exempt = ['throw-in', 'goal-kick', 'corner'].includes(situation.origin);
  const reset = situation.contact === 'deliberate-play';
  const offence = position && situation.involved && !exempt && !reset;
  const reason = exempt ? 'Direct receipt from this restart has no offside offence.' : reset ? 'Controlled deliberate play by an opponent resets this offside phase; a save does not.' : !position ? 'At the pass, the attacker is level, behind the ball or opponent, or in their own half.' : !situation.involved ? 'Offside position alone is not an offence; this player does not affect play or an opponent.' : 'The attacker was beyond both references at the pass and becomes involved. Indirect free kick.';
  return { secondLast, line, position, offence, reason };
}
export const offsidePresets: { name: string; situation: OffsideSituation }[] = [
  { name: 'Beyond the line', situation: { attacker: 79, ball: 52, opponents: [92, 70, 61], involved: true, origin: 'pass', contact: 'none' } },
  { name: 'Level, then running behind', situation: { attacker: 70, ball: 52, opponents: [92, 70, 61], involved: true, origin: 'pass', contact: 'none' } },
  { name: 'Behind the ball', situation: { attacker: 79, ball: 82, opponents: [92, 70, 61], involved: true, origin: 'pass', contact: 'none' } },
  { name: 'Goalkeeper advanced', situation: { attacker: 79, ball: 52, opponents: [92, 61, 70], involved: true, origin: 'pass', contact: 'none' } },
  { name: 'No involvement', situation: { attacker: 79, ball: 52, opponents: [92, 70, 61], involved: false, origin: 'pass', contact: 'none' } },
  { name: 'Direct throw-in', situation: { attacker: 79, ball: 52, opponents: [92, 70, 61], involved: true, origin: 'throw-in', contact: 'none' } },
  { name: 'In own half', situation: { attacker: 48, ball: 35, opponents: [92, 44, 38], involved: true, origin: 'pass', contact: 'none' } },
  { name: 'Deflection or save', situation: { attacker: 79, ball: 52, opponents: [92, 70, 61], involved: true, origin: 'pass', contact: 'deflection' } },
  { name: 'Controlled deliberate play', situation: { attacker: 79, ball: 52, opponents: [92, 70, 61], involved: true, origin: 'pass', contact: 'deliberate-play' } },
];
export function boundaryRestart(boundary: 'touchline' | 'goal-line', lastTouch: 'attacker' | 'defender', wholeBallOut: boolean) {
  if (!wholeBallOut) return 'Play on';
  if (boundary === 'touchline') return 'Throw-in to the other team';
  return lastTouch === 'defender' ? 'Corner kick' : 'Goal kick';
}
export const formationLines = { '4-3-3': [4, 3, 3], '4-4-2': [4, 4, 2], '3-5-2': [3, 5, 2] } as const;
export type Formation = keyof typeof formationLines;
export type BoardPlayer = { number: number; x: number; y: number; role: string };
export function formationPlayers(formation: Formation, possession: boolean): BoardPlayer[] {
  const players = [{ number: 1, x: 10, y: 50, role: 'Goalkeeper' }];
  const roles = ['Defender', 'Midfielder', 'Forward'];
  formationLines[formation].forEach((count, line) => {
    for (let index = 0; index < count; index++) players.push({ number: players.length + 1, x: [28, 49, 73][line] + (possession ? line === 0 ? 8 : 10 : 0), y: (possession ? 12 : 22) + index * (possession ? 76 : 56) / (count - 1), role: roles[line] });
  });
  if (formation === '3-5-2' && !possession) {
    players[4] = { ...players[4], x: 28, y: 12 };
    players[8] = { ...players[8], x: 28, y: 88 };
  }
  return players;
}
export const offsideLabels = [...offsidePresets.map(p => p.name), ...offsidePresets.map(p => judgeOffside(p.situation).reason), 'Normal team-mate pass', 'Throw-in', 'Goal kick', 'Corner kick', 'Free kick', 'No opponent touch', 'Deflection', 'Deliberate save', 'Controlled deliberate play', 'Play on', 'Throw-in to the other team', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

export const roleResponsibilities: Record<string, { with: string; without: string }> = {
  Goalkeeper: { with: 'Offer a safe return pass and start the build-up while staying ready to protect the goal.', without: 'Protect the goal, organise defenders, and judge when to claim or clear the ball.' },
  Defender: { with: 'Provide a passing outlet or width, and keep cover against a counterattack.', without: 'Protect dangerous space, track attackers, and cover a team-mate who steps forward.' },
  Midfielder: { with: 'Connect defence and attack, find passing angles, and support the ball carrier.', without: 'Screen central passes, track runners, and support coordinated pressure.' },
  Forward: { with: 'Create depth, move into scoring space, link play, and finish chances.', without: 'Guide the press and close useful passing lanes without losing team shape.' },
};
