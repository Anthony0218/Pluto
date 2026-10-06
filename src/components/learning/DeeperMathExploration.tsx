import { useId, useState } from 'react';
import type { DeeperMathActivity } from '@/data/deeperMath';
import { atLeastOne, binomialDistribution, conditionalProbability, determinant2, geometricSeries, parseDataset, proportionUncertainty, residual2, sequenceTerm, simulateAtLeastOne, solveIntegerSystem, summarizeDataset, transformVector, type Matrix2, type Vector2 } from '@/data/deeperMathCalculations';
import { ui, useUiLanguage } from '@/i18n/ui';
import FunctionPlotter from '@/components/tools/FunctionPlotter';
import './deeperMath.css';
const fmt = (value: number) => Number(value.toPrecision(7)).toString();
const pair = (v: Vector2) => `(${fmt(v[0])}, ${fmt(v[1])})`;
function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="mf-slider"><span>{ui(label)}<strong>{fmt(value)}</strong></span><input aria-label={ui(label)} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}
function Results({ rows }: { rows: [string, string][] }) {
  return <dl className="dm-results">{rows.map(([label,value]) => <div key={label}><dt>{ui(label)}</dt><dd>{value}</dd></div>)}</dl>;
}
function VectorDiagram({ input, output }: { input: Vector2; output: Vector2 }) {
  const id = useId();
  const bound = Math.max(6, ...input.map(Math.abs), ...output.map(Math.abs)) * 1.2;
  const pos = (v: Vector2) => [160+v[0]*140/bound, 160-v[1]*140/bound];
  const p = pos(input), q = pos(output);
  return <figure><svg className="dm-diagram" viewBox="0 0 320 320" role="img" aria-label={`${ui('Original vector')}: ${pair(input)}; ${ui('Result vector')}: ${pair(output)}`}>
    <defs><marker id={id} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="context-stroke" /></marker></defs>
    <path d="M20 160H300 M160 20V300" stroke="#7585b1" /><text x="300" y="154" fill="#a7b3ca">x</text><text x="170" y="25" fill="#a7b3ca">y</text>
    <line x1="160" y1="160" x2={p[0]} y2={p[1]} stroke="#c4b5fd" strokeWidth="3" markerEnd={`url(#${id})`} />
    <line x1="160" y1="160" x2={q[0]} y2={q[1]} stroke="#6ee7b7" strokeWidth="2" strokeDasharray="6 3" markerEnd={`url(#${id})`} />
    <circle cx="160" cy="160" r="3" fill="#fff" />
  </svg><figcaption>{ui('Original vector')} <span className="dm-original">{pair(input)}</span> · {ui('Result vector')} <span className="dm-result">{pair(output)}</span></figcaption></figure>;
}
function LinearExploration({ mode }: { mode: DeeperMathActivity['exploration'] }) {
  const [x,setX] = useState(mode === 'eigen' ? 1 : 3), [y,setY] = useState(mode === 'eigen' ? 0 : 2);
  const [a,setA] = useState(mode === 'systems' || mode === 'residuals' ? 1 : 2), [b,setB] = useState(mode === 'systems' || mode === 'residuals' ? 1 : 0);
  const [c,setC] = useState(mode === 'systems' || mode === 'residuals' ? 2 : 0), [d,setD] = useState(mode === 'systems' || mode === 'residuals' ? 1 : 3);
  const [e,setE] = useState(7), [f,setF] = useState(11), [vx,setVx] = useState(2), [vy,setVy] = useState(-1);
  const [transformation,setTransformation] = useState('rotation');
  const matrix: Matrix2 = mode === 'transformations' ? transformation === 'rotation' ? [[0,-1],[1,0]] : transformation === 'reflection' ? [[-1,0],[0,1]] : transformation === 'shear' ? [[1,1],[0,1]] : [[2,0],[0,3]] : [[a,b],[c,d]];
  const vector: Vector2 = [x,y], target: Vector2 = [e,f];
  const output: Vector2 = mode === 'vectors' ? [x+vx,y+vy] : transformVector(matrix,vector)!;
  const system = solveIntegerSystem(matrix,target)!;
  const residual = residual2(matrix,vector,target)!;
  const isEigen = (x !== 0 || y !== 0) && x*output[1] === y*output[0];
  const lambda = isEigen ? (x*output[0]+y*output[1])/(x*x+y*y) : null;
  return <section className="mf-activity"><h3>{ui('Change coordinates and predict the result')}</h3>
    {mode === 'transformations' && <div className="mf-mode" role="group" aria-label={ui('Geometric transformations')}>{[['rotation','Quarter-turn'],['reflection','Reflection'],['shear','Shear'],['stretch','Stretch']].map(([id,label]) => <button key={id} type="button" aria-pressed={transformation === id} onClick={() => setTransformation(id)}>{ui(label)}</button>)}</div>}
    {mode !== 'vectors' && <>
      <p className="mf-notation">A = [[{matrix[0].join(', ')}], [{matrix[1].join(', ')}]]</p>
      {mode !== 'transformations' && <div className="mf-controls"><Range label="a" value={a} min={-5} max={5} onChange={setA} /><Range label="b" value={b} min={-5} max={5} onChange={setB} /><Range label="c" value={c} min={-5} max={5} onChange={setC} /><Range label="d" value={d} min={-5} max={5} onChange={setD} /></div>}
    </>}
    <div className="mf-controls"><Range label="x" value={x} min={-5} max={5} onChange={setX} /><Range label="y" value={y} min={-5} max={5} onChange={setY} />{mode === 'vectors' && <><Range label="vₓ" value={vx} min={-5} max={5} onChange={setVx} /><Range label="vᵧ" value={vy} min={-5} max={5} onChange={setVy} /></>}</div>
    <VectorDiagram input={vector} output={output} />
    <Results rows={mode === 'vectors' ? [['u + v',pair(output)],['|u|',fmt(Math.hypot(x,y))]] : [['Au',pair(output)],['ad − bc',fmt(determinant2(matrix))]]} />
    {(mode === 'systems' || mode === 'residuals') && <><div className="mf-controls"><Range label="b₁" value={e} min={-20} max={20} onChange={setE} /><Range label="b₂" value={f} min={-20} max={20} onChange={setF} /></div><p className="mf-notation">{a}x + {b}y = {e}; {c}x + {d}y = {f}</p><Results rows={[[ui('Candidate residual'),pair(residual)],[ui('System solution'),system.kind === 'unique' ? pair(system.vector) : ui(system.kind === 'none' ? 'No solution' : 'Infinitely many solutions')],...(system.kind === 'unique' ? [[ui('Computed residual'),pair(system.residual)] as [string,string]] : [])]} /><p>{ui('The sliders test a candidate. The computed solution uses both original equations; displayed decimals are rounded.')}</p></>}
    {mode === 'eigen' && <p className="mf-verification">{ui(lambda === null ? 'This nonzero direction is not an eigenvector, or the input is the zero vector.' : 'This is an eigenvector direction.')}{lambda !== null && ` λ = ${fmt(lambda)}; Av = λv`}</p>}
    <p>{ui('Coordinates are abstract units. Compare direction, length, and determinant before and after each change.')}</p>
  </section>;
}
function SequenceExploration({ series }: { series: boolean }) {
  const [count,setCount] = useState(12), [kind,setKind] = useState<'reciprocal'|'alternating'|'geometric'>('reciprocal'), [ratio,setRatio] = useState(.5), [harmonic,setHarmonic] = useState(false), [epsilon,setEpsilon] = useState(.2);
  const sum = geometricSeries(1,ratio,count)!;
  const values = Array.from({length:count},(_,i) => series ? harmonic ? Array.from({length:i+1},(_,j) => 1/(j+1)).reduce((a,b) => a+b,0) : geometricSeries(1,ratio,i+1)!.partial : sequenceTerm(kind,i+1)!);
  const low = Math.min(-epsilon,0,...values), high = Math.max(epsilon,1,...values), height = high-low || 1;
  const py = (v: number) => 160-(v-low)*140/height;
  return <section className="mf-activity"><h3>{ui(series ? 'Partial sums and their limits' : 'Terms, limits, and tolerance')}</h3>
    <div className="mf-mode" role="group" aria-label={ui(series ? 'Series model' : 'Sequence model')}>{series ? <><button type="button" aria-pressed={!harmonic} onClick={() => setHarmonic(false)}>{ui('Geometric series')}</button><button type="button" aria-pressed={harmonic} onClick={() => setHarmonic(true)}>{ui('Harmonic series')}</button></> : (['reciprocal','alternating','geometric'] as const).map(id => <button type="button" key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>{id === 'reciprocal' ? '1/n' : id === 'alternating' ? '(−1)ⁿ' : '1/2ⁿ'}</button>)}</div>
    <div className="mf-controls"><Range label="Number of terms" value={count} min={1} max={200} onChange={setCount} />{series ? !harmonic && <Range label="Ratio r" value={ratio} min={-.95} max={.95} step={.05} onChange={setRatio} /> : <Range label="Tolerance ε" value={epsilon} min={.01} max={.5} step={.01} onChange={setEpsilon} />}</div>
    <svg className="dm-sequence" viewBox="0 0 520 185" role="img" aria-label={ui(series ? 'Partial sums by term number' : 'Sequence values by term number')}>
      {!series && <rect x="20" y={py(epsilon)} width="480" height={py(-epsilon)-py(epsilon)} fill="#6ee7b719" />}
      <path d={`M20 ${py(0)} H500 M20 20 V165`} stroke="#7585b1" />
      {values.map((v,i) => <circle key={i} cx={20+(i+1)*480/count} cy={py(v)} r={count > 80 ? 1.5 : 3} fill="#c4b5fd" />)}
      <text x="490" y="180" fill="#a7b3ca">n</text>
    </svg>
    <Results rows={series ? [['N',String(count)],['Sₙ',fmt(values.at(-1)!)],...(!harmonic ? [['L',fmt(sum.limit)],['L − Sₙ',fmt(sum.remainder)]] as [string,string][] : [])] : [['n',String(count)],['aₙ',fmt(values.at(-1)!)],['|aₙ| < ε',ui(Math.abs(values.at(-1)!) < epsilon ? 'Yes' : 'No')]]} />
    <p className="mf-verification">{ui(series ? harmonic ? 'Grouping harmonic terms into blocks shows that partial sums keep growing, even as individual terms shrink.' : 'For |r| < 1, the exact remainder is rᴺ/(1 − r). Negative ratios alternate around the limit.' : kind === 'alternating' ? 'Alternating between −1 and 1 stays bounded but does not converge.' : 'The shaded band is ±ε around zero. The formula gives a threshold after which every term stays inside it.')}</p>
    {series && harmonic && <p className="mf-notation">S(2n) − S(n) ≥ n/(2n) = 1/2<br />S(2ᵐ) ≥ 1 + m/2 → ∞</p>}
    {!series && kind !== 'alternating' && <p className="mf-notation">{kind === 'reciprocal' ? 'n > 1/ε ⇒ 1/n < ε' : 'n > log₂(1/ε) ⇒ 1/2ⁿ < ε'}</p>}
    <p>{ui('The drawing shows finitely many values. Convergence requires a statement about all sufficiently late terms.')}</p>
  </section>;
}
function AnalysisExploration({ mode }: { mode: DeeperMathActivity['exploration'] }) {
  const [level,setLevel] = useState(2), [validDelta,setValidDelta] = useState(true);
  const h = 10**(-level), epsilon = h, delta = validDelta ? epsilon/2 : epsilon;
  if (mode === 'sequences' || mode === 'series') return <SequenceExploration series={mode === 'series'} />;
  return <>
    <section className="mf-activity"><h3>{ui(mode === 'proof' ? 'From tolerance to a guarantee' : 'Approach from both sides')}</h3><Range label="Refinement level" value={level} min={1} max={5} onChange={setLevel} />
      {mode === 'proof' ? <><div className="mf-mode" role="group" aria-label="δ"><button type="button" aria-pressed={validDelta} onClick={() => setValidDelta(true)}>δ = ε/2</button><button type="button" aria-pressed={!validDelta} onClick={() => setValidDelta(false)}>δ = ε</button></div><Results rows={[["ε",fmt(epsilon)],["δ",fmt(delta)],["2δ",fmt(2*delta)]]} /><p className="mf-notation">f(x) = 2x; a = 3; L = 6<br />|f(x) − 6| = 2|x − 3|</p><p className="mf-verification">{ui(validDelta ? 'With δ = ε/2, every permitted input satisfies the output tolerance. The inequality proves it for all positive ε.' : 'With δ = ε, take x = 3 + 3ε/4. The input is inside δ, but the output error is 3ε/2, which exceeds ε.')}</p></> : <><Results rows={mode === 'boundaries' ? [['h',fmt(h)],['(f(−h) − f(0))/(−h)','−1'],['(f(h) − f(0))/h','1']] : [['h',fmt(h)],['f(1 − h)',fmt(2-h)],['f(1 + h)',fmt(2+h)],['L','2']]} /><p>{ui(mode === 'boundaries' ? 'The values of |x| approach zero from both sides, but the two slopes disagree. Continuity does not imply differentiability.' : 'For x ≠ 1 the formula equals x + 1. Both sides approach 2, while the original function is undefined at 1.')}</p></>}
    </section>
    {mode !== 'proof' && <FunctionPlotter initial={mode === 'boundaries' ? {formula:'abs(x)',mode:'slope',x:0,xMin:-2,xMax:2,yMin:-1,yMax:3} : {formula:'(x^2-1)/(x-1)',compare:'x+1',x:1,xMin:0,xMax:2,yMin:0,yMax:4}} />}
  </>;
}
function ProbabilityExploration({ mode }: { mode: DeeperMathActivity['exploration'] }) {
  const [group,setGroup] = useState(50), [percent,setPercent] = useState(60), [otherPercent,setOtherPercent] = useState(20);
  const [n,setN] = useState(3), [p,setP] = useState(.5), [repeats,setRepeats] = useState(1000), [seed,setSeed] = useState(42);
  const [source,setSource] = useState('2 4 6'), [count,setCount] = useState(100), [successRate,setSuccessRate] = useState(50), [randomSample,setRandomSample] = useState(true), [baseline,setBaseline] = useState(0);
  const dataId = useId();
  const data = parseDataset(source), summary = data ? summarizeDataset(data) : null;
  const successes = Math.round(count*successRate/100), uncertainty = proportionUncertainty(successes,count)!;
  const distribution = binomialDistribution(n,p)!;
  const simulation = simulateAtLeastOne(p,n,repeats,seed)!;
  const both = Math.round(group*percent/100), others = Math.round((100-group)*otherPercent/100);
  return <section className="mf-activity"><h3>{ui('Compare data with the model')}</h3>
    {mode === 'conditional' && <><p>{ui('Imagine 100 days. B means rain and A means carrying an umbrella. Change the counts and compare the conditional probabilities.')}</p><div className="mf-controls"><Range label="Rainy days" value={group} min={0} max={100} onChange={setGroup} /><Range label="Umbrella use on rainy days (%)" value={percent} min={0} max={100} onChange={setPercent} /><Range label="Umbrella use on dry days (%)" value={otherPercent} min={0} max={100} onChange={setOtherPercent} /></div><div className="dm-table-wrap"><table className="dm-table"><caption>{ui('Counts out of 100 days')}</caption><thead><tr><th scope="col">{ui('Days')}</th><th scope="col">{ui('Umbrella')}</th><th scope="col">{ui('No umbrella')}</th></tr></thead><tbody><tr><th scope="row">{ui('Rain')}</th><td>{both}</td><td>{group-both}</td></tr><tr><th scope="row">{ui('No rain')}</th><td>{others}</td><td>{100-group-others}</td></tr></tbody></table></div><Results rows={[["P(A|B)",group ? fmt(conditionalProbability(both,group)!) : ui('Undefined: empty group')],["P(B|A)",both+others ? fmt(conditionalProbability(both,both+others)!) : ui('Undefined: empty group')],["P(A ∩ B)",fmt(both/100)]]} /><p>{ui('Counts are rounded to whole days. Both conditional probabilities use those counts and their own denominator.')}</p></>}
    {(mode === 'distribution' || mode === 'simulation') && <><div className="mf-controls"><Range label="Trials per experiment" value={n} min={1} max={20} onChange={setN} /><Range label="Success probability p" value={p} min={0} max={1} step={.05} onChange={setP} /></div><p>{ui('This model assumes independent trials with the same success probability.')}</p>{mode === 'distribution' ? <><div className="dm-bars" role="img" aria-label={ui('Binomial probabilities by success count')}>{distribution.map((value,k) => <div key={k}><span>{k}</span><i style={{width:`${value*100}%`}} /><strong>{fmt(value)}</strong></div>)}</div><Results rows={[["Σ P(X = k)",fmt(distribution.reduce((a,b) => a+b,0))],["E[X] = np",fmt(n*p)],["Var(X) = np(1 − p)",fmt(n*p*(1-p))]]} /></> : <><Range label="Number of experiments" value={repeats} min={100} max={10000} step={100} onChange={setRepeats} /><button type="button" className="lt-button mf-next" onClick={() => setSeed((seed+1) >>> 0)}>{ui('Run with another seed')}</button><Results rows={[["P(X ≥ 1) = 1 − (1 − p)ⁿ",fmt(atLeastOne(p,n)!)],[ui('Simulation estimate'),`${simulation.successes}/${repeats} = ${fmt(simulation.estimate)}`],[ui('Absolute difference'),fmt(Math.abs(simulation.estimate-simulation.exact))],[ui('Model standard error'),fmt(simulation.standardError)],[ui('Seed'),String(seed)]]} /><p>{ui('The seed makes a run reproducible. More experiments usually reduce fluctuation; they do not guarantee a closer answer on every run.')}</p></>}</>}
    {mode === 'data' && <><label className="dm-data-label" htmlFor={dataId}>{ui('Your data: separate values with spaces or semicolons')}</label><textarea id={dataId} className="dm-data-input" rows={3} maxLength={2000} value={source} aria-invalid={!summary} aria-describedby={`${dataId}-note`} onChange={event => setSource(event.target.value)} /><p id={`${dataId}-note`}>{ui('Use up to 100 numbers between −1000000 and 1000000. Decimal points or commas are accepted; thousands separators and expressions are not.')}</p>{summary ? <Results rows={[[ui('Mean'),fmt(summary.mean)],[ui('Median'),fmt(summary.median)],[ui('Range'),fmt(summary.range)],[ui('Population variance'),fmt(summary.populationVariance)],[ui('Sample variance'),summary.sampleVariance === null ? ui('Needs at least two values') : fmt(summary.sampleVariance)],[ui('Population standard deviation'),fmt(summary.standardDeviation)]]} /> : <p role="status">{ui('Enter a valid dataset to see the statistics.')}</p>}<button type="button" className="lt-button" onClick={() => setSource(source === '2 4 6' ? '2 4 60' : '2 4 6')}>{ui('Compare an outlier')}</button></>}
    {mode === 'sampling' && <><div className="mf-controls"><Range label="Sample size" value={count} min={20} max={2000} step={20} onChange={setCount} /><Range label="Observed success rate (%)" value={successRate} min={0} max={100} onChange={setSuccessRate} /></div><div className="mf-mode" role="group" aria-label={ui('Sampling method')}><button type="button" aria-pressed={randomSample} onClick={() => setRandomSample(true)}>{ui('Independent random sample')}</button><button type="button" aria-pressed={!randomSample} onClick={() => setRandomSample(false)}>{ui('Convenience sample')}</button></div><Results rows={[["p̂",`${successes}/${count} = ${fmt(uncertainty.proportion)}`],[ui('Approximate standard error'),fmt(uncertainty.standardError)],[ui('Approximate 95% interval'),randomSample && uncertainty.interval ? uncertainty.interval.map(fmt).join(' … ') : ui('Not justified for this sample')]]} /><p>{ui('The normal approximation requires at least ten successes and ten failures. Selection bias and dependent observations are outside this calculation.')}</p><p>{ui(randomSample ? 'Across repeated valid samples, about 95% of intervals from this procedure cover the fixed population proportion.' : 'A larger convenience sample can still be biased. Its formula-based standard error does not measure that bias.')}</p></>}
    {mode === 'charts' && <><p>{ui('Both charts describe the same change from 40 to 50. Change the baseline and compare bar lengths with actual values.')}</p><Range label="Bar-axis baseline" value={baseline} min={0} max={39} onChange={setBaseline} /><div className="dm-chart-pair">{[0,baseline].map((base,i) => <figure key={i}><figcaption>{ui('Baseline')}: {base}</figcaption><svg viewBox="0 0 220 190" role="img" aria-label={`${ui('Baseline')}: ${base}; 40 → 50`}><line x1="35" y1="155" x2="210" y2="155" stroke="#a7b3ca" /><text x="4" y="160" fill="#a7b3ca">{base}</text><text x="4" y="25" fill="#a7b3ca">60</text>{[40,50].map((value,j) => <g key={j}><rect x={60+j*80} y={155-(value-base)*130/(60-base)} width="45" height={(value-base)*130/(60-base)} fill={j ? '#6ee7b7' : '#c4b5fd'} /><text x={70+j*80} y="180" fill="#a7b3ca">{value}</text></g>)}</svg></figure>)}</div><Results rows={[[ui('Absolute change'),'10'],[ui('Relative change'),'25%'],[ui('Displayed bar-length ratio'),fmt((50-baseline)/(40-baseline))],[ui('Actual value ratio'),'1.25']]} /><p>{ui('A truncated bar axis magnifies the visual ratio. Read the labeled values and baseline before drawing a conclusion.')}</p></>}
  </section>;
}
export default function DeeperMathExploration({ activity }: { activity: DeeperMathActivity }) {
  useUiLanguage();
  if (activity.pathId === 'linear-algebra') return <LinearExploration mode={activity.exploration} />;
  if (activity.pathId === 'analysis') return <AnalysisExploration mode={activity.exploration} />;
  return <ProbabilityExploration mode={activity.exploration} />;
}
