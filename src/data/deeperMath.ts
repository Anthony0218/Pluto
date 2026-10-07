import type { LearningLesson } from './learningCatalog.ts';
import type { MathExercise } from './mathFoundations.ts';
export type DeeperMathActivity = {
  id: string; pathId: 'linear-algebra' | 'analysis' | 'probability-statistics';
  title: string; learn: string[]; check: string;
  exploration: 'vectors' | 'matrices' | 'systems' | 'transformations' | 'eigen' | 'residuals' | 'limits' | 'sequences' | 'series' | 'proof' | 'boundaries' | 'conditional' | 'distribution' | 'data' | 'sampling' | 'charts' | 'simulation';
  example: { problem: string; notation: string; steps: string[]; verification: string };
  practice: MathExercise[]; checks: MathExercise[];
};
export const deeperMathActivities: DeeperMathActivity[] = [
  {
    "id": "vectors",
    "pathId": "linear-algebra",
    "title": "Vectors",
    "learn": [
      "A vector records a size and a direction. In two dimensions, its coordinates describe horizontal and vertical displacement.",
      "Add vectors coordinate by coordinate. Multiplying by a scalar scales both coordinates; a negative scalar reverses direction. Length is √(x² + y²)."
    ],
    "check": "Walking distance can exceed displacement. Returning to your starting point gives zero displacement, even after a long walk.",
    "exploration": "vectors",
    "example": {
      "problem": "Find the requested value.",
      "notation": "u = (3, 4); |u| = ?",
      "steps": [
        "|u| = √(3² + 4²) = √25 = 5"
      ],
      "verification": "5² = 3² + 4²"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "u = (2, 3); v = (4, −1); (u + v)ₓ = ?",
        "answer": "6",
        "hint": "2 + 4",
        "solution": "(6, 2)",
        "verification": "(6, 2) − (4, −1) = (2, 3)"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "u = (3, 4); |u| = ?",
        "answer": "5",
        "hint": "√(3² + 4²)",
        "solution": "√25 = 5",
        "verification": "5² = 25"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "u = (2, −3); (−2u)ᵧ = ?",
        "answer": "6",
        "hint": "−2 × (−3)",
        "solution": "−2u = (−4, 6)",
        "verification": "6/(−2) = −3"
      }
    ],
    "checks": []
  },
  {
    "id": "matrices",
    "pathId": "linear-algebra",
    "title": "Matrices",
    "learn": [
      "A matrix organizes numbers in rows and columns. Multiplying a matrix by a vector forms a weighted sum for each output coordinate.",
      "For a two by two matrix, the determinant is ad − bc. A nonzero determinant gives an inverse; matrix multiplication usually depends on order."
    ],
    "check": "Check dimensions before multiplying. A matrix that collapses a plane to a line loses information and has no inverse.",
    "exploration": "matrices",
    "example": {
      "problem": "Find the requested value.",
      "notation": "A = [[2, 1], [0, 3]]; u = (4, 2); (Au)ₓ = ?",
      "steps": [
        "(Au)ₓ = 2 × 4 + 1 × 2 = 10",
        "Au = (10, 6)"
      ],
      "verification": "(Au)ᵧ = 0 × 4 + 3 × 2 = 6"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "A = [[2, 1], [0, 3]]; u = (4, 2); (Au)ₓ = ?",
        "answer": "10",
        "hint": "2 × 4 + 1 × 2",
        "solution": "10",
        "verification": "10 − 2 = 2 × 4"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "A = [[2, 1], [0, 3]]; |A| = ?",
        "answer": "6",
        "hint": "2 × 3 − 1 × 0",
        "solution": "6",
        "verification": "A⁻¹ = [[1/2, −1/6], [0, 1/3]]; AA⁻¹ = I"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "A = [[1, 2], [3, 4]]; B = [[2, 0], [0, 1]]; (AB)₁₂ = ?",
        "answer": "2",
        "hint": "1 × 0 + 2 × 1",
        "solution": "2",
        "verification": "AB = [[2, 2], [6, 4]]"
      }
    ],
    "checks": []
  },
  {
    "id": "linear-systems",
    "pathId": "linear-algebra",
    "title": "Systems of linear equations",
    "learn": [
      "A linear system asks for values satisfying several equations at once. Elimination combines equations to remove an unknown.",
      "In two dimensions, intersecting lines give one solution. Parallel distinct lines give none; coincident lines give infinitely many."
    ],
    "check": "A zero determinant does not distinguish no solutions from infinitely many. Check whether the equations and right-hand sides agree.",
    "exploration": "systems",
    "example": {
      "problem": "Find the requested value.",
      "notation": "x + y = 7; 2x + y = 11; x = ?",
      "steps": [
        "(2x + y) − (x + y) = 11 − 7",
        "x = 4; y = 3"
      ],
      "verification": "4 + 3 = 7; 2 × 4 + 3 = 11"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "x + y = 7; 2x + y = 11; x = ?",
        "answer": "4",
        "hint": "(2x + y) − (x + y) = 4",
        "solution": "x = 4",
        "verification": "y = 3; 4 + 3 = 7; 8 + 3 = 11"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "x + y = 10; x − y = 2; y = ?",
        "answer": "4",
        "hint": "2x = 12",
        "solution": "x = 6; y = 4",
        "verification": "6 + 4 = 10; 6 − 4 = 2"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "2x + y = 9; x + 2y = 12; x = ?",
        "answer": "2",
        "hint": "4x + 2y = 18; x + 2y = 12",
        "solution": "3x = 6; x = 2",
        "verification": "y = 5; 4 + 5 = 9; 2 + 10 = 12"
      }
    ],
    "checks": []
  },
  {
    "id": "geometric-transformations",
    "pathId": "linear-algebra",
    "title": "Geometric transformations",
    "learn": [
      "Matrices can rotate, reflect, scale, or shear coordinates. A linear transformation always sends the origin to the origin.",
      "Apply the rightmost matrix first when composing transformations. A translation needs an added vector and is not linear unless it is zero."
    ],
    "check": "Rotations preserve length; stretches generally do not. Test the origin and basis vectors to check a linear transformation.",
    "exploration": "transformations",
    "example": {
      "problem": "Find the requested value.",
      "notation": "R = [[0, −1], [1, 0]]; u = (3, 2); (Ru)ₓ = ?",
      "steps": [
        "Ru = (−2, 3)"
      ],
      "verification": "|Ru|² = (−2)² + 3² = 13 = |u|²"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "R = [[0, −1], [1, 0]]; u = (3, 2); (Ru)ₓ = ?",
        "answer": "-2",
        "hint": "0 × 3 − 1 × 2",
        "solution": "−2",
        "verification": "R⁻¹(−2, 3) = (3, 2)"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "S = [[2, 0], [0, 3]]; u = (4, 1); (Su)ᵧ = ?",
        "answer": "3",
        "hint": "0 × 4 + 3 × 1",
        "solution": "3",
        "verification": "Su = (8, 3)"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "F = [[−1, 0], [0, 1]]; u = (5, −2); (Fu)ₓ = ?",
        "answer": "-5",
        "hint": "−1 × 5",
        "solution": "−5",
        "verification": "F(Fu) = u"
      }
    ],
    "checks": []
  },
  {
    "id": "eigenvalues-eigenvectors",
    "pathId": "linear-algebra",
    "title": "Eigenvalues and eigenvectors",
    "learn": [
      "An eigenvector is a nonzero vector satisfying Av = λv. Its direction stays on the same line; the eigenvalue gives its scale factor.",
      "Repeated transformations multiply that vector by λ each time. A zero eigenvalue collapses it; a negative eigenvalue reverses it. Real eigenvectors need not exist."
    ],
    "check": "The zero vector is never an eigenvector. A quarter-turn in the plane has no real eigenvector, despite preserving every length.",
    "exploration": "eigen",
    "example": {
      "problem": "Find the requested value.",
      "notation": "A = [[2, 0], [0, 3]]; v = (0, 1); λ = ?",
      "steps": [
        "Av = (0, 3) = 3v",
        "λ = 3"
      ],
      "verification": "A²v = (0, 9) = 3²v"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "A = [[2, 0], [0, 3]]; v = (0, 1); λ = ?",
        "answer": "3",
        "hint": "Av = (0, 3)",
        "solution": "λ = 3",
        "verification": "3v = (0, 3)"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "A = [[2, 0], [0, 3]]; v = (1, 0); (A³v)ₓ = ?",
        "answer": "8",
        "hint": "A³v = 2³v",
        "solution": "8",
        "verification": "2 × 2 × 2 = 8"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "A = [[−1, 0], [0, 2]]; v = (1, 0); λ = ?",
        "answer": "-1",
        "hint": "Av = (−1, 0)",
        "solution": "λ = −1",
        "verification": "(−1)v = (−1, 0)"
      }
    ],
    "checks": []
  },
  {
    "id": "residual-checks",
    "pathId": "linear-algebra",
    "title": "Substitution and residual checks",
    "learn": [
      "The residual r = Ax − b measures how far a proposed solution misses each equation. An exact solution has zero residual.",
      "A small numerical residual need not mean a small solution error. Nearly dependent equations can amplify tiny changes in the data."
    ],
    "check": "Substitute into every original equation. Rounding a displayed solution can introduce a residual even when the calculation was correct.",
    "exploration": "residuals",
    "example": {
      "problem": "Find the requested value.",
      "notation": "A = [[1, 1], [2, 1]]; b = (7, 11); x = (4, 2); r₁ = ?",
      "steps": [
        "Ax = (6, 10)",
        "r = (6, 10) − (7, 11) = (−1, −1)"
      ],
      "verification": "x = (4, 3) ⇒ Ax = (7, 11) ⇒ r = (0, 0)"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "A = [[1, 1], [2, 1]]; b = (7, 11); x = (4, 2); r₁ = ?",
        "answer": "-1",
        "hint": "4 + 2 − 7",
        "solution": "−1",
        "verification": "Ax = (6, 10)"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "A = [[1, 1], [2, 1]]; b = (7, 11); x = (4, 3); r₂ = ?",
        "answer": "0",
        "hint": "2 × 4 + 3 − 11",
        "solution": "0",
        "verification": "8 + 3 = 11"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "A = [[2, 0], [0, 3]]; b = (8, 9); x = (3, 3); r₁ = ?",
        "answer": "-2",
        "hint": "2 × 3 − 8",
        "solution": "−2",
        "verification": "Ax = (6, 9); r = (−2, 0)"
      }
    ],
    "checks": []
  },
  {
    "id": "limits-continuity",
    "pathId": "analysis",
    "title": "Limits and continuity",
    "learn": [
      "A limit describes what outputs approach as inputs approach a point. The value at that point can differ from the limit or be undefined.",
      "Continuity at a point requires a defined value, an existing limit, and equality between them. Left and right limits must agree."
    ],
    "check": "A graph can suggest a limit but cannot prove it. A removable hole can have a limit without a function value.",
    "exploration": "limits",
    "example": {
      "problem": "Find the requested value.",
      "notation": "f(x) = (x² − 1)/(x − 1); x → 1; L = ?",
      "steps": [
        "f(x) = x + 1; x ≠ 1",
        "L = 2"
      ],
      "verification": "f(0.99) = 1.99; f(1.01) = 2.01; f(1) ∉ ℝ"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "f(x) = (x² − 4)/(x − 2); x → 2; L = ?",
        "answer": "4",
        "hint": "f(x) = x + 2; x ≠ 2",
        "solution": "L = 4",
        "verification": "f(1.99) = 3.99; f(2.01) = 4.01"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "f(x) = 3x + 1; x → 2; L = ?",
        "answer": "7",
        "hint": "3 × 2 + 1",
        "solution": "7",
        "verification": "|f(x) − 7| = 3|x − 2|"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "f(x) = |x|; x → 0; L = ?",
        "answer": "0",
        "hint": "|x| → 0",
        "solution": "0",
        "verification": "|f(x) − 0| = |x|"
      }
    ],
    "checks": []
  },
  {
    "id": "sequences",
    "pathId": "analysis",
    "title": "Sequences",
    "learn": [
      "A sequence is an ordered list indexed by positive integers. Convergence means every sufficiently late term lies within any chosen positive distance of a limit.",
      "Being bounded alone does not imply convergence. A monotone bounded real sequence converges, although finding its limit still needs reasoning."
    ],
    "check": "The bounded sequence (−1)ⁿ alternates forever. A long list of close terms alone does not establish convergence.",
    "exploration": "sequences",
    "example": {
      "problem": "Find the requested value.",
      "notation": "aₙ = 1/n; a₄ = ?",
      "steps": [
        "a₄ = 1/4"
      ],
      "verification": "n > 1/ε ⇒ 0 < 1/n < ε"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "aₙ = 1/n; a₄ = ?",
        "answer": "1/4",
        "hint": "n = 4",
        "solution": "1/4",
        "verification": "4 × (1/4) = 1"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "aₙ = (−1)ⁿ; a₅ = ?",
        "answer": "-1",
        "hint": "(−1)⁵",
        "solution": "−1",
        "verification": "a₄ = 1; a₅ = −1; a₆ = 1"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "aₙ = 3 + 2/n; n → ∞; L = ?",
        "answer": "3",
        "hint": "2/n → 0",
        "solution": "L = 3",
        "verification": "|aₙ − 3| = 2/n < ε; n > 2/ε"
      }
    ],
    "checks": []
  },
  {
    "id": "series-convergence",
    "pathId": "analysis",
    "title": "Series and convergence",
    "learn": [
      "A series adds the terms of a sequence. It converges when its partial sums approach a finite limit; terms approaching zero are necessary but not sufficient.",
      "A geometric series with first term a and |r| < 1 sums to a/(1 − r). The harmonic series diverges despite its terms approaching zero."
    ],
    "check": "Check the ratio condition before using an infinite geometric sum. The remainder after N terms is arᴺ/(1 − r).",
    "exploration": "series",
    "example": {
      "problem": "Find the requested value.",
      "notation": "1 + 1/2 + 1/4 + … = ?",
      "steps": [
        "a = 1; r = 1/2",
        "a/(1 − r) = 2"
      ],
      "verification": "Sₙ = 2(1 − (1/2)ⁿ); 2 − Sₙ = 2(1/2)ⁿ"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "1 + 1/2 + 1/4 + … = ?",
        "answer": "2",
        "hint": "1/(1 − 1/2)",
        "solution": "2",
        "verification": "Sₙ = 2 − 2(1/2)ⁿ"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "2 + 2/3 + 2/9 + … = ?",
        "answer": "3",
        "hint": "2/(1 − 1/3)",
        "solution": "3",
        "verification": "3 − Sₙ = 3(1/3)ⁿ"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "1 + 1/2 + 1/4 = ?",
        "answer": "7/4",
        "hint": "4/4 + 2/4 + 1/4",
        "solution": "7/4",
        "verification": "2 − 7/4 = 1/4"
      }
    ],
    "checks": []
  },
  {
    "id": "definitions-proofs",
    "pathId": "analysis",
    "title": "Definitions and proofs",
    "learn": [
      "A proof explains why a statement follows from definitions and assumptions. Examples can reveal a pattern but cannot prove a claim about all inputs.",
      "For a limit L at a, every ε > 0 needs a δ > 0 so that 0 < |x − a| < δ implies |f(x) − L| < ε."
    ],
    "check": "For f(x) = 2x at a = 3, choosing δ = ε/2 proves the limit is 6 for every positive ε.",
    "exploration": "proof",
    "example": {
      "problem": "Find the requested value.",
      "notation": "f(x) = 2x; a = 3; ε = 1/10; δ = ε/2 = ?",
      "steps": [
        "δ = (1/10)/2 = 1/20"
      ],
      "verification": "|f(x) − 6| = 2|x − 3| < 2δ = ε"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "f(x) = 2x; ε = 1/10; δ = ε/2 = ?",
        "answer": "1/20",
        "hint": "(1/10)/2",
        "solution": "1/20",
        "verification": "2δ = 1/10"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "f(x) = 3x; ε = 3/10; δ = ε/3 = ?",
        "answer": "1/10",
        "hint": "(3/10)/3",
        "solution": "1/10",
        "verification": "3δ = 3/10"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "aₙ = 1/n; ε = 1/10; 1/n < ε ⇔ n > ?",
        "answer": "10",
        "hint": "1/n < 1/10",
        "solution": "n > 10",
        "verification": "1/11 < 1/10; 1/10 = ε"
      }
    ],
    "checks": []
  },
  {
    "id": "boundary-counterexamples",
    "pathId": "analysis",
    "title": "Boundary cases and counterexamples",
    "learn": [
      "A counterexample disproves a universal statement. Check endpoints, excluded inputs, and cases where a theorem’s assumptions fail.",
      "Continuity does not guarantee differentiability: |x| has a corner at zero. A stationary point does not guarantee an extremum: x³ keeps increasing through zero."
    ],
    "check": "For |x| at zero, the left slope is −1 and the right slope is 1. Matching function limits do not make those slopes equal.",
    "exploration": "boundaries",
    "example": {
      "problem": "Find the requested value.",
      "notation": "f(x) = |x|; h = −1/10; (f(h) − f(0))/h = ?",
      "steps": [
        "|−1/10|/(−1/10) = −1"
      ],
      "verification": "h = 1/10 ⇒ |h|/h = 1 ≠ −1"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "f(x) = |x|; h = −1/10; (f(h) − f(0))/h = ?",
        "answer": "-1",
        "hint": "(1/10)/(−1/10)",
        "solution": "−1",
        "verification": "h = −1/100 ⇒ |h|/h = −1"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "f(x) = |x|; h = 1/10; (f(h) − f(0))/h = ?",
        "answer": "1",
        "hint": "(1/10)/(1/10)",
        "solution": "1",
        "verification": "h = 1/100 ⇒ |h|/h = 1"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "f(x) = x³; f′(0) = ?",
        "answer": "0",
        "hint": "f′(x) = 3x²",
        "solution": "0",
        "verification": "f(−1) = −1 < 0 < 1 = f(1)"
      }
    ],
    "checks": []
  },
  {
    "id": "conditional-probability",
    "pathId": "probability-statistics",
    "title": "Probability and conditional probability",
    "learn": [
      "Probability lies between zero and one. Conditional probability restricts the population: P(A|B) = P(A ∩ B)/P(B), provided P(B) > 0.",
      "P(A|B) generally differs from P(B|A). Independent events satisfy P(A ∩ B) = P(A)P(B); mutually exclusive events cannot happen together."
    ],
    "check": "Always identify the denominator. Umbrella days are a different reference group from rainy days.",
    "exploration": "conditional",
    "example": {
      "problem": "Find the requested value.",
      "notation": "P(A ∩ B) = 3/10; P(B) = 1/2; P(A|B) = ?",
      "steps": [
        "P(A|B) = (3/10)/(1/2) = 3/5"
      ],
      "verification": "(3/5) × (1/2) = 3/10"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "P(A ∩ B) = 3/10; P(B) = 1/2; P(A|B) = ?",
        "answer": "3/5",
        "hint": "(3/10)/(1/2)",
        "solution": "3/5",
        "verification": "(3/5) × (1/2) = 3/10"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "P(A) = 1/2; P(B) = 1/3; A ⫫ B; P(A ∩ B) = ?",
        "answer": "1/6",
        "hint": "(1/2) × (1/3)",
        "solution": "1/6",
        "verification": "6 × (1/6) = 1"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "P(A) = 1/4; P(B) = 1/2; P(A ∩ B) = 0; P(A ∪ B) = ?",
        "answer": "3/4",
        "hint": "1/4 + 1/2 − 0",
        "solution": "3/4",
        "verification": "1 − 3/4 = 1/4"
      }
    ],
    "checks": []
  },
  {
    "id": "distributions",
    "pathId": "probability-statistics",
    "title": "Distributions",
    "learn": [
      "A discrete distribution assigns probabilities to possible values, summing to one. Expected value is the probability-weighted average, not a guaranteed outcome.",
      "A binomial distribution counts successes in a fixed number of independent trials with the same success probability. Real-life trials may violate those assumptions."
    ],
    "check": "Expected values can be impossible individual outcomes: a fair die has mean 3.5 even though no face shows 3.5.",
    "exploration": "distribution",
    "example": {
      "problem": "Find the requested value.",
      "notation": "P(X = 0) = 1/2; P(X = 4) = 1/2; E[X] = ?",
      "steps": [
        "E[X] = 0 × (1/2) + 4 × (1/2) = 2"
      ],
      "verification": "0 ≤ 2 ≤ 4"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "P(X = 0) = 1/2; P(X = 4) = 1/2; E[X] = ?",
        "answer": "2",
        "hint": "0/2 + 4/2",
        "solution": "2",
        "verification": "(0 + 4)/2 = 2"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "X ∼ B(4, 1/2); E[X] = ?",
        "answer": "2",
        "hint": "np = 4 × (1/2)",
        "solution": "2",
        "verification": "4 × (1 − 1/2) = 2"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "X ∼ B(2, 1/2); P(X = 2) = ?",
        "answer": "1/4",
        "hint": "(1/2)²",
        "solution": "1/4",
        "verification": "P(X = 0) + P(X = 1) + P(X = 2) = 1/4 + 1/2 + 1/4 = 1"
      }
    ],
    "checks": []
  },
  {
    "id": "averages-variability",
    "pathId": "probability-statistics",
    "title": "Averages and variability",
    "learn": [
      "The mean divides the total by the count. The median is the middle sorted value, or the mean of the two middle values for an even count.",
      "Population variance averages squared distances from the mean. Sample variance divides by n − 1 when estimating population variance from a sample; spread and units matter."
    ],
    "check": "An outlier can move the mean much more than the median. Variance has squared units; standard deviation restores the original units.",
    "exploration": "data",
    "example": {
      "problem": "Find the requested value.",
      "notation": "(2, 4, 6); x̄ = ?",
      "steps": [
        "x̄ = (2 + 4 + 6)/3 = 4"
      ],
      "verification": "(2 − 4) + (4 − 4) + (6 − 4) = 0"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "(2, 4, 6); x̄ = ?",
        "answer": "4",
        "hint": "(2 + 4 + 6)/3",
        "solution": "4",
        "verification": "3 × 4 = 12"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "(1, 2, 100); x̃ = ?",
        "answer": "2",
        "hint": "1 ≤ 2 ≤ 100",
        "solution": "2",
        "verification": "1 < 2 < 100"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "(2, 4, 6); σ² = ?",
        "answer": "8/3",
        "hint": "((2 − 4)² + (4 − 4)² + (6 − 4)²)/3",
        "solution": "8/3",
        "verification": "s² = 8/(3 − 1) = 4"
      }
    ],
    "checks": []
  },
  {
    "id": "sampling-uncertainty",
    "pathId": "probability-statistics",
    "title": "Sampling and uncertainty",
    "learn": [
      "A sample describes part of a population. Random sampling reduces selection bias; increasing a biased sample does not repair how it was selected.",
      "For independent Bernoulli observations, an approximate standard error is √(p̂(1 − p̂)/n). Normal intervals need adequate success and failure counts and do not include selection bias."
    ],
    "check": "A 95% confidence procedure covers the fixed population parameter in about 95% of repeated samples under its assumptions.",
    "exploration": "sampling",
    "example": {
      "problem": "Find the requested value.",
      "notation": "p̂ = 1/2; n = 100; √(p̂(1 − p̂)/n) = ?",
      "steps": [
        "√((1/2)(1/2)/100) = √(1/400) = 1/20"
      ],
      "verification": "(1/20)² = 1/400"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "p̂ = 1/2; n = 100; √(p̂(1 − p̂)/n) = ?",
        "answer": "1/20",
        "hint": "√(1/400)",
        "solution": "1/20",
        "verification": "(1/20)² = 1/400"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "p̂ = 1/2; n = 400; √(p̂(1 − p̂)/n) = ?",
        "answer": "1/40",
        "hint": "√(1/1600)",
        "solution": "1/40",
        "verification": "(1/40)² = 1/1600"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "n₂/n₁ = 4; p̂₂ = p̂₁; SE₁/SE₂ = ?",
        "answer": "2",
        "hint": "√4",
        "solution": "2",
        "verification": "SE₂ = SE₁/2"
      }
    ],
    "checks": []
  },
  {
    "id": "misleading-charts",
    "pathId": "probability-statistics",
    "title": "Misleading charts",
    "learn": [
      "Check axes, units, denominators, and time windows before interpreting a chart. A truncated bar axis can exaggerate differences in lengths.",
      "Absolute change, relative change, and percentage-point change answer different questions. Association alone does not establish causation."
    ],
    "check": "A rate can rise while its count falls if the denominator shrinks. Compare both the count and the population behind it.",
    "exploration": "charts",
    "example": {
      "problem": "Find the requested value.",
      "notation": "40% → 50%; Δ = ? pp",
      "steps": [
        "50 − 40 = 10"
      ],
      "verification": "(50 − 40)/40 = 1/4 = 25%"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "40% → 50%; Δ = ? pp",
        "answer": "10",
        "hint": "50 − 40",
        "solution": "10",
        "verification": "40 + 10 = 50"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "40 → 50; (50 − 40)/40 = ?",
        "answer": "1/4",
        "hint": "10/40",
        "solution": "1/4",
        "verification": "40 × (1 + 1/4) = 50"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "40 → 50; y₀ = 30; (50 − y₀)/(40 − y₀) = ?",
        "answer": "2",
        "hint": "20/10",
        "solution": "2",
        "verification": "50/40 = 5/4 ≠ 2"
      }
    ],
    "checks": []
  },
  {
    "id": "complements-simulation",
    "pathId": "probability-statistics",
    "title": "Complementary events and simulation checks",
    "learn": [
      "The complement of an event has probability 1 − P(A). For independent trials, at least one success has probability 1 − (1 − p)ⁿ.",
      "Simulation estimates probabilities through repeated trials. Estimates fluctuate and depend on the model; agreement with a formula is a check, not a proof."
    ],
    "check": "Independent trials do not remember previous failures. A losing streak does not make the next success more likely.",
    "exploration": "simulation",
    "example": {
      "problem": "Find the requested value.",
      "notation": "p = 1/2; n = 3; P(X ≥ 1) = ?",
      "steps": [
        "P(X = 0) = (1/2)³ = 1/8",
        "P(X ≥ 1) = 1 − 1/8 = 7/8"
      ],
      "verification": "(1 + 3 + 3)/8 = 7/8"
    },
    "practice": [
      {
        "id": "p1",
        "prompt": "Find the requested value.",
        "notation": "p = 1/2; n = 3; P(X ≥ 1) = ?",
        "answer": "7/8",
        "hint": "1 − (1/2)³",
        "solution": "7/8",
        "verification": "1/8 + 7/8 = 1"
      },
      {
        "id": "p2",
        "prompt": "Find the requested value.",
        "notation": "P(A) = 3/10; P(Aᶜ) = ?",
        "answer": "7/10",
        "hint": "1 − 3/10",
        "solution": "7/10",
        "verification": "3/10 + 7/10 = 1"
      },
      {
        "id": "p3",
        "prompt": "Find the requested value.",
        "notation": "p = 1/2; n = 2; P(X = 0) = ?",
        "answer": "1/4",
        "hint": "(1 − 1/2)²",
        "solution": "1/4",
        "verification": "P(X ≥ 1) = 3/4"
      }
    ],
    "checks": []
  }
];
export const deeperMathLessons: LearningLesson[] = deeperMathActivities.map(activity => ({
  id: activity.id, title: activity.title, description: activity.learn[0],
  route: `/learn/math/${activity.pathId}/${activity.id}`, minutes: 12, subjectId: 'math', pathId: activity.pathId,
  sections: {
    learn: { title: activity.title, paragraphs: activity.learn },
    explore: { title: 'Predict, change, and compare', paragraphs: ['Change one input at a time. Compare the result with the formula and check the assumptions.'] },
    practice: { title: 'Try it yourself', paragraphs: ['Give an exact numeric answer to the quantity requested. Keep domain restrictions and units in your written work.'] },
    check: { title: 'Did you know?', paragraphs: [activity.check] },
  },
}));
export const deeperMathExerciseIds = new Map(deeperMathActivities.map(activity => [activity.id, new Set(activity.practice.map(item => item.id))]));
