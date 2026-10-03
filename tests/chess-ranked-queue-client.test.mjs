import * as goConfig from "../src/games/go/ranked/config.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {getChessRank} from '../src/games/chess/ranked/tiers.ts';
import * as timeControls from '../src/games/chess/ranked/timeControls.ts';
const compiled=ts.transpileModule(readFileSync(new URL('../src/pages/games/Chess/ChessRankedLobby.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
// Execute the actual component lifecycle and async callbacks without a browser
// or remote account. Only React scheduling and transport are test doubles.
function mount(game="chess", stored=null){
 const effects=[],cleanups=[],requests=[],leaves=[],navigations=[],timers=new Map();let timer=0;
 const win=new EventTarget();win.setInterval=fn=>{timers.set(++timer,fn);return timer};win.clearInterval=id=>timers.delete(id);
 const react={useRef:value=>({current:value}),useState:value=>[typeof value==='function'?value():value,()=>{}],useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const query={select(){return query},eq(){return query},maybeSingle:async()=>({data:null})};
 const deps={react,'react/jsx-runtime':jsx,'react-router-dom':{Link:'a',useNavigate:()=>url=>navigations.push(url)},'lucide-react':{},
  '@/context/AuthContext':{useAuth:()=>({user:{id:'user',email:'user@example.test'},profile:null})},
  '@/i18n/ui':{ui:s=>s,useUiLanguage:()=>{}},'@/lib/supabase':{supabase:{from:()=>query,rpc:async()=>({data:[]})}},
  '@/games/chess/ranked/client':{RankedAuthError:class extends Error{},leaveRankedGameQueue:(id)=>leaves.push(id),invokeRankedGame:(body)=>new Promise(resolve=>requests.push({body,resolve}))},
  '@/games/chess/ranked/tiers':{getChessRank},
  '@/games/go/ranked/config':goConfig,
  '@/games/go/ranked/profile':{useGoRankedProfile:()=>({rows:null,error:null})},
  '@/games/chess/ranked/timeControls':timeControls,
  '@/components/chess/RankEmblem':{default:()=>null},
 };
 const exports={};new Function('require','exports','window','localStorage',compiled)(name=>deps[name]??{default:()=>null},exports,win,{getItem:()=>stored,setItem:()=>{}});
 const tree=exports.default({game});effects.forEach(fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup)});
 function all(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(all);return [node,...all(node.props?.children)]}
 const join=all(tree).find(n=>n.type==='button'&&n.props.children?.includes?.('Find match'));
 assert.ok(join);
 const tabs=all(tree).find(n=>n.type?.name==='TimeControlTabs');
 return {requests,leaves,navigations,win,tabs:()=>tabs.type(tabs.props),join:()=>join.props.onClick(),unmount:()=>cleanups.forEach(fn=>fn())};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('unmount immediately leaves and a delayed matched response cannot navigate off the new route',async()=>{
 const m=mount();await tick();m.requests.find(r=>r.body.op==='queueStatus').resolve({status:'idle'});await tick();
 m.join();const request=m.requests.find(r=>r.body.op==='queue');assert.ok(request);assert.equal(request.body.timeControl,'rapid');
 m.unmount();assert.deepEqual(m.leaves,[request.body.sessionId]);
 request.resolve({status:'matched',code:'ABC123'});await tick();assert.deepEqual(m.navigations,[]);
 assert.equal(m.leaves.at(-1),request.body.sessionId);
});
test('pagehide releases the lease; back/forward-cache restoration gets a fresh session',async()=>{
 const m=mount();await tick();m.join();const first=m.requests.find(r=>r.body.op==='queue');
 m.win.dispatchEvent(new Event('pagehide'));assert.equal(m.leaves.at(-1),first.body.sessionId);
 const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});m.win.dispatchEvent(event);
 m.join();const second=m.requests.filter(r=>r.body.op==='queue').at(-1);assert.notEqual(second.body.sessionId,first.body.sessionId);
 first.resolve({status:'matched',code:'OLD123'});await tick();assert.deepEqual(m.navigations,[]);
 second.resolve({status:'matched',code:'NEW123'});await tick();assert.deepEqual(m.navigations,['/games/chess/ranked/NEW123/game']);
 m.unmount();assert.equal(m.leaves.at(-1),second.body.sessionId);
});

test('Go shares the queue lease lifecycle and routes matches to Go without crossing Chess',async()=>{
 const m=mount('go');await tick();m.requests.find(r=>r.body.op==='queueStatus').resolve({status:'idle'});await tick();
 m.join();const request=m.requests.find(r=>r.body.op==='queue');assert.equal(request.body.timeControl,'normal');
 request.resolve({status:'matched',code:'ABC123456789'});await tick();
 assert.deepEqual(m.navigations,['/games/go/ranked/ABC123456789/game']);m.unmount();assert.equal(m.leaves.at(-1),request.body.sessionId);
});

test('Go restores both supported modes and replaces removed presets with Normal while Chess retains its defaults',async()=>{
 for(const [game,stored,expected] of [['go','normal','normal'],['go','blitz','blitz'],['go','bullet','normal'],['go','rapid','normal'],['go','classical','normal'],['chess','normal','rapid'],['chess','bullet','bullet'],['chess','classical','classical']]) {
  const m=mount(game,stored);await tick();m.requests.find(r=>r.body.op==='queueStatus').resolve({status:'idle'});await tick();
  m.join();const request=m.requests.find(r=>r.body.op==='queue');assert.equal(request.body.timeControl,expected);
  const tabs=m.tabs();const buttons=tabs.props.children;
  assert.deepEqual(buttons.map(b=>b.props.children[0]),game==='go'?['Blitz','Normal']:['Bullet','Blitz','Rapid','Classical']);
  if(game==='go')assert.deepEqual(buttons.map(b=>b.props.children[1].props.children),['1m + 3 × 10s','5m + 5 × 30s']);
  request.resolve({status:'idle'});m.unmount();
 }
});
