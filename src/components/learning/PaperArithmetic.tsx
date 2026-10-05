import { useId, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { paperCalculation, type PaperProblem, type PaperStep } from "@/data/paperArithmetic";
import { ui } from "@/i18n/ui";

const placeNames = ["Ten thousands", "Thousands", "Hundreds", "Tens", "Ones"];

export function PaperWorksheet({ problem, marks, digits, onMarks, onDigits, disabled = false, snapshot }: {
  problem: PaperProblem; marks?: string[]; digits?: string[]; onMarks?: (marks: string[]) => void; onDigits?: (digits: string[]) => void; disabled?: boolean; snapshot?: PaperStep;
}) {
  const id = useId();
  const calculation = paperCalculation(problem);
  const places = placeNames.slice(-calculation.width);
  const displayedMarks = snapshot ? problem.operation === "add" ? snapshot.carries.map(value => value || "") : snapshot.top.map((value, index) => value === calculation.original[index] ? "" : value) : marks ?? (problem.operation === "add" ? calculation.carries.map(value => value || "") : calculation.top.map((value, index) => value === calculation.original[index] ? "" : value));
  const result = snapshot?.digits ?? digits ?? calculation.digits;
  return <div className="mf-paper" style={{ "--paper-columns": calculation.width } as CSSProperties}>
    <div className="mf-paper-title">{ui("Place values")}</div>
    <div className="mf-paper-grid"><span />{places.map(place => <span className="mf-place" key={place}>{ui(place)}</span>)}</div>
    <div className="mf-paper-grid mf-paper-marks"><span className="mf-paper-label">{ui(problem.operation === "add" ? "Carry" : "Regroup")}</span>{places.map((place, index) => onMarks ? <input key={place} aria-label={`${ui(problem.operation === "add" ? "Carry" : "Regroup")} — ${ui(place)}`} inputMode="numeric" type="text" autoComplete="off" maxLength={2} disabled={disabled} value={marks?.[index] ?? ""} onChange={event => { const next = [...marks!]; next[index] = event.target.value; onMarks(next); }} /> : <span key={place} className="mf-paper-mark">{displayedMarks?.[index] ?? (problem.operation === "add" ? calculation.carries[index] || "" : calculation.top[index] === calculation.original[index] ? "" : calculation.top[index])}</span>)}</div>
    <div className="mf-paper-grid"><span />{calculation.original.map((digit, index) => <span className={problem.operation === "subtract" && displayedMarks?.[index] !== undefined && displayedMarks[index] !== "" && Number(displayedMarks[index]) !== digit ? "mf-crossed" : ""} key={index}>{digit}</span>)}</div>
    <div className="mf-paper-grid"><span className="mf-paper-operator">{problem.operation === "add" ? "+" : "−"}</span>{calculation.bottom.map((digit, index) => <span key={index}>{digit}</span>)}</div>
    <div className="mf-paper-grid mf-paper-answer"><span>=</span>{places.map((place, index) => onDigits ? <label key={place}><span className="sr-only">{ui("Answer")} — {ui(place)}</span><input id={`${id}-${index}`} inputMode="numeric" type="text" autoComplete="off" maxLength={1} disabled={disabled} value={digits?.[index] ?? ""} onChange={event => { const next = [...digits!]; next[index] = event.target.value; onDigits(next); }} /></label> : <span key={place}>{result[index] || "·"}</span>)}</div>
  </div>;
}

const examples: PaperProblem[] = [{ a: 47, b: 28, operation: "add" }, { a: 83, b: 37, operation: "subtract" }, { a: 302, b: 178, operation: "subtract" }];
function PaperExample({ problem }: { problem: PaperProblem }) {
  const [step, setStep] = useState(0);
  const calculation = paperCalculation(problem);
  const snapshot = step === 0 ? { column: calculation.width - 1, top: calculation.original, carries: Array(calculation.width).fill(0), digits: Array(calculation.width).fill(""), borrowedFrom: null, value: 0 } : calculation.steps[step - 1];
  const column = snapshot.column;
  return <>
    <div className="mf-paper-example"><PaperWorksheet problem={problem} snapshot={snapshot} />
      <div className="mf-paper-instruction" aria-live="polite" aria-atomic="true"><p className="lt-eyebrow">{ui("Step")} {step + 1} / {calculation.steps.length + 1}</p>
        <h4>{ui(step === 0 ? "Align the columns" : problem.operation === "add" ? "Add and carry" : snapshot.borrowedFrom !== null ? "Exchange before subtracting" : "Subtract this column")}</h4>
        <p>{ui(step === 0 ? "Put ones under ones and tens under tens. Start with the column on the right." : problem.operation === "add" ? "Add the two digits and any incoming carry. Write the ones digit below; carry the tens digit to the column on the left." : snapshot.borrowedFrom !== null ? snapshot.borrowedFrom < column - 1 ? "When the next column is zero, continue left until you can exchange a larger place value. Each exchange preserves the original number." : "Exchange one ten for ten ones. The amount stays the same; only its grouping changes." : "Subtract the bottom digit from the top digit, then move one column left.")}</p>
        {step > 0 && <div className="mf-paper-equation">{problem.operation === "add" ? `${calculation.original[column]} + ${calculation.bottom[column]}${snapshot.carries[column] ? ` + ${snapshot.carries[column]}` : ""} = ${snapshot.value}` : `${snapshot.top[column]} − ${calculation.bottom[column]} = ${snapshot.value}`}</div>}
        {snapshot.borrowedFrom !== null && <p className="mf-paper-equation">{problem.a} = {snapshot.top.map((digit, index) => digit * 10 ** (calculation.width - index - 1)).join(" + ")}</p>}
        {step === calculation.steps.length && <p className="mf-verification">{ui("Inverse check")}: {problem.operation === "add" ? `${calculation.result} − ${problem.b} = ${problem.a}` : `${calculation.result} + ${problem.b} = ${problem.a}`}</p>}
      </div>
    </div>
    <div className="mf-paper-controls"><button type="button" className="lt-button" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={14} aria-hidden />{ui("Previous step")}</button><button type="button" className="lt-button primary" disabled={step === calculation.steps.length} onClick={() => setStep(step + 1)}>{ui("Next step")}<ArrowRight size={14} aria-hidden /></button><button type="button" className="lt-text-link" disabled={step === 0} onClick={() => setStep(0)}>{ui("Start over")}</button></div>
  </>;
}

export function PaperArithmeticGuide() {
  const [example, setExample] = useState(0);
  return <section className="mf-activity" aria-labelledby="paper-guide-title"><p className="lt-eyebrow">{ui("On paper")}</p><h3 id="paper-guide-title">{ui("Calculate one column at a time")}</h3><p>{ui("Write numbers in columns by place value. The small marks above the numbers show a carry or a regrouping. Keep the columns aligned when you write the answer.")}</p>
    <div className="mf-mode" role="group" aria-label={ui("Written calculation examples")}>{["Addition", "Subtraction", "Borrowing through zero"].map((label, index) => <button type="button" key={label} aria-pressed={example === index} onClick={() => setExample(index)}>{ui(label)}</button>)}</div>
    <PaperExample key={example} problem={examples[example]} />
    <p>{ui("For decimals, line up the decimal separators and add trailing zeros if needed: 1.4 = 1.40.")}</p>
  </section>;
}

export function AdditionSubtractionVisual() {
  return <section className="mf-visual-intro" aria-labelledby="visual-intro-title"><h3 id="visual-intro-title">{ui("See what the operations mean")}</h3><div className="mf-visual-grid">
    <figure><figcaption><strong>{ui("Addition joins groups")}</strong><span>{ui("Five items and three more make eight.")}</span></figcaption><div className="mf-dot-model" aria-hidden><div>{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div><b>+</b><div className="mf-extra-dots">{Array.from({ length: 3 }, (_, index) => <i key={index} />)}</div></div><p className="mf-model-equation">5 + 3 = 8</p><p>{ui("Join both groups and count the total.")}</p></figure>
    <figure><figcaption><strong>{ui("Subtraction takes away")}</strong><span>{ui("Take three items from eight; five remain.")}</span></figcaption><div className="mf-dot-model" aria-hidden><div>{Array.from({ length: 8 }, (_, index) => <i className={index >= 5 ? "removed" : ""} key={index} />)}</div></div><p className="mf-model-equation">8 − 3 = 5</p><p>{ui("Cross out the removed items and count what remains.")}</p></figure>
  </div></section>;
}
