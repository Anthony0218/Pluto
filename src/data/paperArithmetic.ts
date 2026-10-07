export type PaperProblem = { a: number; b: number; operation: "add" | "subtract" };
export type PaperStep = { column: number; top: number[]; carries: number[]; digits: string[]; borrowedFrom: number | null; value: number };

/** Base-ten exchanges, including borrowing through any run of zeros. */
export function paperCalculation(problem: PaperProblem) {
  const { a, b, operation } = problem;
  if (![a, b].every(value => Number.isInteger(value) && value >= 0 && value <= 9999) || !["add", "subtract"].includes(operation) || (operation === "subtract" && a < b)) throw new RangeError("Expected whole numbers from 0 to 9999 and a nonnegative difference");
  const result = operation === "add" ? a + b : a - b;
  const width = Math.max(String(a).length, String(b).length, String(result).length);
  const original = String(a).padStart(width, "0").split("").map(Number);
  const bottom = String(b).padStart(width, "0").split("").map(Number);
  const top = [...original], carries = Array<number>(width).fill(0), digits = Array<string>(width).fill("");
  const steps: PaperStep[] = [];
  for (let column = width - 1; column >= 0; column--) {
    let borrowedFrom: number | null = null;
    if (operation === "subtract" && top[column] < bottom[column]) {
      let donor = column - 1;
      while (top[donor] === 0) { top[donor] = 9; donor--; }
      top[donor]--;
      top[column] += 10;
      borrowedFrom = donor;
    }
    const value = operation === "add" ? top[column] + bottom[column] + carries[column] : top[column] - bottom[column];
    digits[column] = String(value % 10);
    if (operation === "add" && column > 0) carries[column - 1] = Math.floor(value / 10);
    steps.push({ column, top: [...top], carries: [...carries], digits: [...digits], borrowedFrom, value });
  }
  return { width, original, bottom, top, carries, digits, result, steps };
}

/** Blank carry marks mean zero; blank regrouping marks keep the original digit. */
export function gradePaperWork(problem: PaperProblem, marks: string[], digits: string[]): "correct" | "incorrect" | "invalid" {
  const expected = paperCalculation(problem);
  if (marks.length !== expected.width || digits.length !== expected.width || digits.some(value => !/^\d$/.test(value)) || marks.some(value => !/^\d{0,2}$/.test(value))) return "invalid";
  const actualMarks = marks.map((value, index) => value === "" ? problem.operation === "add" ? 0 : expected.original[index] : Number(value));
  const expectedMarks = problem.operation === "add" ? expected.carries : expected.top;
  return Number(digits.join("")) === expected.result && actualMarks.every((value, index) => value === expectedMarks[index]) ? "correct" : "incorrect";
}
