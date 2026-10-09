import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function("require", "exports", source)(name => mocks[name] ?? require(name), exports);
  return exports;
}
const routes = load("../src/components/social/inviteRoute.ts", { "@/data/chessVariants": { variants: [] } });

test("every room that can be invited to has a way to give its seat back", async () => {
  const calls = [];
  const supabase = { rpc: async (name, args) => { calls.push([name, args.p_code]); return {}; }, functions: { invoke: async (name, { body }) => { calls.push([name, body.op, body.code]); return {}; } } };
  const { leaveRoom } = load("../src/components/social/leaveRoom.ts", { "@/lib/supabase": { supabase } });
  const expected = {
    "/games/chess/classic/multiplayer": ["leave_chess_room", "ABC123"],
    "/games/chess/variants/4-players/multiplayer": ["leave_variant_room", "ABC123"],
    "/games/chess/variants/fog-of-war/multiplayer": ["leave_variant_room", "ABC123"],
    "/games/watten/multiplayer/4": ["leave_watten_room", "ABC123"],
    "/games/watten/multiplayer/3": ["leave_watten3_room", "ABC123"],
    "/games/schafkopf/multiplayer": ["schafkopf-multiplayer", "leave", "ABC123"],
    "/games/atlas-arena/multiplayer": ["atlas-match", "leave", "ABC123"],
    "/games/eat-it/multiplayer": ["eat-it-match", "leave", "ABC123"],
    "/games/go/multiplayer": ["strategy-match", "leave", "ABC123"],
    "/games/shogi/multiplayer": ["strategy-match", "leave", "ABC123"],
    "/games/card-builder/room": ["card-games", "leaveRoom", "ABC123"],
    "/chess-custom/play/multiplayer": ["chess-custom-match", "leave", "ABC123"],
  };
  for (const [lobbyRoute, call] of Object.entries(expected)) {
    calls.length = 0;
    // The route must be one the invite UI recognises as a room in the first place.
    const url = lobbyRoute === "/chess-custom/play/multiplayer" ? [lobbyRoute, "?room=ABC123"] : [`${lobbyRoute}/ABC123`, ""];
    assert.deepEqual(routes.currentRoomInvite(...url), { lobbyRoute, code: "ABC123" }, lobbyRoute);
    await leaveRoom({ lobbyRoute, code: "ABC123" });
    assert.deepEqual(calls, [call], lobbyRoute);
  }
  // Matchmade ranked rooms are not left this way, and a failing backend never blocks the invite.
  calls.length = 0;
  await leaveRoom({ lobbyRoute: "/games/chess/ranked", code: "ABC123" });
  assert.deepEqual(calls, []);
  supabase.rpc = async () => { throw new Error("offline"); };
  await leaveRoom({ lobbyRoute: "/games/chess/classic/multiplayer", code: "ABC123" });
});

test("accepting an invite leaves the open room, but not the room the invite is for", () => {
  const left = [], effects = [], priorWindow = globalThis.window;
  const room = load("../src/components/social/currentRoom.ts", {
    react: { useRef: current => ({ current }), useEffect: effect => effects.push(effect), useSyncExternalStore: (_subscribe, get) => get() },
    "react-router-dom": { useLocation: () => globalThis.window.location },
    "./inviteRoute": routes,
    "./leaveRoom": { leaveRoom: async target => { left.push(target); } },
  });
  try {
    globalThis.window = { location: { pathname: "/games/chess/classic/multiplayer/ABC123", search: "" } };
    room.leaveCurrentRoom("abc123 ");
    assert.deepEqual(left, []);
    room.leaveCurrentRoom("XYZ789");
    assert.deepEqual(left, [{ lobbyRoute: "/games/chess/classic/multiplayer", code: "ABC123" }]);
    globalThis.window = { location: { pathname: "/friends", search: "" } };
    room.leaveCurrentRoom("XYZ789");
    assert.equal(left.length, 1);

    // A page that publishes its room (Pluto Party) leaves over its own connection instead.
    let sent = 0;
    globalThis.window = { location: { pathname: "/games/pluto-party", search: "" } };
    room.usePublishRoom({ lobbyRoute: "/games/pluto-party", code: "PLUTO-123456" }, () => { sent += 1; });
    const cleanups = effects.splice(0).map(effect => effect());
    assert.deepEqual(room.useCurrentRoom(), { lobbyRoute: "/games/pluto-party", code: "PLUTO-123456" });
    room.leaveCurrentRoom("PLUTO-123456");
    assert.equal(sent, 0);
    room.leaveCurrentRoom("ABC123");
    assert.equal(sent, 1);
    assert.equal(left.length, 1);
    // Natura and Medieval Kingdoms publish without a handler: they leave when the page closes.
    for (const cleanup of cleanups) cleanup?.();
    room.usePublishRoom({ lobbyRoute: "/games/natura", code: "NAT234" });
    effects.splice(0).forEach(effect => effect());
    room.leaveCurrentRoom("ABC123");
    assert.equal(sent, 1);
    assert.equal(left.length, 1);
  } finally { globalThis.window = priorWindow; }
});

test("only notifications that join a room name one", () => {
  const actions = load("../src/components/social/notificationActions.ts", { "@/lib/supabase": { supabase: {} }, "./inviteRoute": routes });
  const invite = { kind: "message", gameCode: "ABC123", game: "chess", gameRoute: "/games/go/multiplayer" };
  assert.equal(actions.notificationRoomCode(invite), "ABC123");
  assert.equal(actions.notificationDestination(invite), "/games/go/multiplayer?code=ABC123&join=1");
  assert.equal(actions.notificationRoomCode({ kind: "message", senderId: "a b" }), undefined);
  assert.equal(actions.notificationDestination({ kind: "message", senderId: "a b" }), "/friends?friend=a%20b");
  assert.equal(actions.notificationRoomCode({ ...invite, kind: "clan_invite" }), "ABC123");
  // Go clan invites are joined from the clan page, so opening one does not leave the open room.
  assert.equal(actions.notificationRoomCode({ ...invite, kind: "clan_invite", game: "go", clanId: "c1" }), undefined);
  assert.equal(actions.notificationDestination({ ...invite, kind: "clan_invite", game: "go", clanId: "c1" }), "/clans?clan=c1");
  for (const kind of ["clan_message", "spectate_request", "spectate_accepted", "friend_request"]) assert.equal(actions.notificationRoomCode({ ...invite, kind }), undefined, kind);
  assert.equal(actions.notificationDestination({ kind: "spectate_accepted", spectateRequestId: "s1" }), "/spectate/s1");
  assert.equal(actions.notificationDestination({ kind: "spectate_request", senderId: "u1" }), "/friends?friend=u1");
});

test("in a room the friends drawer scrolls and offers the room invite instead of Create & invite", () => {
  let currentRoom = null;
  const Sidebar = load("../src/components/App/GlobalFriendsSidebar.tsx", {
    // The drawer is open: `open` is the only state that starts as `false`.
    react: { ...React, useState: initial => [initial === false ? true : typeof initial === "function" ? initial() : initial, () => {}] },
    "lucide-react": { Users: () => null },
    "@/components/social/GameInvitePanel": () => "[create-and-invite]",
    "@/components/social/RoomInviteList": ({ room }) => `[invite-to-${room.code}]`,
    "@/components/social/currentRoom": { useCurrentRoom: () => currentRoom },
    "@/context/AuthContext": { useAuth: () => ({ user: { id: "me" } }) },
    "@/hooks/useDashboardData": { useDashboardData: () => ({ friends: [], onlineIds: [], presence: {}, loading: false, friendsError: false, notifications: [] }) },
    "@/i18n/ui": { ui: text => text, useUiLanguage() {} },
    "./dashboard/DashboardDialog": ({ children, scrollable }) => React.createElement("aside", { "data-scrollable": String(!!scrollable) }, children),
    "./dashboard/DashboardFriendDialog": () => null,
    "./dashboard/PlayWithFriends": () => "[friends]",
    "./dashboard/messageReadState": { getFriendMessageBaseline: () => 0 },
    "./notifications/notificationState": { markNotificationsSeen() {}, useSeenNotificationIds: () => new Set() },
  }).default;
  const outside = renderToStaticMarkup(React.createElement(Sidebar));
  assert.match(outside, /data-scrollable="false"/);
  assert.match(outside, /\[create-and-invite\]/);
  currentRoom = { lobbyRoute: "/games/pluto-party", code: "PLUTO-123456" };
  const inside = renderToStaticMarkup(React.createElement(Sidebar));
  assert.match(inside, /data-scrollable="true"/);
  assert.match(inside, /\[invite-to-PLUTO-123456\]/);
  assert.match(inside, /\[friends\]/);
  assert.doesNotMatch(inside, /create-and-invite/);
});
