import type { LearningLesson } from "./learningCatalog.ts";
import type { PaperProblem } from "./paperArithmetic.ts";

export type FoundationId = "addition-subtraction" | "multiplication-division" | "negative-numbers" | "fractions-decimals" | "order-of-operations" | "estimation-checks";
export type MathExercise = { id: string; prompt: string; answer: string; hint: string; solution: string; verification: string; paper?: PaperProblem };
export type FoundationActivity = { id: FoundationId; example: { problem: string; steps: string[]; verification: string }; practice: MathExercise[]; checks: MathExercise[] };
const exercise = (id: string, prompt: string, answer: string, hint: string, solution: string, verification: string): MathExercise => ({ id, prompt, answer, hint, solution, verification });

export const foundationActivities: FoundationActivity[] = [
  {
    id: "addition-subtraction",
    example: { problem: "You have €28 and spend €9. How much remains?", steps: ["Split 9 into 8 + 1 to reach a round number first.", "28 − 8 = 20; then 20 − 1 = 19.", "You have €19 left."], verification: "Use the inverse: 19 + 9 = 28. The remaining money plus the spending restores the starting amount." },
    practice: [
      { ...exercise("p1", "47 + 28 = ?", "75", "7 + 8 = 15. Write 5 in the ones column and carry 1 into the tens column.", "7 + 8 = 15; 4 + 2 + 1 = 7. The result is 75.", "75 − 28 = 47. Also, 47 + 30 − 2 = 75."), paper: { a: 47, b: 28, operation: "add" } },
      { ...exercise("p2", "83 − 37 = ?", "46", "Exchange one ten for ten ones: 83 = 7 tens + 13 ones.", "13 − 7 = 6; 7 − 3 = 4. The result is 46.", "46 + 37 = 83."), paper: { a: 83, b: 37, operation: "subtract" } },
      exercise("p3", "A €50 note pays for €18.75 of groceries. What is the change in euros?", "31.25", "Align decimal places; think in cents if helpful.", "5,000 cents − 1,875 cents = 3,125 cents = €31.25.", "€31.25 + €18.75 = €50.00."),
      exercise("p4", "You walk 1.4 km, then 2.65 km. What is the total in km?", "4.05", "Write 1.4 as 1.40.", "1.40 + 2.65 = 4.05 km.", "4.05 − 2.65 = 1.40 km; a rough total is about 4 km."),
      exercise("p5", "Which number fills the gap: ? + 19 = 62", "43", "Undo addition with subtraction.", "62 − 19 = 43.", "43 + 19 = 62."),
      exercise("p6", "100 − 0 = ?", "100", "Subtracting nothing leaves the amount unchanged.", "100 − 0 = 100.", "100 + 0 = 100."),
      { ...exercise("p7", "376 + 248 = ?", "624", "6 + 8 = 14; then 7 + 4 + 1 = 12. Carry into the next column each time.", "6 + 8 = 14; 7 + 4 + 1 = 12; 3 + 2 + 1 = 6. The result is 624.", "624 − 248 = 376."), paper: { a: 376, b: 248, operation: "add" } },
      { ...exercise("p8", "302 − 178 = ?", "124", "Regroup through the zero: 302 = 2 hundreds + 9 tens + 12 ones.", "12 − 8 = 4; 9 − 7 = 2; 2 − 1 = 1. The result is 124.", "124 + 178 = 302."), paper: { a: 302, b: 178, operation: "subtract" } },
    ],
    checks: [
      exercise("c1", "Someone claims 64 − 28 = 46. Add their answer to 28. What total does this check produce?", "74", "A correct subtraction result would restore 64.", "46 + 28 = 74, so the claim fails. The correct answer is 36.", "36 + 28 = 64 exactly. This catches the mistake without repeating the subtraction."),
      exercise("c2", "Check 58 + 27 = 85 by a different decomposition: 60 + 25 = ?", "85", "Move 2 from 27 to 58; the sum stays the same.", "60 + 25 = 85.", "The compensation preserves the total; subtraction also confirms 85 − 27 = 58."),
    ],
  },
  {
    id: "multiplication-division",
    example: { problem: "Six boxes hold 14 bottles each. How many bottles are there?", steps: ["Split 14 into 10 + 4.", "6 × 10 = 60 and 6 × 4 = 24.", "60 + 24 = 84 bottles."], verification: "84 ÷ 6 = 14 bottles per box. Splitting the calculation uses the distributive law." },
    practice: [
      exercise("p1", "7 × 8 = ?", "56", "Try 7 × (5 + 3).", "35 + 21 = 56.", "56 ÷ 8 = 7."),
      exercise("p2", "96 ÷ 8 = ?", "12", "Split 96 into 80 + 16.", "80 ÷ 8 + 16 ÷ 8 = 10 + 2 = 12.", "12 × 8 = 96."),
      exercise("p3", "Three tickets cost €12.50 each. What is the total in euros?", "37.5", "Multiply €12 and €0.50 separately.", "3 × 12 + 3 × 0.50 = 36 + 1.50 = €37.50.", "€37.50 ÷ 3 = €12.50 per ticket."),
      exercise("p4", "Share 45 biscuits equally between 6 people. How many biscuits does each get if biscuits can be split?", "7.5", "Each gets 7 whole biscuits, with 3 left to share.", "45 ÷ 6 = 7 + 3/6 = 7.5.", "6 × 7.5 = 45; the extra half for each person uses all 3 remaining biscuits."),
      exercise("p5", "9 × 0 = ?", "0", "Nine groups containing nothing have no items.", "9 × 0 = 0.", "Repeated addition gives nine zeros. Do not divide by zero to check this case."),
      exercise("p6", "84 ÷ 1 = ?", "84", "Dividing into one group keeps everything together.", "84 ÷ 1 = 84.", "84 × 1 = 84."),
    ],
    checks: [
      exercise("c1", "Someone claims 72 ÷ 6 = 11. Multiply their answer by 6. What total does the check give?", "66", "A correct quotient would restore 72.", "11 × 6 = 66, so the claim is wrong. The quotient is 12.", "12 × 6 = 72 exactly."),
      exercise("c2", "Check 17 × 6 by splitting 17 into 10 + 7: 60 + 42 = ?", "102", "Combine the two partial products.", "60 + 42 = 102.", "102 ÷ 6 = 17. The split calculation confirms the same total."),
    ],
  },
  {
    id: "negative-numbers",
    example: { problem: "The temperature is −3 °C and falls by 5 °C. What is the new temperature?", steps: ["Start at −3 on the number line.", "A fall of 5 means subtract 5: move five units left.", "−3 − 5 = −8 °C."], verification: "Reverse the change: −8 + 5 = −3. Rising back by 5 restores the original temperature." },
    practice: [
      exercise("p1", "−4 + 9 = ?", "5", "Move nine units right from −4.", "Four units reach zero; the remaining five reach 5.", "5 − 9 = −4."),
      exercise("p2", "3 − 8 = ?", "-5", "Move eight units left from 3.", "3 − 8 = −5.", "−5 + 8 = 3."),
      exercise("p3", "−6 − (−4) = ?", "-2", "Subtracting a negative adds its opposite.", "−6 + 4 = −2.", "−2 + (−4) = −6."),
      exercise("p4", "−7 × 3 = ?", "-21", "Opposite signs give a negative product.", "7 × 3 = 21, so −7 × 3 = −21.", "−21 ÷ 3 = −7; adding −7 three times gives −21."),
      exercise("p5", "−24 ÷ (−6) = ?", "4", "Equal signs give a positive quotient.", "24 ÷ 6 = 4, so −24 ÷ (−6) = 4.", "4 × (−6) = −24."),
      exercise("p6", "A balance is −€12. A €20 deposit arrives. What is the new balance in euros?", "8", "Use 12 of the deposit to reach zero.", "−12 + 20 = 8.", "€8 − €20 = −€12. The deposit first clears the debt, then leaves €8."),
    ],
    checks: [
      exercise("c1", "Someone claims −5 − (−8) = −13. What is −13 + (−8), the inverse check?", "-21", "Undo subtraction by adding the original subtracted number, including its sign.", "−13 + (−8) = −21, which does not restore −5. The correct result is 3.", "3 + (−8) = −5; subtracting −8 means moving eight units right."),
      exercise("c2", "Check −4 × (−3) = 12: what is 12 ÷ (−3)?", "-4", "Use the original signed factor as the divisor.", "12 ÷ (−3) = −4.", "This restores the other factor. A positive result for the product is consistent with the sign rules."),
    ],
  },
  {
    id: "fractions-decimals",
    example: { problem: "A recipe uses 1/2 cup plus 1/4 cup. How much is that altogether?", steps: ["Use equal-sized parts: 1/2 = 2/4.", "2/4 + 1/4 = 3/4 cup.", "3 ÷ 4 = 0.75, so the amount is also 0.75 cup."], verification: "Subtract 1/4 from 3/4 to recover 2/4 = 1/2. The total is between half a cup and a full cup." },
    practice: [
      exercise("p1", "1/3 + 1/6 = ?", "1/2", "Convert thirds into sixths.", "1/3 = 2/6, so 2/6 + 1/6 = 3/6 = 1/2.", "1/2 − 1/6 = 3/6 − 1/6 = 2/6 = 1/3."),
      exercise("p2", "3/4 − 1/8 = ?", "5/8", "Convert quarters into eighths.", "3/4 = 6/8; 6/8 − 1/8 = 5/8.", "5/8 + 1/8 = 6/8 = 3/4."),
      exercise("p3", "2/3 × 3/4 = ?", "1/2", "Multiply numerators and denominators, then simplify.", "(2 × 3)/(3 × 4) = 6/12 = 1/2.", "(1/2) ÷ (3/4) = (1/2) × (4/3) = 2/3."),
      exercise("p4", "3/4 ÷ 1/2 = ?", "3/2", "Multiply by the reciprocal of 1/2.", "(3/4) × (2/1) = 6/4 = 3/2 = 1.5.", "(3/2) × (1/2) = 3/4. There are one and a half half-cups in three quarters of a cup."),
      exercise("p5", "0.2 + 0.35 = ?", "0.55", "Use hundredths: 0.2 = 20/100.", "20/100 + 35/100 = 55/100 = 0.55.", "0.55 − 0.35 = 0.20."),
      exercise("p6", "Write 7/4 as a decimal.", "1.75", "Split it into 4/4 + 3/4.", "7/4 = 1 + 0.75 = 1.75.", "1.75 × 4 = 7."),
    ],
    checks: [
      exercise("c1", "Someone adds 1/2 + 1/3 and gets 2/5. Use sixths to find the correct sum.", "5/6", "The pieces must be the same size before adding.", "1/2 = 3/6 and 1/3 = 2/6; the sum is 5/6.", "2/5 is smaller than 1/2, so it cannot be the sum of 1/2 and another positive amount. Also 5/6 − 1/3 = 1/2."),
      exercise("c2", "Check 0.125 = 1/8 by multiplication: 0.125 × 8 = ?", "1", "An eighth multiplied by eight should recover a whole.", "125/1000 × 8 = 1000/1000 = 1.", "This exact equality confirms the decimal conversion."),
    ],
  },
  {
    id: "order-of-operations",
    example: { problem: "Evaluate 3 + 2 × (8 − 5)².", steps: ["Parentheses first: 8 − 5 = 3.", "Powers next: 3² = 9.", "Multiply: 2 × 9 = 18. Then add: 3 + 18 = 21."], verification: "Replace the square with repeated multiplication: 3 + 2 × 3 × 3 = 3 + 18 = 21. This checks the power and the order." },
    practice: [
      exercise("p1", "6 + 4 × 3 = ?", "18", "Multiply before adding.", "4 × 3 = 12; 6 + 12 = 18.", "The expression means 6 plus three groups of 4, not three groups of 10."),
      exercise("p2", "(6 + 4) × 3 = ?", "30", "Parentheses change what gets grouped.", "6 + 4 = 10; 10 × 3 = 30.", "Distribute: 6 × 3 + 4 × 3 = 18 + 12 = 30."),
      exercise("p3", "24 ÷ 6 × 2 = ?", "8", "Division and multiplication have equal priority; work left to right.", "24 ÷ 6 = 4; 4 × 2 = 8.", "24 × (1/6) × 2 = 48/6 = 8. Writing 24 ÷ (6 × 2) would be a different expression."),
      exercise("p4", "10 − 3 + 2 = ?", "9", "Addition and subtraction also have equal priority.", "10 − 3 = 7; 7 + 2 = 9.", "10 + (−3) + 2 = 10 − 1 = 9."),
      exercise("p5", "2 + 3² × 2 = ?", "20", "Square 3 first, then multiply, then add.", "3² = 9; 9 × 2 = 18; 2 + 18 = 20.", "2 + 3 × 3 × 2 = 20."),
      exercise("p6", "(−3)² = ?", "9", "The entire signed number is inside the parentheses.", "(−3) × (−3) = 9.", "Compare −3² = −(3 × 3) = −9. Parentheses make these two expressions different."),
    ],
    checks: [
      exercise("c1", "Someone gets 20 for 2 + 3 × 4. What is the correct result?", "14", "The product is one term of the sum.", "3 × 4 = 12; 2 + 12 = 14.", "20 would be (2 + 3) × 4. Naming that different expression exposes the grouping error."),
      exercise("c2", "Check 5 × (10 − 2) by distributing: 50 − 10 = ?", "40", "Multiply each term inside the parentheses by 5.", "50 − 10 = 40, matching 5 × 8.", "Distribution is another valid evaluation of the same expression."),
    ],
  },
  {
    id: "estimation-checks",
    example: { problem: "Four items cost €19.80 each. Is €792 a plausible total?", steps: ["Round €19.80 to €20: 4 × €20 is about €80.", "€792 is far from €80, so it is implausible.", "Calculate exactly: 4 × (20 − 0.20) = 80 − 0.80 = €79.20."], verification: "€79.20 ÷ 4 = €19.80 confirms the total exactly. The estimate detects the decimal-place error but does not prove €79.20 by itself." },
    practice: [
      exercise("p1", "Round 198 and 403 to the nearest hundred. What is their estimated sum?", "600", "198 rounds to 200; 403 rounds to 400.", "200 + 400 = 600, an estimate of 198 + 403 = 601.", "The exact answer differs by 1; an estimate is not an exact equality."),
      exercise("p2", "Estimate 49 × 21 by rounding each factor to the nearest ten.", "1000", "Use 50 × 20.", "50 × 20 = 1,000; the exact product is 1,029.", "49 × (20 + 1) = 980 + 49 = 1,029. Being close supports the result; it does not prove it."),
      exercise("p3", "A total of €68 is shared equally by 4 people. What is each person's share in euros?", "17", "€80 ÷ 4 would be €20, so expect a bit less.", "68 ÷ 4 = €17.", "4 × €17 = €68 exactly; the estimate makes €170 implausible."),
      exercise("p4", "What number must be added to 38 to verify that 91 − 53 = 38?", "53", "Undo subtraction using the amount taken away.", "38 + 53 = 91, so add 53.", "The inverse operation restores the starting value exactly."),
      exercise("p5", "Two distances are 2.4 km and 750 m. What is the total in km?", "3.15", "Convert 750 m to 0.75 km before adding.", "2.4 + 0.75 = 3.15 km.", "2,400 m + 750 m = 3,150 m = 3.15 km. Recalculating in another unit confirms it."),
      exercise("p6", "Estimate €9.70 + €20.20 + €4.90 by rounding each price to the nearest whole euro.", "35", "Round to 10, 20, and 5.", "10 + 20 + 5 = €35; the exact total is €34.80.", "Rounding gives a quick budget check. €35 is an estimate, not the exact amount owed."),
    ],
    checks: [
      exercise("c1", "An estimate of 25 × 4 is about 100. Both 99 and 100 seem plausible. What exact inverse calculation, 99 ÷ 4, shows whether 99 is correct?", "24.75", "A correct total would give 25 when divided by 4.", "99 ÷ 4 = 24.75, not 25. The correct product is 100.", "A plausible number can still be wrong. 100 ÷ 4 = 25 confirms the exact answer."),
      exercise("c2", "Three packs cost €8.40 each. Check the total in cents: 3 × 840 = how many cents?", "2520", "The answer here is in cents, not euros.", "3 × 840 = 2,520 cents = €25.20.", "Recalculating in cents avoids a decimal-place mistake. €25.20 ÷ 3 = €8.40."),
    ],
  },
];

const content: Record<FoundationId, { title: string; description: string; learn: string[]; points: string[]; explore: string; check: string }> = {
  "addition-subtraction": {
    title: "Addition and subtraction", description: "Combine amounts, find differences, and undo a calculation.",
    learn: ["Addition combines amounts. Subtraction can mean taking an amount away or finding the difference between two amounts. Think about what the numbers describe before choosing an operation.", "Place value keeps calculations organized: tens line up with tens, ones with ones, and tenths with tenths. You can split numbers into friendly parts, carry a group of ten when adding, or borrow one when subtracting."],
    points: ["Addition can be reordered: 7 + 4 = 4 + 7. Subtraction usually cannot: 7 − 4 differs from 4 − 7.", "For decimals, align the decimal separator: 1.4 = 1.40. A trailing zero does not change the value.", "Adding or subtracting zero leaves a number unchanged. Keep units consistent, such as euros with euros."],
    explore: "Move along the number line. Addition moves right; subtraction moves left. Predict the destination before changing the numbers.",
    check: "Undo addition with subtraction, or undo subtraction with addition. Restoring the starting value is an exact check. A second decomposition can also expose an arithmetic mistake.",
  },
  "multiplication-division": {
    title: "Multiplication and division", description: "Use equal groups, sharing, and partial products.",
    learn: ["Multiplication counts equal groups. For example, 6 × 14 is six groups of fourteen. For whole numbers, repeated addition is one way to see the total. Division shares a total equally or asks how many groups fit into it.", "The distributive law lets you split a difficult product into easier ones: 6 × (10 + 4) = 6 × 10 + 6 × 4. In written multiplication, partial products follow place value; in division, multiply a proposed quotient back to check it."],
    points: ["Multiplication can be reordered; division usually cannot. 12 ÷ 3 and 3 ÷ 12 are different.", "Multiplying by 1 keeps the number; multiplying by 0 gives 0. Zero divided by a nonzero number is 0.", "Division by zero is undefined: there is no unique quotient that undoes multiplication by zero.", "A division result can be fractional. If items cannot be split, describe the whole-number share and the remainder instead."],
    explore: "Change the number of groups and items in each group. Switch to division to recover the group size from the total. Try zero and notice where the inverse check stops working.",
    check: "For division by a nonzero number, multiply the quotient by the divisor to recover the total. For a product, divide by a nonzero factor, or use a different decomposition. Never check by dividing by zero.",
  },
  "negative-numbers": {
    title: "Negative numbers", description: "Make sense of temperatures, debts, direction, and signs.",
    learn: ["Negative numbers sit to the left of zero on a number line. They describe values below a reference point, such as freezing temperature or a zero bank balance. −8 is less than −3, even though its distance from zero is greater.", "Subtracting a number adds its opposite: a − b = a + (−b). In particular, subtracting a negative moves right. For multiplication and division, equal signs give a positive result and opposite signs give a negative result."],
    points: ["Add a positive: move right. Add a negative: move left.", "Subtract a positive: move left. Subtract a negative: move right.", "(−3) × (−2) = 6; (−3) × 2 = −6. Zero has no positive or negative sign.", "Absolute value is distance from zero: |−8| = 8. Distance and signed value answer different questions."],
    explore: "Try starting below zero, crossing zero, and subtracting a negative. The direction of the arrow comes from the operation and the sign together.",
    check: "Keep every sign when applying the inverse operation. Check signed products by division using the original signed factor. A number line supplies a second way to check direction.",
  },
  "fractions-decimals": {
    title: "Fractions and decimals", description: "Compare equal parts, convert representations, and calculate with them.",
    learn: ["A fraction n/d describes n parts when each whole is split into d equal parts; d cannot be zero. The numerator counts parts, and the denominator tells their size. Improper fractions are allowed: 7/4 is one whole and three quarters.", "Equivalent fractions describe the same amount: multiplying or dividing numerator and denominator by the same nonzero number preserves the value. Add or subtract fractions using a common denominator. Multiply numerators and denominators; divide by a nonzero fraction by multiplying by its reciprocal.", "Decimals use place value: 0.75 = 75/100 = 3/4. To convert a fraction, divide its numerator by its denominator. Some decimals end; others repeat, such as 1/3 = 0.333… . Rounded decimals are approximations."],
    points: ["1/2 + 1/4 = 2/4 + 1/4 = 3/4. Do not add the denominators.", "(2/3) × (3/4) = 6/12 = 1/2. (3/4) ÷ (1/2) = (3/4) × (2/1).", "Align decimal places for addition and subtraction. For multiplication, count the decimal places: 0.2 × 0.3 = 0.06.", "Use an exact fraction for a repeating decimal. This course accepts equivalent fractions, decimal points, and decimal commas."],
    explore: "Change the parts and the size of each whole. Watch equivalent fractions simplify, try more than one whole, and compare exact fractions with decimal approximations.",
    check: "Reverse the operation with equal-sized parts. For a decimal conversion, multiply back by the denominator. A positive addition result must exceed each positive addend; that simple bound can catch a wrong method.",
  },
  "order-of-operations": {
    title: "Order of operations", description: "Read expressions consistently, including powers and parentheses.",
    learn: ["Parentheses tell you which calculation belongs together. Evaluate inside them first, then powers, then multiplication and division, then addition and subtraction. This convention gives an expression one consistent meaning.", "Multiplication and division have the same priority: work from left to right. Addition and subtraction also share a priority and run left to right. A mnemonic must not make you do all multiplication before division, or all addition before subtraction."],
    points: ["6 + 4 × 3 = 18, while (6 + 4) × 3 = 30.", "24 ÷ 6 × 2 = 8. Putting 6 × 2 in parentheses would change it to 2.", "A power means repeated multiplication: 3² = 3 × 3.", "(−3)² = 9, but −3² = −(3²) = −9. Parentheses decide whether the negative sign is squared."],
    explore: "Compare an expression with and without parentheses using the same three numbers. Before switching the grouping, predict whether the answer will change.",
    check: "Rewrite the same expression using a valid identity such as distribution, or expand a power into repeated multiplication. Check the intended grouping as well as the arithmetic.",
  },
  "estimation-checks": {
    title: "Estimation and answer checks", description: "Catch errors with estimates, inverse operations, units, and bounds.",
    learn: ["Estimation replaces awkward numbers with nearby friendly numbers. It is useful for budgeting, checking change, and spotting a misplaced decimal. Always say how you rounded and label the result as an estimate.", "Use more than one kind of check. An inverse operation can confirm an arithmetic result exactly. Another decomposition or another unit can reveal mistakes in the method. Bounds tell you where an answer must lie, such as a positive sum being larger than either part.", "A check only confirms what it actually tests. Repeating the same steps can repeat the same error. A plausible estimate does not prove an exact answer, and correct arithmetic does not prove that you chose the right operation for the real-world situation."],
    points: ["Estimate before calculating, so the exact answer has a target range.", "Undo the operation while keeping units and signs intact.", "Try another method, such as calculating money in cents instead of euros.", "Ask whether the model fits: equal sharing assumes equal shares; a distance sum needs matching units."],
    explore: "Choose a quantity and a price. Compare rounding each price first with the exact total, and notice how the estimation error grows with the quantity.",
    check: "These questions contrast a plausibility check with an exact check. Explain to yourself what evidence each one provides before calculating.",
  },
};

export const foundationLessons: LearningLesson[] = foundationActivities.map(activity => {
  const item = content[activity.id];
  return {
    id: activity.id, subjectId: "math", pathId: "foundations", title: item.title, description: item.description,
    route: `/learn/math/foundations/${activity.id}`, minutes: 12,
    sections: {
      learn: { title: item.title, paragraphs: item.learn, points: item.points },
      explore: { title: "Make the idea visible", paragraphs: [item.explore] },
      practice: { title: "Try it yourself", paragraphs: ["Solve these problems before opening a hint or solution. Enter a number or a fraction such as 3/4. Equivalent exact answers are accepted; units are shown in the question."] },
      check: { title: "Did you know?", paragraphs: [item.check] },
    },
  };
});

export const foundationExerciseIds = new Map<string, Set<string>>(foundationActivities.map(activity => [activity.id, new Set([...activity.practice, ...activity.checks].map(item => item.id))]));

type Rational = { numerator: bigint; denominator: bigint };
/** Strict numeric input, not an expression evaluator. BigInt cross-products
 * preserve exact equality for fractions and terminating decimals. */
export function parseMathAnswer(input: string): Rational | null {
  const value = input.trim().replaceAll("−", "-");
  if (value.length > 40) return null;
  const fraction = value.match(/^([+-]?\d{1,12})\s*\/\s*([+-]?\d{1,12})$/);
  if (fraction) {
    let numerator = BigInt(fraction[1]);
    let denominator = BigInt(fraction[2]);
    if (denominator === 0n) return null;
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    return { numerator, denominator };
  }
  if (!/^[+-]?(?:\d{1,12}(?:[.,]\d{1,12})?|[.,]\d{1,12})$/.test(value)) return null;
  const sign = value.startsWith("-") ? -1n : 1n;
  const [whole, decimals = ""] = value.replace(/^[+-]/, "").replace(",", ".").split(".");
  return { numerator: sign * BigInt((whole || "0") + decimals), denominator: 10n ** BigInt(decimals.length) };
}

export function gradeMathAnswer(input: string, expected: string): "correct" | "incorrect" | "invalid" {
  const actual = parseMathAnswer(input);
  const answer = parseMathAnswer(expected);
  if (!actual || !answer) return "invalid";
  return actual.numerator * answer.denominator === answer.numerator * actual.denominator ? "correct" : "incorrect";
}

export function fractionDisplay(numerator: number, denominator: number) {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || numerator < 0 || denominator <= 0) throw new RangeError("Expected a nonnegative numerator and a positive denominator");
  let a = numerator, b = denominator;
  while (b) { [a, b] = [b, a % b]; }
  const divisor = a || denominator;
  const reducedDenominator = denominator / divisor;
  let rest = reducedDenominator;
  while (rest % 2 === 0) rest /= 2;
  while (rest % 5 === 0) rest /= 5;
  return { fraction: `${numerator / divisor}/${reducedDenominator}`, decimal: Number((numerator / denominator).toFixed(6)).toString(), approximate: rest !== 1 };
}
