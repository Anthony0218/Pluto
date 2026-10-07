export type EverydayMathCase = { situation: string; calculation: string };
/** Illustrative everyday scenarios; prices and probabilities are hypothetical. */
export const everydayMathCases: Record<string, EverydayMathCase> = {
  "addition-subtraction": {
    "situation": "You have €50 for groceries and spend €18 and €7. Subtraction tells you that €25 remains.",
    "calculation": "50 − 18 − 7 = 25"
  },
  "multiplication-division": {
    "situation": "Six friends share a €48 meal equally. Division gives €8 each; multiplying checks the total.",
    "calculation": "48/6 = 8; 6 × 8 = 48"
  },
  "negative-numbers": {
    "situation": "The temperature rises from −4°C by 7 degrees. Adding across zero gives 3°C.",
    "calculation": "−4 + 7 = 3"
  },
  "fractions-decimals": {
    "situation": "A recipe needs three quarters of a litre of water. The decimal label on your measuring jug reads 0.75 litres.",
    "calculation": "3/4 = 0.75"
  },
  "order-of-operations": {
    "situation": "You buy three €4 tickets and pay one €2 booking fee. Grouping the fee with each ticket would overcharge you.",
    "calculation": "3 × 4 + 2 = 14; 3 × (4 + 2) = 18"
  },
  "estimation-checks": {
    "situation": "Five items cost €1.98 each. Estimate €10 to check your receipt, then calculate the exact €9.90.",
    "calculation": "5 × 2 ≈ 10; 5 × 1.98 = 9.90"
  },
  "shopping-discounts": {
    "situation": "A €60 jacket is reduced by 25%. Compare its €45 final price with another shop’s €48 offer.",
    "calculation": "60 × (1 − 0.25) = 45 < 48"
  },
  "successive-discounts": {
    "situation": "A €100 item has 20% off, then a further 10% off the reduced price. You pay €72, not €70.",
    "calculation": "100 × 0.8 × 0.9 = 72"
  },
  "vat-net-gross": {
    "situation": "A hypothetical quote lists €100 before a 20% tax. Budget €120; removing that tax means dividing by 1.2.",
    "calculation": "100 × 1.2 = 120; 120/1.2 = 100"
  },
  "price-changes": {
    "situation": "Your €40 subscription rises by 25% to €50. Returning to €40 requires a 20% decrease from the new price.",
    "calculation": "40 × 1.25 = 50; 50 × 0.8 = 40"
  },
  "salary-rent": {
    "situation": "Your hypothetical monthly income rises 5%, while rent rises 10%. Compare euro amounts before judging the effect on your budget.",
    "calculation": "2000 × 0.05 = 100; 800 × 0.10 = 80"
  },
  "tips-shared-bills": {
    "situation": "Four friends split an €80 meal and add a 10% tip. Each person pays €22.",
    "calculation": "80 × 1.10 / 4 = 22"
  },
  "recipes-servings": {
    "situation": "A recipe for four people uses 300 g of flour. Cooking for six needs 450 g if the ingredients scale proportionally.",
    "calculation": "300 × 6/4 = 450"
  },
  "surveys-points": {
    "situation": "Support in a club poll rises from 40% to 50%. That is 10 percentage points, or a 25% relative increase.",
    "calculation": "50 − 40 = 10 pp; (50 − 40)/40 = 25%"
  },
  "hypothetical-growth": {
    "situation": "Compare a hypothetical €100 balance growing 10% each year for two years. Compounding gives €121; actual returns need not follow this model.",
    "calculation": "100 × 1.1² = 121"
  },
  "equations-inequalities": {
    "situation": "You have €35 for a taxi charging €5 plus €2 per kilometre. An inequality gives a maximum of 15 km in this model.",
    "calculation": "5 + 2x ≤ 35 ⇒ x ≤ 15"
  },
  "ratios-proportions": {
    "situation": "For identical portions, 200 g of rice serves two people. Direct proportion gives 500 g for five people.",
    "calculation": "200/2 = 100; 100 × 5 = 500"
  },
  "powers-roots-logarithms": {
    "situation": "You share a photo with two people, who each share it with two more. Three ideal doubling rounds produce eight recipients in that round.",
    "calculation": "2³ = 8; log₂(8) = 3"
  },
  "functions-graphs": {
    "situation": "Compare two hypothetical phone plans costing €5 plus €2 per unit and €9 plus €1 per unit. They cost the same at four units.",
    "calculation": "5 + 2x = 9 + x ⇒ x = 4; 13 = 13"
  },
  "domains-substitution": {
    "situation": "Splitting a €60 bill equally requires at least one person. The formula 60/n has no meaning at zero people.",
    "calculation": "n ∈ {1, 2, 3, …}; 60/3 = 20; n ≠ 0"
  },
  "slopes-rates": {
    "situation": "A journey covers 60 km between hour one and hour two. The average speed is 60 km/h, even if the speed changed along the way.",
    "calculation": "(90 − 30)/(2 − 1) = 60"
  },
  "derivative-rules": {
    "situation": "A hypothetical journey has distance s(t) = t² kilometres. At two hours the instantaneous speed is 4 km/h; the average over the first two hours is 2 km/h.",
    "calculation": "s′(2) = 2 × 2 = 4; (s(2) − s(0))/2 = 2"
  },
  "areas-accumulation": {
    "situation": "A tap fills a bucket at 3 litres per minute for four minutes. Accumulating the flow gives 12 litres.",
    "calculation": "3 × 4 = 12"
  },
  "antiderivatives": {
    "situation": "Your walking app records a constant 3 km/h, starting 2 km from home along a straight route. The initial distance fixes the constant.",
    "calculation": "s(t) = 3t + C; s(0) = 2 ⇒ C = 2"
  },
  "definite-integrals": {
    "situation": "A tap’s flow rises linearly from 0 to 4 litres per minute over two minutes. Integrating the flow gives 4 litres collected.",
    "calculation": "∫₀² 2t dt = [t²]₀² = 4"
  },
  "optimization": {
    "situation": "You have 12 metres of edging for a rectangular garden. Comparing feasible side lengths gives the largest area at 3 m by 3 m.",
    "calculation": "2x + 2y = 12; A(x) = x(6 − x) = 9 − (x − 3)²"
  },
  "numerical-calculus-checks": {
    "situation": "Your walking app samples speeds rather than recording every instant. Averaging adjacent readings estimates distance; missed speed changes can affect the result.",
    "calculation": "v₀ = 2; v₁ = 4; Δt = 1; Δs ≈ (2 + 4)/2 = 3"
  },
  "vectors": {
    "situation": "In an open park, your destination is 300 m east and 400 m north. The direct displacement is 500 m; paths may require a longer walk.",
    "calculation": "√(300² + 400²) = 500"
  },
  "matrices": {
    "situation": "Compare grocery totals at two shops: two loaves and three milk cartons cost €7.50 at one and €8.40 at the other. Rows organize each shop’s prices.",
    "calculation": "[[1.5, 1.5], [1.8, 1.6]] × (2, 3) = (7.5, 8.4)"
  },
  "linear-systems": {
    "situation": "Two adults and one child pay €25 for tickets; one adult and two children pay €20. Solving both totals gives €10 per adult and €5 per child.",
    "calculation": "2a + c = 25; a + 2c = 20 ⇒ a = 10; c = 5"
  },
  "geometric-transformations": {
    "situation": "Rotate a photo a quarter-turn counterclockwise. A point three units right and two up moves to two left and three up, preserving its distance from the centre.",
    "calculation": "[[0, −1], [1, 0]] × (3, 2) = (−2, 3)"
  },
  "eigenvalues-eigenvectors": {
    "situation": "Resize a photo to twice its width and three times its height. A horizontal arrow keeps its direction and doubles in length: it is an eigenvector direction.",
    "calculation": "A = [[2, 0], [0, 3]]; v = (1, 0); Av = 2v"
  },
  "residual-checks": {
    "situation": "Before repaying shared shopping costs, check that your proposed item prices reproduce every receipt. A nonzero residual flags a mismatch to investigate.",
    "calculation": "2a + c = 25; a + 2c = 20; (a, c) = (9, 5) ⇒ r = (−2, −1)"
  },
  "limits-continuity": {
    "situation": "A delivery fee may jump when a basket reaches €50. Approaching the threshold from below and above can give different totals; check the rule at exactly €50.",
    "calculation": "x < 50: f(x) = x + 5; x ≥ 50: f(x) = x; 55 ≠ 50"
  },
  "sequences": {
    "situation": "You clear half a backlog each week. The remaining fraction approaches zero, but the ideal halving model never reaches exactly zero in a finite week.",
    "calculation": "aₙ = (1/2)ⁿ; a₄ = 1/16; aₙ → 0"
  },
  "series-convergence": {
    "situation": "You watch half a video, then half the remaining part, and repeat. The watched fractions add toward one whole video.",
    "calculation": "1/2 + 1/4 + 1/8 + … = 1"
  },
  "definitions-proofs": {
    "situation": "Two identical tickets cost twice the price of one. Keeping each ticket’s price error below €0.05 guarantees a total error below €0.10.",
    "calculation": "f(x) = 2x; |x − a| < 0.05 ⇒ |f(x) − f(a)| < 0.10"
  },
  "boundary-counterexamples": {
    "situation": "An advertised per-person price divides a bill by group size. Testing zero people reveals an excluded input before you rely on the formula.",
    "calculation": "f(n) = 60/n; n = 0 ⇒ f(n) ∉ ℝ"
  },
  "conditional-probability": {
    "situation": "When deciding whether an umbrella signals rain, distinguish rainy days with umbrellas from umbrella days with rain. The two questions use different denominators.",
    "calculation": "30/50 = P(A|B); 30/40 = P(B|A)"
  },
  "distributions": {
    "situation": "Plan for how many friends might attend a picnic. With four independent guests each attending with probability one half, the expected count is two, but any count from zero to four is possible.",
    "calculation": "X ∼ B(4, 1/2); E[X] = 2; P(X = 4) = 1/16"
  },
  "averages-variability": {
    "situation": "Your last three delivery waits were 2, 4, and 60 minutes. The mean is 22 minutes and the median is 4; the unusual delay changes what “typical” means.",
    "calculation": "(2 + 4 + 60)/3 = 22; x̃ = 4"
  },
  "sampling-uncertainty": {
    "situation": "A poll of your friends may not represent your whole neighbourhood. A larger poll reduces random fluctuation only when its sampling assumptions are reasonable.",
    "calculation": "p̂ = 1/2; n = 100 ⇒ SE ≈ 0.05; n = 400 ⇒ SE ≈ 0.025"
  },
  "misleading-charts": {
    "situation": "A chart makes a household bill rising from €40 to €50 look doubled by starting its bars at €30. The actual increase is 25%.",
    "calculation": "(50 − 30)/(40 − 30) = 2; (50 − 40)/40 = 25%"
  },
  "complements-simulation": {
    "situation": "For three independent attempts at a game with a one-half chance each, the chance of at least one win is seven eighths. Earlier losses do not improve the next attempt.",
    "calculation": "1 − (1 − 1/2)³ = 7/8"
  }
};
