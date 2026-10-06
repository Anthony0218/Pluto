import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseSplit, routineProgress, routineSequence, subscriptionBudgetEntries, budgetMonth, groupBalances } from '../src/data/lifeTools.ts';
import { createLifeToolsStore, parseLifeTools } from '../src/data/lifeToolsStorage.ts';
import { footballTournaments, footballFlags } from '../src/data/footballTournaments.ts';

test('direct custom amounts and separate tips conserve cents and reject unassigned, overassigned or excluded tip payers', () => {
 assert.deepEqual(expenseSplit(6000, 901, ['a','b','c'], 'equal', {}, 'equal', 'a'), {billShares:{a:2000,b:2000,c:2000},tipShares:{a:301,b:300,c:300},shares:{a:2301,b:2300,c:2300}});
 const split=expenseSplit(6000,900,['a','c'],'custom',{a:4500,c:1500},'person','c');
 assert.deepEqual(split.shares,{a:4500,c:2400});
 for(const custom of [{a:4500,c:1499},{a:4500,c:1501},{a:NaN,c:1500},{a:-100,c:6100}]) assert.equal(expenseSplit(6000,900,['a','c'],'custom',custom,'equal','a'),null);
 assert.equal(expenseSplit(6000,900,['a','c'],'equal',{},'person','b'),null);
 assert.equal(expenseSplit(6000,0,[],'equal',{},'equal',''),null);
 assert.equal(expenseSplit(2e9,1,['a'],'equal',{},'equal','a'),null);
 const group={members:[{id:'a',name:'Anna'},{id:'c',name:'Chris'}],expenses:[{paidBy:'a',amount:6900,...split}],repayments:[]};
 assert.deepEqual(groupBalances(group),{a:2400,c:-2400});
});
test('multi-exercise workouts execute sets in order, preserve reps and skip final rest',()=>{
 const routine={id:'push',name:'Push Day',work:10,rest:5,rounds:2,exercises:[{id:'press',name:'Press',sets:2,reps:10,duration:10,rest:5},{id:'plank',name:'Plank',sets:1,reps:0,duration:20,rest:10}]};
 assert.deepEqual(routineSequence(routine).map(s=>[s.exercise.id,s.set]),[['press',1],['press',2],['plank',1]]);
 assert.equal(routineProgress(routine,10).phase,'Rest');assert.equal(routineProgress(routine,15).set,2);
 assert.equal(routineProgress(routine,30).exercise.id,'plank');assert.equal(routineProgress(routine,50).phase,'Finished');assert.equal(routineProgress(routine,999).total,50);
 assert.equal(routineProgress({...routine,exercises:undefined},25).phase,'Finished');
 const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
 const store=createLifeToolsStore(storage);assert.ok(store.save('anna','routines',routine));
 assert.deepEqual(createLifeToolsStore(storage).read('anna').routines,[routine]);assert.equal(store.read('chris').routines.length,0);
 assert.deepEqual(parseLifeTools(JSON.stringify({version:1,routines:[{id:'legacy',name:'Intervals',work:30,rest:15,rounds:3}]})).routines[0].rounds,3);
});
test('subscription integration uses billing month amounts without copying, compounding or crossing accounts/currencies',()=>{
 const subscriptions=[{id:'monthly',name:'Music',amount:1000,currency:'EUR',date:'2024-01-31',cycle:'monthly',active:true},{id:'annual',name:'Insurance',amount:12000,currency:'EUR',date:'2024-02-29',cycle:'yearly',active:true},{id:'future',name:'Future',amount:500,currency:'EUR',date:'2027-01-01',cycle:'monthly',active:true},{id:'inactive',name:'Cancelled',amount:2000,currency:'EUR',date:'2024-01-01',cycle:'monthly',active:false}];
 const before=structuredClone(subscriptions),rows=subscriptionBudgetEntries(subscriptions,'2026-02');
 assert.deepEqual(rows.map(r=>[r.id,r.date,r.amount]),[['subscription-monthly','2026-02-28',1000],['subscription-annual','2026-02-28',12000]]);
 assert.equal(budgetMonth(rows,'2026-02','EUR').expense,13000);assert.equal(budgetMonth(rows,'2026-02','USD').expense,0);
 assert.equal(subscriptionBudgetEntries(subscriptions,'2026-03').length,1);assert.deepEqual(subscriptions,before);assert.deepEqual(subscriptionBudgetEntries(subscriptions,'2026-02'),rows);
});
test('all six tournament configurations isolate competition data, source finals and separate shootouts',()=>{
 assert.equal(footballTournaments.length,6);assert.equal(new Set(footballTournaments.map(t=>t.id)).size,6);
 for(const t of footballTournaments){assert.ok(t.finals.length>=2);for(const final of t.finals){assert.match(final.source,/^https:\/\//);assert.equal(final.goals.length,final.score[0]+final.score[1]);for(const goal of final.goals)assert.ok(final.teams.includes(goal.team));}if(t.national)for(const w of t.winners)assert.ok(footballFlags[w.team]);}
 const final=footballTournaments[0].finals.find(f=>f.year===2022);assert.deepEqual(final.score,[3,3]);assert.deepEqual(final.penalties,[4,2]);assert.equal(final.goals.at(-1).minute,'118');
});
