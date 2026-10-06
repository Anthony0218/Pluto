import test from 'node:test';
import assert from 'node:assert/strict';
import { transformVector, determinant2, residual2, solveIntegerSystem, sequenceTerm, geometricSeries, conditionalProbability, binomialDistribution, parseDataset, summarizeDataset, proportionUncertainty, atLeastOne, simulateAtLeastOne } from '../src/data/deeperMathCalculations.ts';
import { deeperMathActivities, deeperMathLessons } from '../src/data/deeperMath.ts';
import { everydayMathCases } from '../src/data/everydayMathCases.ts';
import { learningLessons, getPathLessons } from '../src/data/learningCatalog.ts';
import { mathExerciseIds } from '../src/data/mathExerciseIds.ts';
import { gradeMathAnswer } from '../src/data/mathFoundations.ts';
import { createLearningToolsStore } from '../src/data/learningToolsProgress.ts';
const near = (actual,expected,tolerance=1e-10) => assert.ok(Math.abs(actual-expected) <= tolerance, `${actual} ≈ ${expected}`);

test('matrix models preserve rotation lengths, expose lost dimensions, and check original equations', () => {
  const rotate = [[0,-1],[1,0]], stretch = [[2,0],[0,3]], collapse = [[1,2],[2,4]];
  assert.deepEqual(transformVector(rotate,[3,2]),[-2,3]);
  assert.deepEqual(transformVector(stretch,[1,0]),[2,0]);
  assert.deepEqual(transformVector(stretch,[0,1]),[0,3]);
  assert.deepEqual(transformVector([[1.5,1.5],[1.8,1.6]],[2,3]),[7.5,8.4]);
  for (let x=-5; x<=5; x++) for (let y=-5; y<=5; y++) {
    const v = transformVector(rotate,[x,y]); assert.equal(v[0]**2+v[1]**2,x*x+y*y);
  }
  assert.equal(determinant2(rotate),1); assert.equal(determinant2(stretch),6); assert.equal(determinant2(collapse),0);
  assert.deepEqual(residual2([[2,1],[1,2]],[9,5],[25,20]),[-2,-1]);
  assert.equal(transformVector([[Infinity,0],[0,1]],[1,2]),null);
  assert.equal(residual2(rotate,[1,2],[NaN,0]),null);
});

test('linear solver distinguishes unique, incompatible, coincident, and all-zero systems', () => {
  assert.deepEqual(solveIntegerSystem([[2,1],[1,2]],[25,20]),{kind:'unique',vector:[10,5],residual:[0,0]});
  const fractions = solveIntegerSystem([[2,1],[1,-1]],[1,0]);
  near(fractions.vector[0],1/3); near(fractions.vector[1],1/3); fractions.residual.forEach(value => near(value,0));
  const sensitive = solveIntegerSystem([[10000,9999],[9999,9998]],[10000,-10000]);
  assert.equal(sensitive.kind,'unique'); assert.ok(Math.abs(sensitive.vector[0]) > 1e6);
  assert.deepEqual(sensitive.residual,[0,0]);
  for (const [matrix,b,kind] of [
    [[[1,2],[2,4]],[3,6],'infinite'], [[[1,2],[2,4]],[3,7],'none'],
    [[[0,0],[0,0]],[0,0],'infinite'], [[[0,0],[0,0]],[1,0],'none'],
    [[[0,0],[2,4]],[0,6],'infinite'], [[[0,0],[2,4]],[1,6],'none'],
    [[[2,4],[0,0]],[6,0],'infinite'], [[[2,4],[0,0]],[6,1],'none'],
  ]) assert.equal(solveIntegerSystem(matrix,b).kind,kind);
  for (const matrix of [[[.5,1],[1,1]],[[10001,0],[0,1]],[[NaN,0],[0,1]]]) assert.equal(solveIntegerSystem(matrix,[1,1]),null);
});

test('bounded integer systems agree with independent substitution across many matrices', () => {
  for (let a=-2;a<=2;a++) for (let b=-2;b<=2;b++) for (let c=-2;c<=2;c++) for (let d=-2;d<=2;d++) {
    for (const [x,y] of [[-2,3],[0,0],[1,-1]]) {
      const matrix = [[a,b],[c,d]], target=[a*x+b*y,c*x+d*y], result=solveIntegerSystem(matrix,target);
      if (a*d !== b*c) { assert.equal(result.kind,'unique'); near(result.vector[0],x); near(result.vector[1],y); result.residual.forEach(v=>near(v,0)); }
      else assert.equal(result.kind,'infinite');
    }
  }
});

test('sequences distinguish shrinking terms from oscillation and series use the ratio condition', () => {
  assert.equal(sequenceTerm('reciprocal',4),1/4); assert.equal(sequenceTerm('alternating',5),-1); assert.equal(sequenceTerm('alternating',6),1);
  assert.equal(sequenceTerm('geometric',4),1/16);
  for (const n of [0,-1,1.5,1001,NaN]) assert.equal(sequenceTerm('reciprocal',n),null);
  assert.deepEqual(geometricSeries(1,.5,3),{partial:1.75,limit:2,remainder:.25});
  for (const ratio of [-.9,-.5,0,.5,.9]) for (const n of [1,2,3,20]) {
    const result = geometricSeries(2,ratio,n), direct=Array.from({length:n},(_,i)=>2*ratio**i).reduce((a,b)=>a+b,0);
    near(result.partial,direct); near(result.partial+result.remainder,result.limit);
  }
  for (const ratio of [1,-1,1.1,Infinity,NaN]) assert.equal(geometricSeries(1,ratio,4),null);
  assert.equal(geometricSeries(1,.5,0),null);
});

test('conditional probabilities use the restricted denominator and refuse empty populations', () => {
  assert.equal(conditionalProbability(30,50),.6); assert.equal(conditionalProbability(30,40),.75);
  assert.equal(conditionalProbability(0,50),0); assert.equal(conditionalProbability(50,50),1);
  for (const [both,group] of [[0,0],[3,2],[-1,20],[.5,20],[1,10001],[NaN,5]]) assert.equal(conditionalProbability(both,group),null);
});

test('binomial distributions normalize and match independent first and second moments, including endpoints', () => {
  assert.deepEqual(binomialDistribution(2,.5),[.25,.5,.25]);
  for (const n of [1,2,4,10,20]) for (const p of [0,.1,.5,.9,1]) {
    const values=binomialDistribution(n,p), mean=values.reduce((sum,prob,k)=>sum+k*prob,0);
    near(values.reduce((a,b)=>a+b,0),1); near(mean,n*p);
    near(values.reduce((sum,prob,k)=>sum+(k-mean)**2*prob,0),n*p*(1-p));
  }
  for (const [n,p] of [[0,.5],[21,.5],[1.5,.5],[2,-.1],[2,1.1],[2,NaN]]) assert.equal(binomialDistribution(n,p),null);
});

test('data parsing is bounded and statistics distinguish population, sample, median, and outliers', () => {
  assert.deepEqual(parseDataset('2 4;6'),[2,4,6]); assert.deepEqual(parseDataset('1,5; -2.5 +3'),[1.5,-2.5,3]);
  for (const source of ['', '1,2,3', '1e3', '1+2', 'NaN', 'Infinity', '1000001', '1 '.repeat(101), 'x'.repeat(2001)]) assert.equal(parseDataset(source),null,source);
  const normal=summarizeDataset([2,4,6]); assert.equal(normal.mean,4); assert.equal(normal.median,4); assert.equal(normal.range,4); near(normal.populationVariance,8/3); assert.equal(normal.sampleVariance,4);
  const outlier=summarizeDataset([2,4,60]); assert.equal(outlier.mean,22); assert.equal(outlier.median,4);
  assert.equal(summarizeDataset([4,1,3,2]).median,2.5); assert.equal(summarizeDataset([5]).sampleVariance,null);
  assert.equal(summarizeDataset([5]).populationVariance,0); assert.equal(summarizeDataset([]),null);
});

test('sampling uncertainty scales with square-root size and withholds unsuitable normal intervals', () => {
  const small=proportionUncertainty(50,100), large=proportionUncertainty(200,400);
  assert.equal(small.proportion,.5); assert.equal(small.standardError,.05); assert.equal(large.standardError,.025);
  near(small.interval[0],.402); near(small.interval[1],.598);
  for (const [successes,n] of [[0,100],[100,100],[9,100],[91,100]]) assert.equal(proportionUncertainty(successes,n).interval,null);
  assert.ok(proportionUncertainty(10,20).interval);
  for (const [successes,n] of [[0,0],[21,20],[-1,20],[1.5,20],[1,100001]]) assert.equal(proportionUncertainty(successes,n),null);
});

test('complement simulation is bounded, reproducible, and matches known exact outcomes', () => {
  assert.equal(atLeastOne(.5,3),7/8); assert.equal(atLeastOne(0,20),0); assert.equal(atLeastOne(1,20),1);
  for (const [p,n] of [[-.1,3],[1.1,3],[.5,0],[.5,21],[.5,1.5]]) assert.equal(atLeastOne(p,n),null);
  const run=simulateAtLeastOne(.5,3,10000,42); assert.deepEqual(run,simulateAtLeastOne(.5,3,10000,42)); near(run.estimate,7/8,.025);
  assert.equal(simulateAtLeastOne(0,3,100,42).successes,0); assert.equal(simulateAtLeastOne(1,3,100,42).successes,100);
  for (const [repeats,seed] of [[0,1],[10001,1],[100,-1],[100,NaN],[100,0x100000000]]) assert.equal(simulateAtLeastOne(.5,3,repeats,seed),null);
});

test('milestones 7–9 publish all 17 topics and 51 independently audited exact-answer exercises', () => {
  assert.equal(getPathLessons('math','linear-algebra').length,6); assert.equal(getPathLessons('math','analysis').length,5); assert.equal(getPathLessons('math','probability-statistics').length,6);
  const expected=[[6,5,6],[10,6,2],[4,4,2],[-2,3,-5],[3,8,-1],[-1,0,-2],[4,7,0],['1/4',-1,3],[2,3,'7/4'],['1/20','1/10',10],[-1,1,0],['3/5','1/6','3/4'],[2,2,'1/4'],[4,2,'8/3'],['1/20','1/40',2],[10,'1/4',2],['7/8','7/10','1/4']];
  assert.equal(deeperMathActivities.length,17); assert.equal(new Set(learningLessons.map(v=>v.id)).size,learningLessons.length);
  for (const [i,activity] of deeperMathActivities.entries()) {
    const lesson=deeperMathLessons[i]; assert.equal(learningLessons.find(v=>v.id===activity.id),lesson);
    assert.equal(lesson.route,`/learn/math/${activity.pathId}/${activity.id}`); assert.equal(mathExerciseIds.get(activity.id).size,3);
    assert.ok(activity.learn.length>=2 && activity.check && activity.example.verification && activity.exploration);
    for (const [j,question] of activity.practice.entries()) { assert.equal(gradeMathAnswer(question.answer,String(expected[i][j])),'correct',activity.id+'/'+question.id); assert.ok(question.notation && question.hint && question.solution && question.verification); }
  }
});

test('all 44 published math topics include an everyday situation and a concrete calculation', () => {
  const math=learningLessons.filter(v=>v.subjectId==='math'); assert.equal(math.length,44);
  assert.deepEqual(Object.keys(everydayMathCases).sort(),math.map(v=>v.id).sort());
  for (const lesson of math) { const example=everydayMathCases[lesson.id]; assert.ok(example.situation.length>40); assert.ok(example.calculation.includes('=') || example.calculation.includes('⇒')); }
});

test('new lesson stages, reading, bookmarks and exercises persist separately with account isolation', () => {
  const entries=new Map(), port={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)}, store=createLearningToolsStore(port);
  for (const lesson of deeperMathLessons) { store.setLessonStage('alice',lesson.id,'explore'); store.recordSolvedExercise('alice',lesson.id,'p1'); store.recordSolvedExercise('alice',lesson.id,'unknown'); }
  store.setLessonCompleted('alice','vectors',true); store.toggleBookmark('alice','vectors');
  const restored=createLearningToolsStore(port), alice=restored.read('alice');
  assert.ok(alice.lessons.vectors.completed); assert.ok(alice.bookmarks.includes('vectors'));
  for (const lesson of deeperMathLessons) { assert.deepEqual(alice.solvedExercises[lesson.id],['p1']); assert.equal(alice.lessons[lesson.id].stage,'explore'); }
  assert.deepEqual(restored.read('bob').solvedExercises,{}); assert.deepEqual(restored.read('guest').solvedExercises,{});
  restored.resetLessonExercises('alice','vectors'); assert.equal(restored.read('alice').solvedExercises.vectors,undefined); assert.ok(restored.read('alice').lessons.vectors.completed);
});
