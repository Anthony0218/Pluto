import type { LearningLesson } from './learningCatalog.ts';
import type { MathExercise } from './mathFoundations.ts';
import type { PercentageMode } from './practicalMath.ts';
export type PercentageActivity = { id: string; title: string; learn: string[]; check: string; modes: PercentageMode[]; example: { problem: string; steps: string[]; verification: string }; practice: MathExercise[]; checks: MathExercise[] };
const question = (id: string, prompt: string, answer: string, hint: string, solution: string, verification: string): MathExercise => ({ id, prompt, answer, hint, solution, verification });
export const percentageActivities: PercentageActivity[] = [
  {
    id: 'shopping-discounts', title: 'Shopping discounts and competing offers', modes: ['discount', 'amount', 'share'],
    learn: ['Percent means out of one hundred: 25% = 25/100 = 1/4. Identify the whole before multiplying by the rate.', 'A discount removes part of the original price. Compare the final prices of competing offers, including any fixed charges, rather than comparing percentages alone.'],
    check: 'Add the saving to the final price to recover the original price. A 25% discount leaves 75%; these two parts must add to 100%.',
    example: { problem: 'An €80 item has either 20% off or €10 off. Which offer leaves the lower price?', steps: ['80 × 20/100 = 16; 80 − 16 = 64', '80 − 10 = 70', '64 < 70'], verification: '64 + 16 = 80; 70 + 10 = 80' },
    practice: [question('p1', 'A €120 item is reduced by 25%. What is its final price in euros?', '90', '120 × (1 − 25/100)', '120 × 0.75 = 90', '90 + 30 = 120'), question('p2', 'For a €50 item, compare 10% off with €8 off. What is the lower final price in euros?', '42', '50 × 0.9; 50 − 8', '45 > 42', '42 + 8 = 50'), question('p3', 'What percentage of 80 is 20?', '25', '20 ÷ 80 × 100', '20 ÷ 80 × 100 = 25', '80 × 25/100 = 20')], checks: [],
  },
  {
    id: 'successive-discounts', title: 'Successive discounts', modes: ['successive'],
    learn: ['Apply each discount to the price left after the previous discount. Multiply the remaining fractions; do not add the rates.', '20% off followed by 10% off leaves 0.8 × 0.9 = 0.72 of the original price. The combined discount is 28%, not 30%.'],
    check: 'Calculate each saving separately and add them to the final price. The second saving uses the reduced price as its whole.',
    example: { problem: 'A €200 item gets 20% off, then another 10% off. Find the final price.', steps: ['200 × 0.8 = 160', '160 × 0.9 = 144'], verification: '40 + 16 + 144 = 200' },
    practice: [question('p1', 'A €100 item gets 20% off and then 10% off. What is the final price in euros?', '72', '100 × 0.8 × 0.9', '100 × 0.8 × 0.9 = 72', '20 + 8 + 72 = 100'), question('p2', 'Two successive 50% discounts leave what percentage of the original price?', '25', '100 × 0.5 × 0.5', '100 × 0.5 × 0.5 = 25', '50 + 25 + 25 = 100'), question('p3', '20% off followed by 10% off gives what combined discount percentage?', '28', '100 − 72', '100 − 72 = 28', '28 + 72 = 100')], checks: [],
  },
  {
    id: 'vat-net-gross', title: 'VAT: net and gross prices', modes: ['vat-add', 'vat-remove'],
    learn: ['Net is the price before VAT; gross includes VAT. With an example rate of 20%, gross = net × 1.20. The rate applies to the net price.', 'To remove VAT, divide the gross price by 1 + rate/100. Subtracting 20% of the gross price would use the wrong whole. The rates here are hypothetical, not tax rules.'],
    check: 'Multiply the recovered net price by the VAT factor to restore the gross price. Net plus VAT must also equal gross.',
    example: { problem: 'At an example VAT rate of 20%, a gross price is €120. Find the net price.', steps: ['120 ÷ 1.20 = 100', '120 − 100 = 20'], verification: '100 + 20 = 120; 100 × 1.20 = 120' },
    practice: [question('p1', 'A net price is €200 and the example VAT rate is 10%. What is the gross price in euros?', '220', '200 × 1.10', '200 × 1.10 = 220', '220 ÷ 1.10 = 200'), question('p2', 'A gross price is €240 at an example VAT rate of 20%. What is the net price in euros?', '200', '240 ÷ 1.20', '240 ÷ 1.20 = 200', '200 + 40 = 240'), question('p3', 'A net price of €80 becomes €96 gross. How much VAT was added in euros?', '16', '96 − 80', '96 − 80 = 16', '16 ÷ 80 × 100 = 20')], checks: [],
  },
  {
    id: 'price-changes', title: 'Price increases, decreases, and reversing changes', modes: ['change', 'reverse-increase', 'reverse-decrease'],
    learn: ['Percentage change = (new − old) ÷ old × 100. The old amount is the whole. A negative result means a decrease.', 'Reverse an increase by dividing by 1 + rate/100; reverse a decrease by dividing by 1 − rate/100. Equal increases and decreases do not cancel because their wholes differ.'],
    check: 'Apply the original percentage change to your recovered starting amount. A 100% decrease leaves zero, so its original amount cannot be recovered from zero alone.',
    example: { problem: 'A price rises 25% to €100. Find its original price.', steps: ['100 ÷ 1.25 = 80'], verification: '80 + 80 × 0.25 = 100' },
    practice: [question('p1', 'A price rises from €80 to €100. What is the percentage increase?', '25', '(100 − 80) ÷ 80 × 100', '20 ÷ 80 × 100 = 25', '80 × 1.25 = 100'), question('p2', 'After a 20% discount, a price is €64. What was the original price in euros?', '80', '64 ÷ 0.8', '64 ÷ 0.8 = 80', '80 × 0.8 = 64'), question('p3', 'A price drops from €100 to €80. What is the signed percentage change?', '-20', '(80 − 100) ÷ 100 × 100', '(80 − 100) ÷ 100 × 100 = −20', '100 × (1 − 0.2) = 80')], checks: [],
  },
  {
    id: 'salary-rent', title: 'Salary and rent changes', modes: ['change', 'amount', 'reverse-increase'],
    learn: ['Use the previous salary or rent as the whole when calculating its percentage change. The same rate can represent very different amounts of money.', 'A salary increase and a rent increase cannot be compared by subtracting their rates. Calculate each money difference first, keeping the time period and gross or net basis consistent.'],
    check: 'Calculate the money difference by subtraction, then divide it by the previous amount. Compare this with the rate applied to the original amount.',
    example: { problem: 'A monthly salary rises from €2,000 to €2,100; rent rises from €800 to €880. Compare the money changes.', steps: ['2100 − 2000 = 100; 100 ÷ 2000 × 100 = 5%', '880 − 800 = 80; 80 ÷ 800 × 100 = 10%', '100 − 80 = 20'], verification: '2000 × 1.05 = 2100; 800 × 1.10 = 880' },
    practice: [question('p1', 'A salary of €2,000 rises by 5%. What is the new salary in euros?', '2100', '2000 × 1.05', '2000 × 1.05 = 2100', '2100 − 2000 = 100; 100 ÷ 2000 = 0.05'), question('p2', 'Rent rises from €800 to €880. What is the percentage increase?', '10', '80 ÷ 800 × 100', '80 ÷ 800 × 100 = 10', '800 × 1.10 = 880'), question('p3', 'Salary increases by €100 per month and rent by €80 per month. How much extra remains in euros before other changes?', '20', '100 − 80', '100 − 80 = 20', '20 + 80 = 100')], checks: [],
  },
  {
    id: 'tips-shared-bills', title: 'Tips and shared bills', modes: ['tip', 'amount'],
    learn: ['Choose the bill amount to which the tip applies, multiply by tip/100, and add it to the bill. Then divide the total according to the agreed shares.', 'Round the total to cents before splitting it. When equal shares have repeating decimals, distribute remaining cents so the rounded shares still add to the total.'],
    check: 'Add all shares and compare with the total bill including the tip. An equal-share estimate can be correct before rounding but differ by a cent afterward.',
    example: { problem: 'A €60 bill has a 10% tip and is shared by three people. Find each share.', steps: ['60 × 0.10 = 6', '(60 + 6) ÷ 3 = 22'], verification: '22 + 22 + 22 = 66; 66 − 6 = 60' },
    practice: [question('p1', 'A €40 bill has a 15% tip. What is the total in euros?', '46', '40 × 1.15', '40 × 1.15 = 46', '46 − 40 = 6; 6 ÷ 40 = 0.15'), question('p2', 'A €60 bill plus a 10% tip is shared equally by three people. What is each share in euros?', '22', '60 × 1.10 ÷ 3', '66 ÷ 3 = 22', '22 × 3 = 66'), question('p3', 'Three rounded shares of €3.33 total €9.99. How many cents must be added to reach €10?', '1', '1000 − 999', '1000 − 999 = 1', '333 + 333 + 334 = 1000')], checks: [],
  },
  {
    id: 'recipes-servings', title: 'Recipes and serving sizes', modes: ['scale', 'amount'],
    learn: ['The scaling factor is target servings ÷ original servings. Multiply every ingredient quantity by this factor while keeping its unit.', '150% of a recipe means 1.5 times the ingredients, a 50% increase. Oven temperature and cooking time do not automatically scale with ingredient quantities.'],
    check: 'Divide a scaled ingredient by the scaling factor to recover its original quantity. Repeat the check for each ingredient and keep units unchanged.',
    example: { problem: 'A recipe for four uses 200 g of flour. How much is needed for six servings?', steps: ['6 ÷ 4 = 1.5', '200 × 1.5 = 300 g'], verification: '300 ÷ 1.5 = 200 g; 4 × 1.5 = 6' },
    practice: [question('p1', 'A four-serving recipe uses 200 g of flour. How many grams are needed for six servings?', '300', '200 × 6 ÷ 4', '200 × 1.5 = 300', '300 ÷ 1.5 = 200'), question('p2', 'Six servings are what percentage of four servings?', '150', '6 ÷ 4 × 100', '6 ÷ 4 × 100 = 150', '4 × 150/100 = 6'), question('p3', 'An ingredient increases from 100 g to 150 g. What is the percentage increase?', '50', '(150 − 100) ÷ 100 × 100', '50 ÷ 100 × 100 = 50', '100 × 1.5 = 150')], checks: [],
  },
  {
    id: 'surveys-points', title: 'Survey results: percentages and percentage points', modes: ['share', 'points'],
    learn: ['A survey percentage is the selected count divided by the relevant total, multiplied by 100. Check who is included in the denominator and whether multiple answers are allowed.', 'A move from 40% to 50% is a rise of 10 percentage points but a 25% relative increase. Percentages alone do not establish that a sample represents the population.'],
    check: 'Multiply the percentage by the sample size to recover the count. For a rate change, add the percentage-point difference to the old rate and compare with the new rate.',
    example: { problem: '30 of 120 respondents choose an option. What percentage is that?', steps: ['30 ÷ 120 × 100 = 25%'], verification: '120 × 0.25 = 30' },
    practice: [question('p1', '30 of 120 respondents choose an option. What percentage chose it?', '25', '30 ÷ 120 × 100', '30 ÷ 120 × 100 = 25', '120 × 25/100 = 30'), question('p2', 'A rate rises from 40% to 50%. How many percentage points is the increase?', '10', '50 − 40', '50 − 40 = 10', '40 + 10 = 50'), question('p3', 'A rate rises from 40% to 50%. What is its relative percentage increase?', '25', '(50 − 40) ÷ 40 × 100', '10 ÷ 40 × 100 = 25', '40 × 1.25 = 50')], checks: [],
  },
  {
    id: 'hypothetical-growth', title: 'Savings and hypothetical compound growth', modes: ['compound', 'amount'],
    learn: ['With a fixed rate each period, multiply the starting amount by (1 + rate/100) once per period. Later growth applies to the increased amount, including earlier growth.', 'This model assumes a constant rate and no deposits, withdrawals, fees, taxes, or inflation. A calculation under those assumptions is not a prediction of future returns.'],
    check: 'Calculate period by period and compare with the power formula. Divide the final amount by the full growth factor to recover the starting amount when that factor is nonzero.',
    example: { problem: 'In a hypothetical model, €1,000 grows 5% per period for two periods. Find the final amount.', steps: ['1000 × 1.05 = 1050', '1050 × 1.05 = 1102.5', '1000 × 1.05² = 1102.5'], verification: '1102.5 ÷ 1.05² = 1000' },
    practice: [question('p1', 'In a fixed-rate model, €1,000 grows 5% per period for two periods. What is the final amount in euros?', '1102.5', '1000 × 1.05²', '1000 × 1.05 × 1.05 = 1102.5', '1102.5 ÷ 1.05² = 1000'), question('p2', 'An amount of €200 grows 10% per period for two periods. How much growth is added in total, in euros?', '42', '200 × 1.1² − 200', '242 − 200 = 42', '20 + 22 = 42'), question('p3', 'An amount of €500 grows 0% for three periods. What is the final amount in euros?', '500', '500 × 1³', '500 × 1³ = 500', '500 − 500 = 0')], checks: [],
  },
];
export const percentageLessons: LearningLesson[] = percentageActivities.map(activity => ({
  id: activity.id, title: activity.title, description: activity.learn[0], route: `/learn/math/percentages/${activity.id}`, minutes: 12, subjectId: 'math', pathId: 'percentages',
  sections: {
    learn: { title: activity.title, paragraphs: activity.learn },
    explore: { title: 'Change a number. Notice what changes.', paragraphs: ['Identify the whole, change one input, and predict the result before reading the calculation.'] },
    practice: { title: 'Try it yourself', paragraphs: ['Enter a number or an exact fraction. The question states the unit; leave it out of your answer.'] },
    check: { title: 'Did you know?', paragraphs: [activity.check] },
  },
}));
export const percentageExerciseIds = new Map(percentageActivities.map(activity => [activity.id, new Set(activity.practice.map(item => item.id))]));
