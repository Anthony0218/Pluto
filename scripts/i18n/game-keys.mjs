import fs from 'node:fs';
import ts from 'typescript';

export const gameUiRoots = [
  'src/pages/games', 'src/pages/schafkopf', 'src/components/Schafkopf',
  'src/components/Watten', 'src/components/chess', 'src/components/chess3d',
  'src/components/chessCustom', 'src/components/cardBuilder', 'src/components/strategy',
  'src/components/natura', 'src/components/atlas', 'src/components/MedievalKingdoms',
  'src/components/ranked', 'src/games',
];
const attributes = new Set(['title', 'aria-label', 'aria-description', 'placeholder', 'alt', 'subtitle', 'description', 'label', 'eyebrow', 'detail', 'hint', 'text', 'subtext', 'heading', 'tooltip', 'helper', 'emptyMessage', 'buttonLabel']);
const fields = new Set(['title', 'label', 'text', 'description', 'summary', 'hint', 'notice', 'message', 'habitat', 'subjects', 'category', 'difficulty', 'instructions', 'caption', 'reason', 'tip', 'rules', 'detail', 'objective', 'name', 'players', 'promoted', 'question', 'prompt', 'explanation', 'feedback', 'highest', 'lowest', 'unit', 'controls', 'winCondition', 'howToPlay', 'translation']);
export const normalizeGameKey = text => text.replace(/\s+/g, ' ').trim();

/** UI prose and display data, excluding CSS, protocol IDs and persisted game values. */
export function collectGameKeys() {
  const keys = new Set();
  const add = text => {
    const key = normalizeGameKey(text);
    if (/[\p{L}]{2}/u.test(key) && !/^(?:https?:|\/|#|\.|[\w-]+\.(?:png|svg|jpg|mp3))/.test(key)) keys.add(key);
  };
  function literals(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
    else if (ts.isTemplateExpression(node)) add(node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join(''));
    else if (ts.isConditionalExpression(node)) { literals(node.whenTrue); literals(node.whenFalse); }
    else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(literals);
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) { literals(node.left); literals(node.right); }
    else if (ts.isCallExpression(node) && /^(?:gameUi|ui|t|translateUi|translateChess|translateWatten)$/.test(node.expression.getText())) node.arguments.filter(ts.isStringLiteral).forEach(literals);
  }
  const files = gameUiRoots.flatMap(root => fs.readdirSync(root, { recursive: true }).filter(name => /\.tsx?$/.test(name) && !name.includes('/i18n/')).map(name => `${root}/${name}`));
  files.push('src/data/games.ts', 'src/data/chessVariants.ts');
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function translatedTable(node) {
      for (let parent = node; parent; parent = parent.parent) if (ts.isVariableDeclaration(parent) && /translations|^(?:de|bar|ko|ru)$/i.test(parent.name.getText(source))) return true;
      return false;
    }
    function visit(node) {
      if (ts.isJsxText(node)) add(node.text);
      if (ts.isJsxExpression(node) && node.expression && (!ts.isJsxAttribute(node.parent) || attributes.has(node.parent.name.text))) literals(node.expression);
      if (ts.isJsxAttribute(node) && attributes.has(node.name.text) && node.initializer) literals(node.initializer);
      if (ts.isPropertyAssignment(node) && !translatedTable(node) && fields.has(node.name.getText(source).replace(/["']/g, ''))) literals(node.initializer);
      if (ts.isReturnStatement(node) && node.expression && /[\p{L}]{2}\s/u.test(node.expression.getText(source))) literals(node.expression);
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && /\.(?:notice|message|detail|error|reason|hint)$/.test(node.left.getText(source))) literals(node.right);
      if (ts.isCallExpression(node) && /(?:^(?:gameUi|ui|setError|setNotice|setMessage|setFeedback|setStatus)$|\.(?:fillText|strokeText|push)$)/.test(node.expression.getText(source))) node.arguments.forEach(literals);
      if (ts.isCallExpression(node) && /\.label$/.test(node.expression.getText(source)) && node.arguments[1]) literals(node.arguments[1]);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map') {
        let array = node.expression.expression;
        while (ts.isParenthesizedExpression(array) || ts.isAsExpression(array)) array = array.expression;
        if (ts.isArrayLiteralExpression(array)) for (const item of array.elements) {
          if (ts.isArrayLiteralExpression(item) && item.elements.length > 1 && ts.isStringLiteral(item.elements[0]) && /^[a-z][\w-]*$/.test(item.elements[0].text)) item.elements.slice(1).forEach(literals);
          else literals(item);
        }
      }
      if (ts.isNewExpression(node) && node.expression.getText(source) === 'Error') node.arguments?.forEach(literals);
      if (ts.isVariableDeclaration(node) && /^(?:glossary|pieces|modes|cardDecks|avatars|PATTERN_NAMES|BID_NAMES|RUF_SAU_NAMES|PLAY_PHRASES|AI_DIFFICULTY_OPTIONS)$/.test(node.name.getText(source)) && node.initializer) {
        const strings = child => { if (ts.isStringLiteral(child)) add(child.text); else ts.forEachChild(child, strings); };
        strings(node.initializer);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const name of fs.readdirSync('src/games/schafkopf/docs').filter(name => name.endsWith('.md'))) {
    let code = false;
    for (let line of fs.readFileSync(`src/games/schafkopf/docs/${name}`, 'utf8').split('\n')) {
      line = line.trim();
      if (line.startsWith('```')) { code = !code; continue; }
      if (code) continue;
      line = line.replace(/^#{1,6}\s+|^>\s?|^(?:[-*]|\d+\.)\s+/, '');
      for (const cell of line.startsWith('|') ? line.slice(1, -1).split('|').map(cell => cell.trim()) : [line]) {
        add(cell);
      }
    }
  }
  return [...keys].sort();
}
