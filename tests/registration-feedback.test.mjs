import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => mocks[name] ?? require(name), exports);
  return exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children);
}
function loginFixture(result) {
  const states = []; let slot = 0, language = 'en'; const calls = [];
  const component = load('../src/pages/general/LoginPage.tsx', {
    react: { useState(initial) { const index = slot++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; } },
    'react-router-dom': { Link: 'a', useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams('mode=register')] },
    '../../context/AuthContext': { useAuth: () => ({ signUp: async (...args) => { calls.push(args); return result; } }) },
    '@/i18n/languageStore': { useAppLanguage: () => ({ language, setLanguage: next => { language = next; } }) },
  }).default;
  const render = () => { slot = 0; return component(); };
  async function register() {
    const fields = nodes(render(), node => node.type === 'input');
    for (const [field, value] of fields.map((field, index) => [field, index ? 'test-password' : '  player@example.test  '])) field.props.onChange({ target: { value } });
    await nodes(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    return render();
  }
  return { render, register, calls, setLanguage: next => { language = next; } };
}

test('confirmation box contains English spam reminder and switches to German with the active language', async () => {
  const fixture = loginFixture({ error: null, needsEmailConfirmation: true });
  assert.equal(nodes(fixture.render(), node => node.props?.role === 'status').length, 0);
  let tree = await fixture.register();
  let status = nodes(tree, node => node.props?.role === 'status')[0];
  assert.match(text(status), /Check your email.*spam or junk folder/);
  assert.deepEqual(fixture.calls, [['player@example.test', 'test-password']]);
  fixture.setLanguage('de');
  tree = fixture.render();
  status = nodes(tree, node => node.props?.role === 'status')[0];
  assert.match(text(status), /Bestätigungslink.*Spam- oder Junk-Ordner/);
  nodes(tree, node => node.type === 'button' && text(node) === 'Anmelden')[0].props.onClick();
  assert.equal(nodes(fixture.render(), node => node.props?.role === 'status').length, 0);
});

test('immediately signed-in registrations do not ask users to check email or spam', async () => {
  const tree = await loginFixture({ error: null, needsEmailConfirmation: false }).register();
  const status = nodes(tree, node => node.props?.role === 'status')[0];
  assert.match(text(status), /account has been created/);
  assert.doesNotMatch(text(status), /spam|confirmation link/);
});

test('failed registrations display an error without a success or spam message', async () => {
  const tree = await loginFixture({ error: new Error('Registration failed'), needsEmailConfirmation: false }).register();
  assert.equal(nodes(tree, node => node.props?.role === 'status').length, 0);
  assert.equal(text(nodes(tree, node => node.props?.role === 'alert')[0]), 'Registration failed');
});

test('Supabase session presence controls whether confirmation is needed', async () => {
  for (const [session, error, expected] of [[null, null, true], [{ access_token: 'test' }, null, false], [null, { message: 'Rejected' }, false]]) {
    const provider = load('../src/context/AuthContext.tsx', {
      react: { useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useCallback: fn => fn, useEffect: () => {} },
      '../lib/supabase': { supabase: { auth: { signUp: async () => ({ data: { session }, error }) } } },
      './authState': { AuthContext: { Provider: 'provider' } },
    }).AuthProvider;
    const result = await provider({ children: null }).props.value.signUp('player@example.test', 'test-password');
    assert.equal(result.needsEmailConfirmation, expected);
    assert.equal(result.error?.message ?? null, error?.message ?? null);
  }
});
