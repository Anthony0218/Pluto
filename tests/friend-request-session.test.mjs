import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { sendFriendRequest } from "../src/data/friendRequests.ts";
import { createSessionRefreshFetch } from "../src/lib/sessionRefreshFetch.ts";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const carol = "00000000-0000-4000-8000-000000000003";

test("the production RLS policy allows two friends and rejects missing identity, forged senders and self requests", async context => {
  const db = new PGlite();
  context.after(() => db.close());
  await db.exec(`
    create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table public.friend_requests(id uuid primary key default gen_random_uuid(), sender_id uuid, receiver_id uuid, status text);
    alter table public.friend_requests enable row level security;
    grant select, insert on public.friend_requests to authenticated;
    create policy "users can send friend requests" on public.friend_requests for insert to authenticated
      with check ((sender_id = auth.uid()) AND (receiver_id <> auth.uid()));
    create policy "participants can read friend requests" on public.friend_requests for select to authenticated
      using ((sender_id = auth.uid()) OR (receiver_id = auth.uid()));
    set role authenticated;
  `);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
  const insert = (sender, receiver) => db.query("insert into public.friend_requests(sender_id, receiver_id, status) values ($1, $2, 'pending')", [sender, receiver]);
  await insert(alice, bob);
  await insert(alice, carol);
  assert.equal((await db.query("select count(*)::int as n from public.friend_requests")).rows[0].n, 2);
  await assert.rejects(insert(bob, carol), /row-level security/);
  await assert.rejects(insert(alice, alice), /row-level security/);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await assert.rejects(insert(alice, bob), /row-level security/);
});

for (const guarded of [false, true]) {
  test(`a refresh 429 after the first friend ${guarded ? "blocks the unauthenticated insert and recovers" : "reproduces the RLS error"}`, async context => {
    context.mock.method(console, "error", () => {});
    context.mock.method(console, "warn", () => {});
    const origin = "https://friend-requests.example.test";
    const storageKey = "friend-session";
    const session = {
      access_token: "test-user-jwt", refresh_token: "test-refresh-token", token_type: "bearer",
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: alice, aud: "authenticated" },
    };
    const stored = new Map([[storageKey, JSON.stringify(session)]]);
    const inserts = [];
    let refreshCalls = 0;
    const client = createClient(origin, "test-anon-key", {
      auth: {
        storageKey, autoRefreshToken: false, detectSessionInUrl: false,
        storage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
      },
      global: { fetch: createSessionRefreshFetch(origin, async (input, init) => {
        if (String(input).includes("/auth/v1/token")) {
          refreshCalls++;
          return refreshCalls === 1
            ? new Response(JSON.stringify({ code: "over_request_rate_limit", msg: "Too many requests" }), { status: 429 })
            : new Response(JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
        }
        const row = JSON.parse(init.body);
        const authorization = new Headers(init.headers).get("Authorization");
        inserts.push({ row, authorization });
        const authorized = authorization === `Bearer ${session.access_token}` && row.sender_id === alice && row.receiver_id !== alice;
        return authorized
          ? new Response(null, { status: 201 })
          : new Response(JSON.stringify({ code: "42501", message: 'new row violates row-level security policy for table "friend_requests"' }), { status: 403 });
      }) },
    });
    await client.auth.initialize();
    const send = receiver => guarded
      ? sendFriendRequest(client, alice, receiver)
      : client.from("friend_requests").insert({ sender_id: alice, receiver_id: receiver, status: "pending" });
    assert.equal((await send(bob)).error, null);
    session.expires_at = Math.floor(Date.now() / 1000) - 1;
    stored.set(storageKey, JSON.stringify(session));
    context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.now() });
    const pending = Promise.resolve(send(carol));
    await new Promise(resolve => setImmediate(resolve));
    context.mock.timers.tick(30_000);
    const { error } = await pending;
    assert.equal(error.code, guarded ? "AUTH_SESSION_UNAVAILABLE" : "42501");
    assert.equal(inserts.length, guarded ? 1 : 2);
    assert.equal(refreshCalls, 1);
    assert.ok(stored.has(storageKey));
    if (guarded) {
      assert.match(error.message, /Wait a minute/);
      context.mock.timers.tick(60_000);
      assert.equal((await send(carol)).error, null);
      assert.deepEqual(inserts.map(({ row }) => row.receiver_id), [bob, carol]);
      assert.ok(inserts.every(({ authorization }) => authorization === `Bearer ${session.access_token}`));
    }
  });
}

test("missing sessions, account changes and self requests never reach the database", async () => {
  for (const [session, receiver, code] of [
    [null, bob, "AUTH_SESSION_MISSING"],
    [{ access_token: "test", user: { id: bob } }, carol, "AUTH_ACCOUNT_CHANGED"],
    [{ access_token: "test", user: { id: alice } }, alice, "SELF_FRIEND_REQUEST"],
  ]) {
    const client = {
      auth: { getSession: async () => ({ data: { session }, error: null }) },
      from() { assert.fail("An unauthorized request must not reach the database"); },
    };
    assert.equal((await sendFriendRequest(client, alice, receiver)).error.code, code);
  }
});
