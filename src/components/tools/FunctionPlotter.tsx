import { useId, useMemo, useState } from 'react';
import { evaluateFunction, numericalIntegral, numericalSlope, parseFunction, sampleFunction } from '@/data/functionMath';
import { decimalInput } from '@/data/practicalMath';
import { ui, useUiLanguage } from '@/i18n/ui';
import './practicalTools.css';
import './functionPlotter.css';
export type GraphSetup = { formula: string; compare?: string; mode?: 'graph' | 'slope' | 'area'; x?: number; from?: number; to?: number; xMin?: number; xMax?: number; yMin?: number; yMax?: number };
const display = (n: number | null | undefined) => n == null ? '—' : Math.abs(n) < 1e-10 ? '0' : Number(n.toPrecision(6)).toString();
const presets = ['2*x+3', 'x^2', 'x^3', 'sin(x)', 'sqrt(x)', '1/x', 'exp(x)', 'ln(x)'];
export default function FunctionPlotter({ initial = {} }: { initial?: Partial<GraphSetup> }) {
  useUiLanguage();
  const id = useId();
  const [formula, setFormula] = useState(initial.formula ?? 'x^2');
  const [compare, setCompare] = useState(initial.compare ?? '');
  const [mode, setMode] = useState(initial.mode ?? 'graph');
  const [bounds, setBounds] = useState([initial.xMin ?? -5, initial.xMax ?? 5, initial.yMin ?? -5, initial.yMax ?? 10].map(String));
  const [inspect, setInspect] = useState(String(initial.x ?? 1));
  const [h, setH] = useState('.01');
  const [areaBounds, setAreaBounds] = useState([String(initial.from ?? 0), String(initial.to ?? 2)]);
  const [intervals, setIntervals] = useState(32);
  const f = useMemo(() => parseFunction(formula), [formula]), g = useMemo(() => compare.trim() ? parseFunction(compare) : null, [compare]);
  const numericBounds = bounds.map(decimalInput), [xMin, xMax, yMin, yMax] = numericBounds;
  const validBounds = numericBounds.every(n => n !== null && Math.abs(n) <= 10000) && xMin! < xMax! && yMin! < yMax! && xMax! - xMin! >= .01 && yMax! - yMin! >= .01;
  const segments = useMemo(() => validBounds && f.expression ? sampleFunction(f.expression, xMin!, xMax!) : [], [validBounds, f, xMin, xMax]);
  const comparison = useMemo(() => validBounds && g?.expression ? sampleFunction(g.expression, xMin!, xMax!) : [], [validBounds, g, xMin, xMax]);
  const x = decimalInput(inspect), step = decimalInput(h), from = decimalInput(areaBounds[0]), to = decimalInput(areaBounds[1]);
  const y = f.expression && x !== null ? evaluateFunction(f.expression, x) : null;
  const gy = g?.expression && x !== null ? evaluateFunction(g.expression, x) : null;
  const slope = f.expression && x !== null && step !== null && mode === 'slope' ? numericalSlope(f.expression, x, step) : null;
  const integral = useMemo(() => f.expression && from !== null && to !== null && mode === 'area' ? numericalIntegral(f.expression, from, to, intervals) : null, [f, from, to, intervals, mode]);
  const px = (value: number) => 88 + (value - xMin!) / (xMax! - xMin!) * 588;
  const py = (value: number) => 340 - (value - yMin!) / (yMax! - yMin!) * 320;
  const points = (items: { x: number; y: number }[]) => items.map(p => `${px(p.x)},${py(p.y)}`).join(' ');
  const area = integral && f.expression && from !== null && to !== null ? Array.from({ length: intervals }, (_, i) => {
    const a = Math.min(from, to) + Math.abs(to - from) * i / intervals, b = Math.min(from, to) + Math.abs(to - from) * (i + 1) / intervals;
    const ya = evaluateFunction(f.expression!, a)!, yb = evaluateFunction(f.expression!, b)!;
    const cell = (left: number, right: number, yl: number, yr: number) => ({ points: points([{ x: left, y: 0 }, { x: left, y: yl }, { x: right, y: yr }, { x: right, y: 0 }]), negative: yl + yr < 0 });
    if (ya * yb < 0) { const crossing = a + (b - a) * -ya / (yb - ya); return [cell(a, crossing, ya, 0), cell(crossing, b, 0, yb)]; }
    return [cell(a, b, ya, yb)];
  }).flat() : [];
  const error = f.error ? ui('Use numbers, x, explicit operators, and the listed functions. Check parentheses.') : !validBounds ? ui('Use increasing axis bounds between −10000 and 10000, with a span of at least 0.01.') : null;
  const label = (key: string) => `${id}-${key}`;
  return <section className="pt-workbench fp-workbench" aria-labelledby={label('heading')}>
    <div className="fp-heading"><div><p className="lt-eyebrow">{ui('Explore a relationship')}</p><h3 id={label('heading')}>{ui('Function Plotter')}</h3></div><span className="lt-badge">{ui('Available now')}</span></div>
    <div className="pt-inputs"><label htmlFor={label('formula')}>f(x)<input id={label('formula')} value={formula} maxLength={200} spellCheck={false} autoComplete="off" aria-invalid={!!f.error} aria-describedby={label('syntax')} onChange={e => setFormula(e.target.value)} /></label><label htmlFor={label('compare')}>{ui('Compare with g(x), optional')}<input id={label('compare')} value={compare} maxLength={200} spellCheck={false} autoComplete="off" aria-invalid={!!g?.error} onChange={e => setCompare(e.target.value)} /></label></div>
    <details className="fp-help"><summary>{ui('Syntax and examples')}</summary><p id={label('syntax')}>{ui('Use * for multiplication and ^ for powers. Trigonometric inputs use radians. ln is the natural logarithm; log is base 10. Only real values are shown.')}</p><code>+ − * / ^ ( ) · x pi e · sin cos tan sqrt abs ln log exp</code><div className="fp-presets">{presets.map(value => <button type="button" className="lt-button" key={value} onClick={() => setFormula(value)}>{value}</button>)}</div></details>
    <div className="fp-mode" role="group" aria-label={ui('Graph view')}>{(['graph', 'slope', 'area'] as const).map(value => <button type="button" className="lt-button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{ui(value === 'graph' ? 'Graph' : value === 'slope' ? 'Slope' : 'Signed area')}</button>)}</div>
    <fieldset className="fp-window"><legend>{ui('Graph window')}</legend><div className="fp-bounds">{bounds.map((value, i) => <label key={i} htmlFor={label(`bound-${i}`)}>{['x min', 'x max', 'y min', 'y max'][i]}<input id={label(`bound-${i}`)} type="text" inputMode="decimal" value={value} maxLength={20} aria-invalid={!validBounds} onChange={e => setBounds(bounds.map((v, j) => i === j ? e.target.value : v))} /></label>)}</div><div className="fp-presets"><button type="button" className="lt-button" disabled={!validBounds || xMin! - (xMax! - xMin!) / 2 < -10000 || xMax! + (xMax! - xMin!) / 2 > 10000 || yMin! - (yMax! - yMin!) / 2 < -10000 || yMax! + (yMax! - yMin!) / 2 > 10000} onClick={() => setBounds([xMin! - (xMax! - xMin!) / 2, xMax! + (xMax! - xMin!) / 2, yMin! - (yMax! - yMin!) / 2, yMax! + (yMax! - yMin!) / 2].map(String))}>{ui('Zoom out')}</button><button type="button" className="lt-button" disabled={!validBounds || Math.min(xMax! - xMin!, yMax! - yMin!) < .02} onClick={() => { const cx = (xMin! + xMax!) / 2, cy = (yMin! + yMax!) / 2; setBounds([cx - (xMax! - xMin!) / 4, cx + (xMax! - xMin!) / 4, cy - (yMax! - yMin!) / 4, cy + (yMax! - yMin!) / 4].map(String)); }}>{ui('Zoom in')}</button><button type="button" className="lt-button" onClick={() => setBounds(['-5', '5', '-5', '10'])}>{ui('Reset view')}</button></div></fieldset>
    {error && <p className="pt-error" role="status">{error}</p>}{g?.error && <p className="pt-error" role="status">{ui('The comparison expression is invalid.')}</p>}
    {validBounds && <><figure className="fp-figure"><svg viewBox="0 0 700 390" role="img" aria-labelledby={`${label('title')} ${label('desc')}`}>
      <title id={label('title')}>{ui('Function graph')}: f(x) = {formula}{compare && `; g(x) = ${compare}`}</title><desc id={label('desc')}>{ui('Read coordinates with the inspection controls below. Gaps indicate undefined or unresolved intervals; a sampled graph cannot prove continuity.')}</desc>
      <defs><clipPath id={label('clip')}><rect x="88" y="20" width="588" height="320" /></clipPath></defs><rect className="fp-bg" x="88" y="20" width="588" height="320" />
      {Array.from({ length: 5 }, (_, i) => { const xx = xMin! + (xMax! - xMin!) * i / 4, yy = yMin! + (yMax! - yMin!) * i / 4; return <g key={i}><line className="fp-grid" x1={px(xx)} x2={px(xx)} y1="20" y2="340" /><line className="fp-grid" x1="88" x2="676" y1={py(yy)} y2={py(yy)} /><text x={px(xx)} y="364" textAnchor="middle">{display(xx)}</text><text x="79" y={py(yy) + 4} textAnchor="end">{display(yy)}</text></g>; })}
      <g clipPath={`url(#${label('clip')})`}>
        <line className="fp-axis" x1="88" x2="676" y1={py(0)} y2={py(0)} /><line className="fp-axis" y1="20" y2="340" x1={px(0)} x2={px(0)} />
        {area.map((cell, i) => <polygon key={i} points={cell.points} className={cell.negative ? 'fp-area negative' : 'fp-area'} />)}
        {segments.map((segment, i) => <polyline key={i} className="fp-curve" points={points(segment)} />)}{comparison.map((segment, i) => <polyline key={i} className="fp-curve comparison" points={points(segment)} />)}
        {slope && x !== null && y !== null && <line className="fp-tangent" x1={px(xMin!)} x2={px(xMax!)} y1={py(y + slope.value * (xMin! - x))} y2={py(y + slope.value * (xMax! - x))} />}
        {mode === 'slope' && x !== null && step !== null && f.expression && (() => { const a = evaluateFunction(f.expression, x - step), b = evaluateFunction(f.expression, x + step); return a !== null && b !== null ? <line className="fp-secant" x1={px(x - step)} y1={py(a)} x2={px(x + step)} y2={py(b)} /> : null; })()}
        {x !== null && y !== null && <circle className="fp-point" cx={px(x)} cy={py(y)} r="5" />}
      </g><text x="688" y="364">x</text><text x="35" y="13">y</text>
    </svg><figcaption><span className="fp-key">f(x)</span>{compare && <span className="fp-key comparison">g(x)</span>}{mode === 'slope' && <span className="fp-key tangent">{ui('Estimated tangent')}</span>}{mode === 'area' && <span>{ui('Green above zero; rose below zero.')}</span>}</figcaption></figure>
    {!segments.some(segment => segment.length > 1) && !f.error && <p className="pt-error">{ui('No connected real values in this window. Try another expression or range.')}</p>}
    <p className="mf-input-note">{ui('Curves are sampled. Very narrow features may be missed. Undefined intervals are left open.')}</p></>}
    <div className="pt-inputs"><div className="fp-inspect"><label htmlFor={label('inspect')}>{ui('Inspect at x')}<input id={label('inspect')} type="text" inputMode="decimal" value={inspect} maxLength={20} aria-invalid={x === null} onChange={e => setInspect(e.target.value)} /></label>{validBounds && <input aria-label={ui('Move inspection point')} type="range" min={xMin!} max={xMax!} step={(xMax! - xMin!) / 200} value={x !== null ? Math.min(xMax!, Math.max(xMin!, x)) : xMin!} onChange={e => setInspect(e.target.value)} />}</div>{mode === 'slope' && <label htmlFor={label('h')}>{ui('Secant step h')}<select id={label('h')} value={h} onChange={e => setH(e.target.value)}>{['1', '.1', '.01', '.001', '.0001'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}</div>
    <div className="fp-readings" aria-live="polite"><p>x = {display(x)} · f(x) = {display(y)}{compare && ` · g(x) = ${display(gy)}`}</p>{x !== null && y === null && !f.error && <p>{ui('The function is undefined or outside the numeric limits at this point.')}</p>}
      {mode === 'slope' && (slope ? <><p><strong>{ui('Estimated slope')}: {display(slope.value)}</strong></p><p>{ui('Central difference at h')}: {display(slope.coarse)} · {ui('Difference after halving h')}: {display(slope.difference)}</p><p className="pt-mono">[f(x+h) − f(x−h)] / (2h)</p></> : <p className="pt-error">{ui('No reliable two-sided slope here. Check the domain, corners, or try a smaller h.')}</p>)}
    </div>
    {mode === 'area' && <><div className="pt-inputs">{areaBounds.map((value, i) => <label key={i} htmlFor={label(`area-${i}`)}>{ui(i === 0 ? 'Integral from' : 'Integral to')}<input id={label(`area-${i}`)} type="text" inputMode="decimal" value={value} maxLength={20} aria-invalid={decimalInput(value) === null || Math.abs(decimalInput(value) ?? 0) > 10000} onChange={e => setAreaBounds(areaBounds.map((v, j) => i === j ? e.target.value : v))} /></label>)}<label htmlFor={label('resolution')}>{ui('Trapezoids')}<select id={label('resolution')} value={intervals} onChange={e => setIntervals(Number(e.target.value))}>{[8, 16, 32, 64, 128, 256].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div><div className="fp-readings" aria-live="polite">{integral ? <><strong>{ui('Estimated signed integral')} (n = {intervals * 2}): {display(integral.value)}</strong><p>{ui('Coarse estimate')} (n = {intervals}): {display(integral.coarse)} · {ui('Difference after doubling trapezoids')}: {display(integral.difference)}</p></> : <p className="pt-error">{ui('No estimate: the interval is invalid, undefined, or its continuity could not be established.')}</p>}</div></>}
    {mode !== 'graph' && <p className="mf-input-note">{ui('Numerical agreement is not a proof or an error bound. Signed integrals subtract contributions below zero; reversing the bounds reverses the sign.')}</p>}
  </section>;
}
