import { mealNames } from '../../src/data/calorieTools.ts';
import { footballReferenceKeys } from '../../src/data/footballReference.ts';
import { subjectContentKeys } from '../../src/data/musicFootball.ts';
import { musicInstruments, rhythmPatterns, clefNames, drumNames } from '../../src/data/musicReading.ts';
import { offsideLabels, roleResponsibilities } from '../../src/data/footballLearning.ts';
import { honoursLabels } from '../../src/data/footballHonours.ts';
import fs from 'node:fs';
import ts from 'typescript';
import { learningSubjects, learningPaths, learningLessons, lessonStageLabels } from '../../src/data/learningCatalog.ts';
import { advancedMathActivities } from '../../src/data/advancedMath.ts';
import { deeperMathActivities } from '../../src/data/deeperMath.ts';
import { everydayMathCases } from '../../src/data/everydayMathCases.ts';
import { deeperMathLabels } from '../../src/data/deeperMathLabels.ts';
import { percentageActivities } from '../../src/data/everydayPercentages.ts';
import { percentageLabels, percentageFields } from '../../src/data/practicalMath.ts';
import { unitGroups } from '../../src/data/unitConversions.ts';
import { foundationActivities } from '../../src/data/mathFoundations.ts';
import { toolApps, toolCategories } from '../../src/data/toolCatalog.ts';

// Shared by the coverage test. Catalog IDs and mathematical notation are not prose.
export function collectLearningKeys() {
  const keys = new Set();
  const add = value => { if (typeof value === 'string' && /[A-Za-z]{2}/.test(value.replace(/\b(?:km|cm|mm|kg|ml|min|VAT)\b/g, ''))) keys.add(value.replace(/\s+/g, ' ').trim()); };
  Object.values(lessonStageLabels).forEach(add);
  for (const item of learningSubjects) [item.title, item.description, item.resourceLabel].forEach(add);
  for (const item of learningPaths) [item.title, item.description, ...item.topics].forEach(add);
  for (const item of learningLessons) {
    [item.title, item.description].forEach(add);
    for (const section of Object.values(item.sections)) [section.title, ...section.paragraphs, ...section.points ?? []].forEach(add);
  }
  Object.values(percentageLabels).forEach(add);
  Object.values(percentageFields).flat().forEach(add);
  unitGroups.forEach(add);
  deeperMathLabels.forEach(add);
  subjectContentKeys.forEach(add);
  footballReferenceKeys.forEach(add);
  ['Choose a category, then open any explanation that interests you.', 'Club honours and World Cup winners, with dated records and sources.'].forEach(add);
  drumNames.forEach(add);
  offsideLabels.forEach(add);
  Object.values(roleResponsibilities).forEach(item => Object.values(item).forEach(add));
  honoursLabels.forEach(add);
  Object.values(clefNames).forEach(add);
  musicInstruments.forEach(item => [item.name, item.description].forEach(add));
  rhythmPatterns.forEach(item => [item.name, item.unit].forEach(add));
  Object.values(everydayMathCases).forEach(item => add(item.situation));
  // Deeper-course steps, hints, solutions, and verifications are mathematical
  // notation (including matrix products such as Ax), separate from UI prose.
  for (const item of deeperMathActivities) {
    add(item.example.problem);
    for (const question of item.practice) add(question.prompt);
  }
  for (const item of [...foundationActivities, ...percentageActivities, ...advancedMathActivities]) {
    [item.example.problem, ...item.example.steps, item.example.verification].forEach(add);
    for (const question of [...item.practice, ...item.checks]) [question.prompt, question.hint, question.solution, question.verification].forEach(add);
  }
  ['Work', 'Rest', 'Finished'].forEach(add);
  toolCategories.forEach(add);
  mealNames.forEach(add);
  ['Delivery test','This device received the test.'].forEach(add);
  add("All categories");
  for (const tool of toolApps) [tool.title, tool.description, ...(tool.status === "planned" ? tool.features : [])].forEach(add);
  const files = ['src/pages/general/LearnPage.tsx', ...fs.readdirSync('src/pages/tools').filter(name => name.endsWith('.tsx')).map(name => 'src/pages/tools/' + name), ...fs.readdirSync('src/components/tools').filter(name => name.endsWith('.tsx')).map(name => 'src/components/tools/' + name), ...fs.readdirSync('src/pages/learn').filter(name => name.endsWith('.tsx')).map(name => 'src/pages/learn/' + name), ...fs.readdirSync('src/components/learning').filter(name => name.endsWith('.tsx')).map(name => 'src/components/learning/' + name)];
  function literals(node) {
    if (ts.isStringLiteral(node)) add(node.text);
    else if (ts.isConditionalExpression(node)) { literals(node.whenTrue); literals(node.whenFalse); }
    else if (ts.isPropertyAssignment(node)) literals(node.initializer);
    else ts.forEachChild(node, literals);
  }
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && ['ui', 'setMessage', 'setFeedback'].includes(node.expression.getText(source))) node.arguments.forEach(literals);
      if (ts.isJsxAttribute(node) && ['title','description','eyebrow','label'].includes(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer.text);
      if (ts.isVariableDeclaration(node) && ['placeNames', 'calculationErrors', 'baseNames', 'views', 'situations', 'deliveryLabels', 'months'].includes(node.name.getText(source)) && node.initializer) literals(node.initializer);
      if (ts.isArrayLiteralExpression(node) && node.elements.some(item => ts.isStringLiteral(item) && ['Addition','Subtraction','Borrowing through zero','Local time'].includes(item.text))) literals(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const calculations = ts.createSourceFile('practicalMath', fs.readFileSync('src/data/practicalMath.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  function resultLabel(node) { if (ts.isPropertyAssignment(node) && node.name.getText(calculations) === 'label' && ts.isStringLiteral(node.initializer)) add(node.initializer.text); ts.forEachChild(node, resultLabel); }
  resultLabel(calculations);
  const navigation = ts.createSourceFile('navigation', fs.readFileSync('src/data/navigation.ts','utf8'), ts.ScriptTarget.Latest, true);
  function resource(node) { if (ts.isVariableDeclaration(node) && node.name.getText(navigation) === 'learningResources') {
    function field(item) { if (ts.isPropertyAssignment(item) && ['title','description'].includes(item.name.getText(navigation)) && ts.isStringLiteral(item.initializer)) add(item.initializer.text); ts.forEachChild(item, field); }
    field(node.initializer);
  } ts.forEachChild(node,resource); }
  resource(navigation);
  return [...keys];
}
