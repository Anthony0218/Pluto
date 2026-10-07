import { subjectExerciseIds } from './musicFootball.ts';
import { foundationExerciseIds } from './mathFoundations.ts';
import { percentageExerciseIds } from './everydayPercentages.ts';
import { advancedMathExerciseIds } from './advancedMath.ts';
import { deeperMathExerciseIds } from './deeperMath.ts';
export const mathExerciseIds = new Map([...foundationExerciseIds, ...percentageExerciseIds, ...advancedMathExerciseIds, ...deeperMathExerciseIds, ...subjectExerciseIds]);
