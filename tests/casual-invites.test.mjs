import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { INVITE_GAMES } from "../src/components/social/gameCreationCatalog.ts";
import { variants } from "../src/data/chessVariants.ts";
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function("require", "exports", source)(name => mocks[name] ?? require(name), exports);
  return exports;
}
const uiMocks = { ui: text => text, useUiLanguage() {} };
const clan = load("../src/components/social/clanShare.ts", { "@/lib/supabase": { supabase: {} } });

test("every casual creation mode has a matching clan invite route, including custom chess queries", () => {
  for (const game of INVITE_GAMES) for (const mode of game.modes) {
    assert.ok(clan.clanStoredGame(mode.inviteRoute ?? mode.route.split("?")[0]), mode.route);
    assert.doesNotMatch(mode.route, /ranked/);
  }
  assert.equal(clan.clanStoredGame("/games/card-builder/room"), "card-builder");
  assert.equal(clan.clanStoredGame("/games/chess/ranked"), null);
  const registered = [...readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8").matchAll(/path: "(\/games\/chess\/variants\/[^"]+\/multiplayer)"/g)].map(match => match[1]);
  const routes = INVITE_GAMES.flatMap(game => game.modes.map(mode => mode.route.split("?")[0]));
  for (const route of registered) assert.ok(routes.includes(route), route);
  const chess = INVITE_GAMES.find(game => game.id === "chess").modes;
  for (const variant of variants.filter(item => item.multiplayerRoute && item.id !== "king-of-the-hill")) assert.ok(chess.some(mode => mode.route === variant.multiplayerRoute));
});

test("friend and clan pickers render the same games and modes, including published card games", () => {
  const games = INVITE_GAMES.filter(game => game.modes.length || game.id === "card-builder").map(game => game.id === "card-builder" ? { ...game, modes: [{ id: "v1", label: "Published Durak", route: "/games/card-builder/play?game=g1&version=v1&mode=online", inviteRoute: "/games/card-builder/room" }] } : game);
  let selectedGame = "chess";
  const sharedMocks = {
    react: { ...React, useState(initial) { const value = initial === "chess" ? selectedGame : initial; return [value, () => {}]; } },
    "react-router-dom": { Link: ({ children }) => children, useNavigate: () => () => {}, useLocation: () => ({ pathname: "/invite", search: "" }) },
    "@/context/AuthContext": { useAuth: () => ({ user: { id: "me" } }) },
    "@/hooks/useDashboardData": { useDashboardData: () => ({ friends: [], onlineIds: [], clans: [{ id: "clan", name: "Clan" }], loading: false, friendsError: false }) },
    "@/lib/supabase": { supabase: {} },
    "@/i18n/ui": uiMocks,
    "@/games/atlas/modeCatalog": { modeForOnline: () => null },
    "@/games/party/network/protocol": { normalizeLobbyCode: () => null },
    "./inviteRoute": { acceptInviteState: () => ({}), getInviteDestination: () => "", getInviteGameLabel: () => "", inviteGameKey: () => "chess" },
    "./currentRoom": { useCurrentRoom: () => null },
    "./gameCreationCatalog": { createInviteRoute: () => "" },
    "./GameInviteDelivery": { prepareCreatedGameInvite() {} },
    "./clanShare": clan,
    "./useInviteGames": { useInviteGames: () => ({ games, cardsError: "", clearCardsError() {} }) },
  };
  const Friend = load("../src/components/social/GameInvitePanel.tsx", sharedMocks).default;
  const Clan = load("../src/components/social/ClanInvitePanel.tsx", sharedMocks).default;
  const selects = markup => [...markup.matchAll(/<select[^>]*aria-label="(Game|Mode)"[^>]*>(.*?)<\/select>/g)].map(match => match[2]);
  for (const game of games) {
    selectedGame = game.id;
    assert.deepEqual(selects(renderToStaticMarkup(React.createElement(Friend))), selects(renderToStaticMarkup(React.createElement(Clan))), game.id);
  }
});

test("each open Party seat opens its own room invite without relying on the URL", () => {
  const events = [], priorWindow = globalThis.window;
  globalThis.window = { dispatchEvent: event => events.push(event) };
  try {
    const Button = load("../src/components/chess/InviteFriendButton.tsx", { "@/i18n/ui": uiMocks, "@/components/social/roomInvite.css": {} }).default;
    const room = { lobbyRoute: "/games/pluto-party", code: "PLUTO-123456" };
    Button({ room }).props.onClick();
    assert.equal(events[0].type, "open-room-friends");
    assert.deepEqual(events[0].detail, room);
    const map = { name: "Islands", goldenPlutoCount: 2, description: "", nodes: [], propertyName: "Hotel" };
    const Lobby = load("../src/pages/games/Party/PartyLobby.tsx", {
      "@/components/chess/InviteFriendButton": Button,
      "../../../games/party/content/maps.ts": { mapRegistry: { get: () => map, all: () => [] } },
      "./PartyPortrait.tsx": () => null, "./PlayerStatus.tsx": () => null,
    }).default;
    const lobby = { code: room.code, name: "Party", hostId: "me", settings: { mapId: "sunspill", victory: "plutos", difficulty: "easy", plutoTarget: 3, fillBots: true }, players: [{ id: "me", name: "Me", connected: true }], match: null };
    const markup = renderToStaticMarkup(React.createElement(Lobby, { lobby, connection: { status: "online", playerId: "me", send() {}, serverOffset: 0 } }));
    assert.equal((markup.match(/Invite friend<\/span><\/button>/g) ?? []).length, 3);
  } finally { globalThis.window = priorWindow; }
});
