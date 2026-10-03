import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { areaReferenceCountry, areaValuesFromText } from '../src/games/atlas/areaReferences.ts';
import { getRankFromRating } from '../src/games/atlas/ranked.ts';
const require=createRequire(import.meta.url);
function component(path, modules={}) {
  const compiled=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023,esModuleInterop:true}}).outputText;
  const exports={};new Function('require','exports',compiled)(name=>modules[name]??require(name),exports);return exports;
}
const routes=component('../src/components/social/inviteRoute.ts',{'@/data/chessVariants':{variants:[]}});
test('invite destinations autojoin the correct game and Watten seat count',()=>{
  for(const [route,url] of [['/games/pluto-party','/games/pluto-party?code=ABC123&join=1'],['/games/go/multiplayer','/games/go/multiplayer?code=ABC123&join=1'],['/games/shogi/multiplayer','/games/shogi/multiplayer?code=ABC123&join=1'],['/games/schafkopf/multiplayer','/games/schafkopf/multiplayer?code=ABC123&join=1'],['/games/watten/multiplayer/3','/games/watten/multiplayer?variant=three-player&code=ABC123&join=1'],['/games/watten/multiplayer/4','/games/watten/multiplayer?variant=four-player&code=ABC123&join=1'],['/games/atlas-arena/multiplayer','/games/atlas-arena/multiplayer/ABC123?join=1'],['/games/eat-it/multiplayer','/games/eat-it/multiplayer/ABC123?join=1'],['/games/card-builder/room','/games/card-builder/room/ABC123?join=1'],['/chess-custom/play/multiplayer','/chess-custom/play/multiplayer?room=ABC123&join=1'],['/games/chess/variants/4-players/multiplayer','/games/chess/variants/4-players/multiplayer?code=ABC123&join=1']]) assert.equal(routes.getInviteDestination({gameRoute:route,gameCode:'ABC123'},{autoJoin:true}),url);
});
test('area references read visible range endpoints, keep population separate and support compact values',()=>{
  assert.deepEqual(areaValuesFromText('It covers between 500,000 and 1,000,000 km² and shares land borders.'),[500000,1000000]);
  assert.deepEqual(areaValuesFromText('About 8.1M people live here, on 83,879 km².'),[83879]);
  assert.deepEqual(areaValuesFromText('It covers under 1,000 km².'),[1000]);
  assert.deepEqual(areaValuesFromText('It covers over 3,000,000 km².'),[3000000]);
  assert.deepEqual(areaValuesFromText('1.2M km²'),[1200000]);
  assert.deepEqual(areaValuesFromText('About 5M people live here.'),[]);
});
test('Atlas badge uses rating tier and includes a numerical position only in the actual top ten',()=>{
  const emblem=component('../src/components/chess/RankEmblem.tsx').default;
  const Badge=component('../src/components/atlas/AtlasRankBadge.tsx',{'@/components/chess/RankEmblem':{__esModule:true,default:emblem},'@/games/atlas/ranked':{getRankFromRating}}).default;
  for (const position of [undefined,null,0,-1,11,100,1.5]) assert.doesNotMatch(renderToStaticMarkup(React.createElement(Badge,{rating:1400,position})),/#\d/);
  for(const position of [1,10]) { const html=renderToStaticMarkup(React.createElement(Badge,{rating:1400,position}));assert.match(html,new RegExp(`#${position}`));assert.match(html,/Gold rank emblem/); }
  assert.match(renderToStaticMarkup(React.createElement(Badge,{rating:1000})),/Silver III/);
});

test('current room invites preserve the path and game mode and reject unrelated URLs',()=>{
  assert.deepEqual(routes.currentRoomInvite('/games/watten/multiplayer/4/ABC123/game'),{lobbyRoute:'/games/watten/multiplayer/4',code:'ABC123'});
  assert.deepEqual(routes.currentRoomInvite('/games/go/multiplayer/ABC123'),{lobbyRoute:'/games/go/multiplayer',code:'ABC123'});
  assert.deepEqual(routes.currentRoomInvite('/chess-custom/play/multiplayer','?room=ABC123'),{lobbyRoute:'/chess-custom/play/multiplayer',code:'ABC123'});
  assert.equal(routes.currentRoomInvite('/profile/ABC123'),null);
});
test('area illustrations exclude the mystery country and choice candidates',()=>{
  const country=(id,area)=>({id,shortName:id,status:'un195',geometryId:id,areaKm2:{value:area}});
  const Reference=component('../src/components/atlas/AtlasAreaReference.tsx',{
    '@/games/atlas/areaReferences':{areaReferenceCountry},
    '@/games/atlas/useAtlasData':{useAtlasData:()=>({data:{countries:[country('Mystery',100000),country('Other option',100100),country('Reference country',105000)],topology:{}}})},
    './AtlasCountryShape':{AtlasCountryShape:props=>React.createElement('svg',{'aria-label':props.label})},
  }).default;
  const html=renderToStaticMarkup(React.createElement(Reference,{values:[100000],excludeIds:['Mystery','Other option']}));
  assert.doesNotMatch(html,/Mystery|Other option/);assert.match(html,/Reference country/);
});
