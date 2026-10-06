import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFunction, evaluateFunction, functionInterval, sampleFunction, numericalSlope, numericalIntegral } from '../src/data/functionMath.ts';
import { advancedMathActivities, advancedMathLessons } from '../src/data/advancedMath.ts';
import { learningLessons, getPathLessons } from '../src/data/learningCatalog.ts';
import { mathExerciseIds } from '../src/data/mathExerciseIds.ts';
import { gradeMathAnswer } from '../src/data/mathFoundations.ts';
import { createLearningToolsStore } from '../src/data/learningToolsProgress.ts';
import { toolApps } from '../src/data/toolCatalog.ts';
const expression = source => { const parsed = parseFunction(source); assert.ok(parsed.expression, source); return parsed.expression; };
const near = (actual, expected, tolerance = 1e-8) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test('bounded math grammar handles precedence, powers, signs and nested functions', () => {
  for (const [source, x, result] of [['-x^2', 3, -9], ['(-x)^2', 3, 9], ['2^3^2', 0, 512], ['2^-3', 0, .125], ['2*x+3', 4, 11], ['1e-3*x', 2, .002], ['sin(pi/2)+cos(0)', 0, 2], ['ln(e)+log(100)', 0, 3], ['sqrt(abs(-x))', 4, 2], ['exp(0)', 0, 1], ['x--2', 3, 5]]) near(evaluateFunction(expression(source), x), result);
});

test('parser rejects executable syntax, implicit multiplication, malformed input and excessive work', () => {
  for (const source of ['window.location', 'process.exit()', 'alert(1)', 'x.constructor', 'x[0]', '2x', '2(x+1)', 'sin x', 'sin(x,1)', '(x', 'x)', 'x^^2', '1..2', '1,5*x', '1;2', '1e999', 'NaN', 'Infinity', 'Math.sin(x)', 'x=2', '']) assert.ok(parseFunction(source).error, source);
  assert.ok(parseFunction('x'.repeat(201)).error);
  assert.ok(parseFunction('('.repeat(25)+'x'+')'.repeat(25)).error);
  assert.ok(parseFunction('-'.repeat(30)+'x').error);
});

test('evaluation respects real domains and bounded numeric values', () => {
  for (const [source, x] of [['1/x', 0], ['sqrt(x)', -1], ['ln(x)', 0], ['log(x)', -1], ['(-1)^0.5', 0], ['0^0', 0], ['0^-1', 0], ['tan(pi/2)', 0], ['exp(x)', 100], ['x', Infinity]]) assert.equal(evaluateFunction(expression(source), x), null, source);
  near(evaluateFunction(expression('sqrt(x)'), 0), 0);
  near(evaluateFunction(expression('(-2)^3'), 0), -8);
});

test('sampled curves never join across poles, excluded inputs or invalid real intervals', () => {
  for (const [source, min, max, pole] of [['1/x', -1, 1, 0], ['1/(x-0.12345)', -1, 1, .12345], ['1/(x-0.12345)^2', -1, 1, .12345], ['tan(x)', 0, 3, Math.PI/2], ['(x^2-1)/(x-1)', -2, 3, 1]]) {
    const segments = sampleFunction(expression(source), min, max, 120);
    assert.ok(segments.length >= 2, source);
    assert.ok(segments.every(segment => !(segment[0].x < pole && segment.at(-1).x > pole)), source);
    assert.ok(segments.flat().every(point => Number.isFinite(point.y)));
  }
  assert.ok(sampleFunction(expression('sqrt(x)'), -2, 2).flat().every(point => point.x >= 0));
  assert.equal(sampleFunction(expression('1/(x^2+1)'), -2, 2).length, 1);
  assert.equal(sampleFunction(expression('1/sin(x)'), .2, 2).length, 1);
  assert.deepEqual(sampleFunction(expression('x'), 1, -1), []);
});

test('interval bounds cover extrema and reject possible singularities', () => {
  assert.deepEqual(functionInterval(expression('x^2'), -2, 3), [0, 9]);
  assert.deepEqual(functionInterval(expression('x^3'), -2, 3), [-8, 27]);
  assert.deepEqual(functionInterval(expression('abs(x)'), -2, 3), [0, 3]);
  assert.equal(functionInterval(expression('1/x'), -1, 1), null);
  assert.equal(functionInterval(expression('sqrt(x)'), -1, 1), null);
  assert.equal(functionInterval(expression('tan(x)'), 1, 2), null);
  near(functionInterval(expression('sin(x)'), 0, Math.PI)[1], 1);
  near(functionInterval(expression('cos(x)'), 0, Math.PI)[0], -1);
});

test('slope estimates converge on known derivatives and reject corners, poles and endpoints', () => {
  near(numericalSlope(expression('x^2'), 3).value, 6);
  near(numericalSlope(expression('sin(x)'), 0, .001).value, 1, 1e-6);
  near(numericalSlope(expression('3*x+1'), 2).value, 3);
  const coarse = numericalSlope(expression('x^3'), 1, .01), fine = numericalSlope(expression('x^3'), 1, .001);
  assert.ok(fine.difference < coarse.difference);
  for (const source of ['abs(x)', '.001*abs(x)', '1/x', 'sqrt(x)', 'ln(x)']) assert.equal(numericalSlope(expression(source), 0), null, source);
  assert.equal(numericalSlope(expression('x'), 1, 0), null);
});

test('signed integrals handle cancellation, reversal, zero width and convergence', () => {
  near(numericalIntegral(expression('3'), 0, 4).value, 12);
  near(numericalIntegral(expression('x'), -2, 2).value, 0);
  near(numericalIntegral(expression('abs(x)'), -2, 2).value, 4);
  near(numericalIntegral(expression('2*x'), 1, 3).value, 8);
  near(numericalIntegral(expression('3'), 2, 0).value, -6);
  near(numericalIntegral(expression('x^2'), 0, 2, 256).value, 8/3, 1e-5);
  const coarse = numericalIntegral(expression('x^2'), 0, 1, 8), fine = numericalIntegral(expression('x^2'), 0, 1, 64);
  assert.ok(fine.difference < coarse.difference);
  assert.equal(numericalIntegral(expression('x'), 1, 1).value, 0);
});

test('integral checks detect off-grid poles instead of showing a false finite result', () => {
  for (const source of ['1/x', '1/(x-.12345)', '1/(x-.12345)^2', '(x^2-1)/(x-1)', 'ln(x)', 'sqrt(x)', 'tan(2*x)']) assert.equal(numericalIntegral(expression(source), -2, 2), null, source);
  assert.equal(numericalIntegral(expression('1/x'), 0, 0), null);
  assert.equal(numericalIntegral(expression('x'), 0, 10001), null);
  assert.equal(numericalIntegral(expression('x'), 0, 1, 0), null);
  near(numericalIntegral(expression('1/(x^2+1)'), -1, 1, 256).value, Math.PI/2, 1e-5);
});

test('two complete courses have valid routes, examples, graphs and independently audited exact answers', () => {
  assert.equal(getPathLessons('math', 'algebra-functions').length, 5);
  assert.equal(getPathLessons('math', 'calculus').length, 7);
  assert.equal(new Set(learningLessons.map(lesson => lesson.id)).size, learningLessons.length);
  const expected = [[7,-3,12],[30,'9/2',3],['1/8',9,3],[8,2,-3],[4,2,3],[6,3,4],[10,24,'1/4'],[12,0,4],[5,9,4],['8/3',8,-6],[2,2,3],[4,2,'3/8']];
  for (const [index, activity] of advancedMathActivities.entries()) {
    const lesson = advancedMathLessons[index]; assert.equal(learningLessons.find(item => item.id === lesson.id), lesson);
    assert.ok(lesson.route.endsWith('/'+activity.id)); assert.equal(mathExerciseIds.get(activity.id).size, 3);
    assert.ok(activity.check && activity.learn.length >= 2 && activity.example.verification);
    const node = expression(activity.graph.formula); assert.ok(sampleFunction(node, activity.graph.xMin ?? -5, activity.graph.xMax ?? 5).flat().length);
    if (activity.graph.compare) expression(activity.graph.compare);
    activity.practice.forEach((question, j) => { assert.equal(gradeMathAnswer(question.answer, String(expected[index][j])), 'correct', activity.id+'/'+question.id); assert.ok(question.notation && question.hint && question.solution && question.verification); });
  }
  assert.equal(toolApps.find(item => item.id === 'function-plotter').status, 'available');
});

test('new solved exercises survive reload, reject unknown IDs and remain isolated per account', () => {
  const entries = new Map(), port = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const store = createLearningToolsStore(port);
  store.recordSolvedExercise('alice', 'derivative-rules', 'p2'); store.recordSolvedExercise('alice', 'derivative-rules', 'fake');
  store.recordSolvedExercise('alice', 'equations-inequalities', 'p1');
  const restored = createLearningToolsStore(port);
  assert.deepEqual(restored.read('alice').solvedExercises, {'derivative-rules':['p2'], 'equations-inequalities':['p1']});
  assert.deepEqual(restored.read('bob').solvedExercises, {}); assert.deepEqual(restored.read('guest').solvedExercises, {});
  store.resetLessonExercises('alice','derivative-rules'); assert.deepEqual(store.read('alice').solvedExercises['derivative-rules'], undefined);
  assert.deepEqual(store.read('alice').solvedExercises['equations-inequalities'], ['p1']);
});
