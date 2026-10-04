import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSessionRefreshFetch } from "../src/lib/sessionRefreshFetch.ts";

const origin = "https://auth.example.test";
const refreshUrl = `${origin}/auth/v1/token?grant_type=refresh_token`;
const post = { method: "POST" };

test("refresh throttling honours Retry-After and resumes after the cooldown", async () => {
  let now = 0;
  let calls = 0;
  const success = new Response("{}", { status: 200 });
  const fetcher = createSessionRefreshFetch(origin, async () => {
    calls++;
    return calls === 1 ? new Response("{}", { status: 429, headers: { "Retry-After": "120" } }) : success;
  }, () => now);
  await assert.rejects(fetcher(refreshUrl, post), /temporarily rate limited/);
  now = 119_999;
  await assert.rejects(fetcher(new Request(refreshUrl, post)), /temporarily rate limited/);
  assert.equal(calls, 1);
  now = 120_000;
  assert.equal(await fetcher(refreshUrl, post), success);
  assert.equal(calls, 2);
});

test("missing or invalid Retry-After uses a minute cooldown, and HTTP dates are honoured", async () => {
  for (const [header, duration] of [[null, 60_000], ["invalid", 60_000], ["0", 60_000], [new Date(180_000).toUTCString(), 180_000]]) {
    let now = 0;
    let calls = 0;
    const fetcher = createSessionRefreshFetch(origin, async () => {
      calls++;
      return new Response("{}", { status: calls === 1 ? 429 : 200, headers: header === null ? {} : { "Retry-After": header } });
    }, () => now);
    await assert.rejects(fetcher(refreshUrl, post));
    now = duration - 1;
    await assert.rejects(fetcher(refreshUrl, post));
    assert.equal(calls, 1);
    now = duration;
    assert.equal((await fetcher(refreshUrl, post)).status, 200);
  }
});

test("other endpoints and permanent refresh errors keep their original responses", async () => {
  for (const [url, options, status] of [
    [refreshUrl, post, 400], [refreshUrl, post, 401],
    [`${origin}/auth/v1/token?grant_type=password`, post, 429],
    [`${origin}/rest/v1/profiles`, post, 429],
    ["https://other.example.test/auth/v1/token?grant_type=refresh_token", post, 429],
    [refreshUrl, {}, 429],
  ]) {
    const response = new Response("{}", { status });
    const fetcher = createSessionRefreshFetch(origin, async () => response);
    assert.equal(await fetcher(url, options), response);
    assert.equal(await fetcher(url, options), response);
  }
});

for (const [status, guarded, retained] of [[429, false, false], [429, true, true], [400, true, false]]) {
test(`real SDK: ${status} refresh ${guarded ? "with" : "without"} cooldown ${retained ? "preserves" : "clears"} the session`, async context => {
  context.mock.method(console, "error", () => {});
  context.mock.method(console, "warn", () => {});
  const storageKey = "rate-limit-regression";
  const stored = new Map();
  const session = {
    access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "test-user", aud: "authenticated" },
  };
  stored.set(storageKey, JSON.stringify(session));
  let calls = 0;
  const fetcher = async () => {
    calls++;
    if (calls > 1) return new Response(JSON.stringify({ ...session, refresh_token: "rotated-test-token", expires_at: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
    return new Response(JSON.stringify({ code: status === 429 ? "over_request_rate_limit" : "refresh_token_not_found", msg: "Refresh rejected" }), { status });
  };
  const client = createClient(origin, "test-key", {
    auth: {
      storageKey, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    },
    global: { fetch: guarded ? createSessionRefreshFetch(origin, fetcher) : fetcher },
  });
  await client.auth.initialize();
  const events = [];
  const { data: { subscription } } = client.auth.onAuthStateChange(event => { events.push(event); });
  context.after(() => subscription.unsubscribe());
  // The token is expired; a raw 429 would remove it and emit SIGNED_OUT.
  session.expires_at = Math.floor(Date.now() / 1000) - 1;
  stored.set(storageKey, JSON.stringify(session));
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.now() });
  const pending = client.auth.refreshSession();
  await new Promise(resolve => setImmediate(resolve));
  context.mock.timers.tick(30_000);
  const { error } = await pending;
  assert.equal(error?.name, retained ? "AuthRetryableFetchError" : "AuthApiError");
  assert.equal(calls, 1);
  assert.equal(stored.has(storageKey), retained);
  assert.equal(events.includes("SIGNED_OUT"), !retained);
  if (retained) {
    assert.equal(JSON.parse(stored.get(storageKey)).refresh_token, session.refresh_token);
    context.mock.timers.tick(60_000);
    const recovered = await client.auth.getSession();
    assert.equal(recovered.error, null);
    assert.equal(recovered.data.session.refresh_token, "rotated-test-token");
    assert.ok(events.includes("TOKEN_REFRESHED"));
    assert.equal(calls, 2);
  }
});
}
