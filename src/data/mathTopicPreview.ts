import { foundationActivities } from './mathFoundations.ts';
import { percentageActivities } from './everydayPercentages.ts';
import { advancedMathActivities } from './advancedMath.ts';
import { deeperMathActivities } from './deeperMath.ts';

/** The same worked examples used in lessons; no separate preview curriculum. */
export function mathTopicExample(lessonId: string): { problem: string; notation?: string; steps: string[]; verification: string } | undefined {
  return [...foundationActivities, ...percentageActivities, ...advancedMathActivities, ...deeperMathActivities].find(activity => activity.id === lessonId)?.example;
}
