import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, modules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2023, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(name => modules[name] ?? require(name), exports);
  return exports;
}
const helpers = load('../src/lib/passwordRecovery.ts');
function mount({ mode = 'forgot', user = null, loading = false, response = { error: null } } = {}) {
  let cursor = 0;
  const states = [], calls = [];
  let finished = false;
  const react = { ...React, useState(initial) {
    const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
  } };
  globalThis.window = { location: { origin: 'https://pluto.example', search: '', hash: '' } };
  const Page = load('../src/pages/general/LoginPage.tsx', {
    react,
    'react-router-dom': {
      Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
      useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams({ mode })],
    },
    '../../context/AuthContext': { useAuth: () => ({ user, loading,
      finishPasswordRecovery: () => { finished = true; },
      signIn: async () => ({ error: null }), signUp: async () => ({ error: null }),
    }) },
    '@/i18n/languageStore': { useAppLanguage: () => ({ language: 'en', setLanguage() {} }) },
    '@/lib/passwordRecovery': helpers,
    '@/lib/supabase': { supabase: { auth: {
      resetPasswordForEmail: async (...args) => { calls.push(['email', ...args]); return response; },
      updateUser: async (...args) => { calls.push(['update', ...args]); return response; },
    } } },
  }).default;
  const render = () => { cursor = 0; return Page({ resetPassword: mode === 'reset' }); };
  return { render, calls, finished: () => finished };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
const submit = tree => nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} });

test('recovery helpers keep callbacks on the current origin and validate passwords/errors', () => {
  assert.equal(helpers.passwordResetUrl('https://pluto.example'), 'https://pluto.example/reset-password');
  assert.equal(helpers.passwordResetValidation('short', 'short'), 'short');
  assert.equal(helpers.passwordResetValidation('password-one', 'password-two'), 'mismatch');
  assert.equal(helpers.passwordResetValidation('password-one', 'password-one'), null);
  assert.equal(helpers.hasRecoveryError('', '#error_code=otp_expired'), true);
  assert.equal(helpers.hasRecoveryError('?error=access_denied', ''), true);
  assert.equal(helpers.hasRecoveryError('', '#type=recovery'), false);
});
test('forgot-password requests a trimmed email and shows a neutral confirmation without a password field', async () => {
  const page = mount();
  const inputs = nodes(page.render(), 'input');
  assert.equal(inputs.length, 1);
  inputs[0].props.onChange({ target: { value: ' person@example.test ' } });
  await submit(page.render());
  assert.deepEqual(page.calls, [['email', 'person@example.test', { redirectTo: 'https://pluto.example/reset-password' }]]);
  assert.match(renderToStaticMarkup(page.render()), /If an account exists/);
});
test('a failed reset request shows the service error and allows another attempt', async () => {
  const page = mount({ response: { error: new Error('Email service unavailable') } });
  nodes(page.render(), 'input')[0].props.onChange({ target: { value: 'person@example.test' } });
  await submit(page.render());
  const markup = renderToStaticMarkup(page.render());
  assert.match(markup, /Email service unavailable/);
  assert.doesNotMatch(markup, /If an account exists/);
  assert.equal(nodes(page.render(), 'button').find(button => button.props.type === 'submit').props.disabled, false);
});
test('missing recovery session cannot submit a password and offers a replacement link', () => {
  const page = mount({ mode: 'reset' });
  const tree = page.render();
  assert.equal(nodes(tree, 'form').length, 0);
  assert.match(renderToStaticMarkup(tree), /invalid or has expired/);
  assert.match(renderToStaticMarkup(tree), /href="\/login\?mode=forgot"/);
  assert.equal(page.calls.length, 0);
});
test('mismatched passwords never reach updateUser; a valid reset updates and clears the fields', async () => {
  const page = mount({ mode: 'reset', user: { id: 'test-user' } });
  let inputs = nodes(page.render(), 'input');
  inputs[0].props.onChange({ target: { value: 'new-test-password' } });
  inputs[1].props.onChange({ target: { value: 'another-test-password' } });
  await submit(page.render());
  assert.equal(page.calls.length, 0);
  assert.match(renderToStaticMarkup(page.render()), /Passwords do not match/);
  inputs = nodes(page.render(), 'input');
  inputs[1].props.onChange({ target: { value: 'new-test-password' } });
  await submit(page.render());
  assert.deepEqual(page.calls, [['update', { password: 'new-test-password' }]]);
  assert.equal(page.finished(), true);
  assert.equal(nodes(page.render(), 'input').length, 0);
  assert.match(renderToStaticMarkup(page.render()), /Your password has been updated/);
});
test('restoring a recovery session disables submission until auth settles', () => {
  const page = mount({ mode: 'reset', loading: true });
  const tree = page.render();
  assert.match(renderToStaticMarkup(tree), /Checking your reset link/);
  assert.equal(nodes(tree, 'button').find(button => button.props.type === 'submit').props.disabled, true);
});
test('server password-policy rejection preserves the form and recovery state', async () => {
  const page = mount({ mode: 'reset', user: { id: 'test-user' }, response: { error: new Error('Password policy rejected') } });
  const inputs = nodes(page.render(), 'input');
  for (const input of inputs) input.props.onChange({ target: { value: 'new-test-password' } });
  await submit(page.render());
  assert.match(renderToStaticMarkup(page.render()), /Password policy rejected/);
  assert.equal(nodes(page.render(), 'input').length, 2);
  assert.equal(page.finished(), false);
});
