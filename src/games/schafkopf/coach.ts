import { POINTS, cardLock, cardName, isTrump, type Card, type GameState, type GameView, type Trick } from './schafkopf.ts';
import { chooseCard, type ReasonCode } from './bot.ts';
import { seededRandom } from './botConfig.ts';
import { SCHAFKOPF_LESSONS, type Lesson } from './lessons.ts';
const plainName = (card: Card) => card.rank === 'Ass' ? `${card.suit}-Ass` : cardName(card);
/** Contextual advice and review share the exact same rule/tip pipeline as the bots. */
export function liveSchafkopfTip(view: GameView): string | null {
  if (view.phase === 'legen') return `Legen ist die optionale Klopfrunde zu Beginn einer Runde. Sie findet statt, nachdem du deine ersten vier Karten erhalten hast und bevor die zweite Hand ausgeteilt wird. Wer klopft, verdoppelt die Abrechnung. ${view.rules.klopferMussSpiel !== false ? 'Nach viermal Weiter verpflichtet der letzte Klopfer sich zum Spiel.' : 'Nach viermal Weiter gelten die eingestellten Ramsch-/Eichel-Ober-Regeln mit allen Klopfverdopplungen.'}`;
  if (view.phase !== 'play' || view.turn !== view.seat || !view.contract || !view.legalCards.length) return null;
  const decision = chooseCard(view,'pro',seededRandom(42));
  const lesson = SCHAFKOPF_LESSONS.find(item => item.code === decision.reasonCode);
  return `${lesson?.text ?? 'Prüfe Bedienpflicht und Teamzugehörigkeit.'} Empfehlung: ${plainName(decision.card)}.`;
}
export type TrickReview = { summary:string; actual:Card | null; suggested:Card | null; withinRules:boolean; codes:ReasonCode[]; lessons:Lesson[] };
/** Restore the own hand and public information immediately before the reviewed move. */
export function reviewViewForTrick(view: GameView, trick: Trick): GameView | null {
  if (!view.contract) return null;
  const index = view.tricks.findIndex(item => item.plays[0]?.card.id === trick.plays[0]?.card.id);
  const position = trick.plays.findIndex(play => play.seat === view.seat);
  if (index < 0 || position < 0) return null;
  const history = view.tricks.slice(0,index);
  const prefix = trick.plays.slice(0,position);
  const futureOwn = view.tricks.slice(index).flatMap(item => item.plays).filter(play => play.seat === view.seat).map(play => play.card);
  const currentNotInHistory = view.trick.filter(play => play.seat === view.seat && !view.tricks.some(item => item.plays.some(other => other.card.id === play.card.id))).map(play => play.card);
  const hand = [...new Map([...view.hand,...futureOwn,...currentNotInHistory].map(card => [card.id,card])).values()];
  const points = [0,0,0,0]; history.forEach(item => { points[item.winner] += item.points; });
  const past = [...history.flatMap(item => item.plays),...prefix];
  const calledRank = view.contract.calledRank ?? 'Ass';
  const called = past.find(play => play.card.suit === view.contract!.suit && play.card.rank === calledRank);
  const ownHolder = view.contract.kind === 'rufspiel' && hand.some(card => card.suit === view.contract!.suit && card.rank === calledRank);
  // The known final partner is used only to recognize a public past Davonlaufen, never as prior knowledge.
  const escapedPlay = view.contract.kind === 'rufspiel' ? [...history,{plays:prefix}].flatMap(item => item.plays[0] && item.plays[0].seat === view.partner && item.plays[0].card.suit === view.contract!.suit && !isTrump(item.plays[0].card,view.contract!) && item.plays[0].card.rank !== calledRank ? [item.plays[0]] : []).at(0) : undefined;
  const partner = view.contract.kind !== 'rufspiel' ? null : called?.seat ?? escapedPlay?.seat ?? (ownHolder ? view.seat : null);
  const counts = [0,1,2,3].map(seat => 8-history.filter(item => item.plays.some(play => play.seat === seat)).length-Number(prefix.some(play => play.seat === seat)));
  const spritzEvents = (view.spritzEvents ?? []).filter(event => event.trick < index || event.trick === index && event.position < position);
  const before: GameView = { ...view,phase:'play',turn:view.seat,hand,trick:prefix,tricks:history,points,partner,partnerRevealed:!!called || !!escapedPlay,escaped:!!escapedPlay,counts,result:null,history:[],announcements:[],announcementTitles:{},legalCards:[],locks:{},spritzEvents,spritzCount:spritzEvents.at(-1)?.count ?? 0,spritzSeats:[...new Set(spritzEvents.map(event => event.seat))],lastSpritzTrick:spritzEvents.at(-1)?.trick ?? -1,canDouble:false };
  // cardLock is a pure own-hand check. Dummy foreign hands remain empty.
  const state = { ...before,hands:[0,1,2,3].map(seat => seat === view.seat ? hand : []),pendingHands:[[],[],[],[]],initialHands:[[],[],[],[]] } as GameState;
  before.legalCards = hand.filter(card => cardLock(state,view.seat,card) === null).map(card => card.id);
  before.locks = Object.fromEntries(hand.flatMap(card => { const reason = cardLock(state,view.seat,card); return reason ? [[card.id,reason]] : []; }));
  return before;
}
export function analyzeSchafkopfTrick(view: GameView, trick: Trick): TrickReview {
  const winning = trick.plays.find(play => play.seat === trick.winner);
  const actual = trick.plays.find(play => play.seat === view.seat)?.card ?? null;
  const summary = winning ? `${view.names[trick.winner]} holt ${trick.points} Punkte mit ${plainName(winning.card)}.` : 'Der Stich ist noch nicht vollständig.';
  const before = reviewViewForTrick(view,trick);
  if (!before || !before.legalCards.length) return {summary,actual,suggested:null,withinRules:true,codes:[],lessons:[]};
  const decision = chooseCard(before,'pro',seededRandom(42),{...before.rules.bot,proError:0,deducedR6:{beginner:0,amateur:0,advanced:1,pro:1,legend:1},r6b:{beginner:0,amateur:0,advanced:1,pro:1,legend:1}});
  const codes = [...new Set<ReasonCode>([...decision.debugInfo.rules,...decision.debugInfo.tips])].filter(code => code !== 'EXISTING');
  const lessons = codes.flatMap(code => { const lesson = SCHAFKOPF_LESSONS.find(item => item.code === code); return lesson ? [lesson] : []; });
  const withinRules = !!actual && decision.debugInfo.candidates.includes(actual.id);
  return {summary,actual,suggested:decision.card,withinRules,codes,lessons};
}
export function reviewSchafkopfTrick(view: GameView, trick: Trick): string {
  if (!view.contract) return 'Dieser Stich kann ohne Spielansage nicht bewertet werden.';
  const review = analyzeSchafkopfTrick(view,trick);
  const recommendation = review.suggested && review.actual?.id !== review.suggested.id ? ` Aus deiner damaligen Sicht wäre ${plainName(review.suggested)} eine Empfehlung gewesen.` : '';
  const points = review.actual ? POINTS[review.actual.rank] : 0;
  return `${review.summary}${!review.withinRules ? ' Deine Karte weicht von den Bot-Grundsätzen ab.' : ''}${points >= 10 ? ' Volle Schmier ist besonders wertvoll für einen sicheren Teamstich.' : ''}${recommendation}${review.lessons.length ? ` ${review.lessons[0].code}: ${review.lessons[0].text}` : ''}`;
}
