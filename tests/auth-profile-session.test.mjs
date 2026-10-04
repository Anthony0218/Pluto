import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function loadComponent(path, modules) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2023,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)(name => modules[name] ?? require(name), exports);
  return exports;
}

const alice = { id: "alice", email: "alice@example.test", created_at: "2026-01-01T00:00:00Z" };
const bob = { ...alice, id: "bob" };
const session = user => ({ user });

// Drive the provider's real subscription with controlled async SDK responses.
function mountAuth() {
  const states = [];
  const effects = [];
  let resolveSession;
  let notify;
  let unsubscribed = false;
  const initialSession = new Promise(resolve => { resolveSession = resolve; });
  const react = {
    ...React,
    useState(initial) {
      const index = states.length;
      states.push(initial);
      return [initial, next => { states[index] = next; }];
    },
    useRef: initial => ({ current: initial }),
    useCallback: callback => callback,
    useEffect: effect => { effects.push(effect); },
  };
  const { AuthProvider } = loadComponent("../src/context/AuthContext.tsx", {
    react,
    "./authState": { AuthContext: React.createContext(null) },
    "../lib/supabase": { supabase: { auth: {
      getSession: () => initialSession,
      onAuthStateChange(callback) {
        notify = callback;
        return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
      },
    } } },
  });
  AuthProvider({ children: null });
  const cleanup = effects[0]();
  return {
    states,
    notify: (event, value) => notify(event, value),
    async resolve(value) {
      resolveSession({ data: { session: value } });
      await initialSession;
    },
    cleanup,
    get unsubscribed() { return unsubscribed; },
  };
}

test("delayed initial-session snapshots cannot log out a newly signed-in user", async () => {
  const auth = mountAuth();
  auth.notify("SIGNED_IN", session(alice));
  assert.equal(auth.states[0], alice);
  auth.notify("INITIAL_SESSION", null);
  await auth.resolve(null);
  assert.equal(auth.states[0], alice);
  assert.equal(auth.states[2], true);
  auth.cleanup();
});

test("late startup snapshots cannot restore a logged-out user or switch accounts back", async () => {
  const auth = mountAuth();
  auth.notify("SIGNED_IN", session(alice));
  auth.notify("SIGNED_IN", session(bob));
  auth.notify("INITIAL_SESSION", session(alice));
  assert.equal(auth.states[0], bob);
  auth.notify("SIGNED_OUT", null);
  auth.notify("INITIAL_SESSION", session(alice));
  await auth.resolve(session(alice));
  assert.equal(auth.states[0], null);
  assert.equal(auth.states[1], null);
  assert.equal(auth.states[2], false);
  auth.cleanup();
});

test("startup still restores a session and ordinary auth events remain authoritative", async () => {
  const auth = mountAuth();
  auth.notify("INITIAL_SESSION", session(alice));
  await auth.resolve(null);
  assert.equal(auth.states[0], alice);
  auth.notify("TOKEN_REFRESHED", session(bob));
  assert.equal(auth.states[0], bob);
  auth.notify("SIGNED_OUT", null);
  assert.equal(auth.states[0], null);
  auth.cleanup();
});

test("unmounted providers ignore pending session work", async () => {
  const auth = mountAuth();
  auth.cleanup();
  await auth.resolve(session(alice));
  auth.notify("SIGNED_IN", session(alice));
  assert.equal(auth.states[0], null);
  assert.equal(auth.unsubscribed, true);
});

function profileMarkup(auth) {
  const source = readFileSync(new URL("../src/pages/social/ProfilePage.tsx", import.meta.url), "utf8");
  // Child widgets are irrelevant to the page's authentication branches.
  const modules = Object.fromEntries([...source.matchAll(/from\s+"([^"]+)"/g)]
    .map(([, name]) => [name, { __esModule: true, default: () => null }]));
  Object.assign(modules, {
    react: { ...React, useEffect() {} },
    "@/context/AuthContext": { useAuth: () => auth },
    "@/i18n/ui": { ui: text => text, useUiLanguage: () => ({ language: "en" }) },
    "@/components/social/useCustomAvatars": { useCustomAvatars: () => ({ customAvatars: [] }) },
    "@/data/dashboard": { featuredGames: [] },
    "../../components/social/ProfileAvatarPicker": { __esModule: true, default: () => null, ProfileAvatar: () => null },
    "../../components/App/notifications/DoNotDisturbSwitch": { __esModule: true, default: () => null, ClanPopupsSwitch: () => null },
    "lucide-react": require("lucide-react"),
  });
  const ProfilePage = loadComponent("../src/pages/social/ProfilePage.tsx", modules).default;
  return renderToStaticMarkup(React.createElement(ProfilePage));
}

test("profile waits for auth restoration before showing the signed-out message", () => {
  const html = profileMarkup({ user: null, profile: null, loading: true });
  assert.match(html, /role="status"/);
  assert.match(html, /Loading/);
  assert.doesNotMatch(html, /Not signed in|Sign in to view your profile/);
});

test("profile shows the signed-out message only after auth has settled", () => {
  assert.match(profileMarkup({ user: null, profile: null, loading: false }), /Not signed in/);
});

test("signed-in users retain the profile while profile data is loading", () => {
  const html = profileMarkup({ user: alice, profile: null, loading: true });
  assert.match(html, /Pluto player profile/);
  assert.doesNotMatch(html, /Not signed in/);
});
