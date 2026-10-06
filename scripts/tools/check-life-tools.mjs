// Run against a local dev/preview server. Uses an isolated temporary Chrome profile.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const output = process.argv[3] ?? path.join(tmpdir(), 'pluto-life-tools-review');
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'pluto-life-tools-'));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let i = 0; i < 80 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* Chrome is starting */ } }
  assert.ok(target, 'Chrome started');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  let id = 0; const pending = new Map(), errors = [];
  socket.on('message', raw => { const message = JSON.parse(raw); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text); if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (p) message.error ? p.reject(Error(message.error.message)) : p.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
  const waitFor = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); } throw Error(`Timed out: ${expression}`); };
  const navigate = async tool => { const previous = await evaluate('performance.timeOrigin'); await send('Page.navigate', { url: `${base}/tools/${tool}` }); await waitFor(`performance.timeOrigin !== ${previous} && document.querySelector(".pt-workbench")`); await sleep(200); };
  const reload = async () => { const previous = await evaluate('performance.timeOrigin'); await send('Page.reload'); await waitFor(`performance.timeOrigin !== ${previous} && document.querySelector(".pt-workbench")`); await sleep(200); };
  const helpers = `
    window.field = (text) => { const label = [...document.querySelectorAll('.pt-workbench label')].find(l => l.firstChild?.textContent.trim() === text); if (!label) throw Error('Missing field: '+text); return label.querySelector('input,select'); };
    window.fill = (text,value) => { const el=field(text); Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); };
    window.clickText = (text) => { const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text); if(!el || el.disabled) throw Error('Missing/enabled button: '+text); el.click(); };
  `;
  const init = async tool => { await navigate(tool); await evaluate(helpers); };
  const fill = async (text, value) => { await evaluate(`fill(${JSON.stringify(text)},${JSON.stringify(value)})`); await sleep(50); };
  const click = async text => { await evaluate(`clickText(${JSON.stringify(text)})`); await sleep(100); };
  const text = async () => evaluate('document.body.innerText');
  await send('Runtime.enable'); await send('Page.enable');
  // Deterministic transport fixtures keep API outages out of the UI regression check.
  // Production still calls Open-Meteo; no fixture is bundled with the app.
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input,options) => {
      const url = String(input);
      if(url.startsWith('https://api.open-meteo.com/')) {
        if(localStorage.getItem('weather-test-fail')==='true') return new Response('{}',{status:503});
        const lat = Number(new URL(url).searchParams.get('latitude'));
        const start = Math.floor(Date.now()/3600000)*3600;
        return new Response(JSON.stringify({timezone:lat<0?'Australia/Sydney':'Europe/Berlin',hourly_units:{time:'unixtime',temperature_2m:'°C',precipitation_probability:'%',precipitation:'mm',wind_speed_10m:'km/h'},hourly:{time:Array.from({length:72},(_,i)=>start+i*3600),temperature_2m:Array.from({length:72},(_,i)=>Math.round((15+lat/10+Math.sin(i/4)*3)*10)/10),precipitation_probability:Array(72).fill(20),precipitation:Array(72).fill(0.2),wind_speed_10m:Array(72).fill(10),weather_code:Array(72).fill(2)}}));
      }
      if(url.startsWith('https://geocoding-api.open-meteo.com/')) return new Response(JSON.stringify({results:[{id:2950159,name:'Berlin',country:'Germany',latitude:52.52,longitude:13.41}]}));
      return realFetch(input,options);
    };
  `});
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await init('day-planner'); await fill('Task', 'Browser appointment'); await fill('Start time', '09:00'); await click('Add task');
  await fill('Task', 'Conflicting task'); await fill('Start time', '09:15'); await click('Add task'); assert.match(await text(), /Scheduling conflict/);
  await reload(); await waitFor('document.body.innerText.includes("Browser appointment")');
  await evaluate(helpers); await fill('Date', '2026-03-29'); await fill('Start time', '02:30'); assert.match(await text(), /This local time does not exist/);
  await fill('Date', '2026-10-25'); await waitFor('document.body.innerText.includes("Repeated local time")');
  await init('time-zone-planner'); await fill('Date', '2026-10-06'); await fill('Start time', '14:00'); assert.match(await text(), /08:00/); assert.match(await text(), /Overlapping availability/);
  await init('workout-timer'); await fill('Routine name', 'Quick workout'); await fill('Work seconds', '1'); await fill('Rest seconds', '1'); await fill('Rounds', '2'); await click('Save routine'); await click('Start'); await sleep(3500); assert.match(await text(), /Finished/); await click('Reset'); await click('Start'); await click('Pause'); assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Resume")'), true);
  await init('bill-splitter'); await fill('Group name', 'Browser group'); await fill('Participants separated by commas', 'Alice, Bob, Cara'); await click('Create group');
  await fill('Expense name', 'Dinner'); await fill('Bill amount', '10'); await fill('Tip amount', '0'); assert.match(await text(), /€3.34/); await click('Save expense'); assert.match(await text(), /€6.66/);
  await click('Use suggestion'); await click('Record repayment'); assert.match(await text(), /Repayment recorded/);
  await reload(); await waitFor('document.body.innerText.includes("Dinner")');
  await init('budget-tracker'); await fill('Month', '2026-10'); await fill('Entry name', 'Income'); await fill('Category', 'Pay'); await fill('Date', '2026-10-01'); await fill('Amount', '2000'); await fill('Type', 'income'); await click('Add entry');
  await fill('Entry name', 'Rent'); await fill('Category', 'Housing'); await fill('Amount', '800'); await fill('Type', 'expense'); await click('Add entry'); await fill('Monthly spending limit', '700'); await click('Save spending limit'); assert.match(await text(), /Over budget/); assert.match(await text(), /€1,200.00/);
  await fill('Currency', 'USD'); assert.match(await text(), /No entries for this month and currency/);
  await init('subscription-tracker'); await fill('Subscription name', 'Annual membership'); await fill('Price per billing cycle', '120'); await fill('First renewal date', '2026-01-31'); await fill('Billing cycle', 'yearly'); await click('Add subscription'); assert.match(await text(), /€10.00/); await click('Deactivate'); assert.match(await text(), /Inactive/);
  // Use a past reminder in this isolated profile, then visit a different route.
  await evaluate(`(() => { const key='pluto-life-tools-v1:guest'; const data=JSON.parse(localStorage.getItem(key)); const at=Date.now()-60000; const p=new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at); const parts=Object.fromEntries(p.map(v=>[v.type,v.value])); const date=parts.year+'-'+parts.month+'-'+parts.day,time=parts.hour+':'+parts.minute; data.tasks.push({id:'overdue',title:'Missed reminder',date,time,zone:'UTC',at:Date.parse(date+'T'+time+':00Z'),duration:10,done:false,reminder:true,reminded:false}); data.breaks={enabled:true,interval:1,nextAt:at}; localStorage.setItem(key,JSON.stringify(data)); })()`);
  await init('percentage-calculator'); await waitFor('document.querySelector(".life-reminders")'); assert.match(await text(), /Missed reminder/); await click('Dismiss'); await click('Turn off');
  await reload(); await waitFor('document.querySelector(".pt-workbench")'); assert.equal(await evaluate('!!document.querySelector(".life-reminders")'), false);
  await init('calorie-tracker'); await fill('Date','2026-10-06'); await fill('Food name','Label example'); await fill('Portion quantity','150'); await fill('kcal per 100 g','80'); await click('Add food');
  assert.match(await text(),/120 kcal/); await fill('Meal template name','Test bowl'); await click('Save selected meal'); await fill('Portion multiplier','2'); await click('Log meal'); assert.match(await text(),/360 kcal/);
  await click('Edit'); await fill('Portion quantity','50'); await click('Save changes'); assert.match(await text(),/280 kcal/);
  await reload(); await waitFor('document.body.innerText.includes("Test bowl")'); await evaluate(helpers); await fill('Date','2026-10-06'); assert.match(await text(),/280 kcal/);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("pluto-life-tools-v1:guest")).savedMeals[0].foods[0].quantity'),150,'template keeps its original portion');
  await init('weather-explorer'); await waitFor('document.querySelector(".weather-card tbody tr")'); assert.equal(await evaluate('document.querySelectorAll(".weather-card tbody tr").length'),24);
  await fill('Latitude','-33.87'); await fill('Longitude','151.21'); await click('Explore coordinates'); await waitFor('document.body.innerText.includes("Australia/Sydney")'); await click('Save place');
  await fill('Search location','Berlin'); await click('Search'); await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="Berlin, Germany")'); await click('Berlin, Germany'); await waitFor('document.body.innerText.includes("Europe/Berlin")'); await click('Save place');
  const sid=await evaluate('JSON.parse(localStorage.getItem("pluto-life-tools-v1:guest")).weatherPlaces.find(p=>p.latitude<0).id'); await fill('Compare with',sid); await waitFor('document.querySelectorAll(".weather-card tbody tr").length===48');
  assert.equal(await evaluate('document.querySelectorAll(".weather-card tbody tr")[0].cells[0].textContent===document.querySelectorAll(".weather-card tbody tr")[24].cells[0].textContent'),false,'comparison displays distinct local times');
  await evaluate('localStorage.setItem("weather-test-fail","true")'); await click('Refresh'); await waitFor('document.body.innerText.includes("Forecast unavailable")'); await evaluate('localStorage.removeItem("weather-test-fail")'); await click('Refresh'); await waitFor('document.querySelectorAll(".weather-card tbody tr").length===48');
  await evaluate('document.querySelector(".weather-map").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))'); assert.equal(await evaluate('Number(field("Longitude").value)'),14.41);
  await reload(); await waitFor('document.body.innerText.includes("151.210")');
  await init('day-planner'); assert.match(await text(),/Background reminders/); assert.match(await text(),/Sign in to enable background reminders/);
  const apps = ['day-planner', 'time-zone-planner', 'workout-timer', 'bill-splitter', 'budget-tracker', 'subscription-tracker', 'calorie-tracker', 'weather-explorer'];
  for (const language of ['en', 'de']) {
    await evaluate(`localStorage.setItem('pluto-language',${JSON.stringify(language)})`);
    for (const width of [1440, 360]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 360 });
      for (const app of apps) {
        await navigate(app);
        const overflow = await evaluate(`(() => {const el=document.querySelector('.pt-workbench'); return el.scrollWidth > el.clientWidth+2 || document.documentElement.scrollWidth > innerWidth+2;})()`);
        assert.equal(overflow, false, `${app} ${language} ${width}: horizontal overflow`);
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(path.join(output, `${app}-${language}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  }
  assert.deepEqual(errors, [], 'No browser runtime exceptions');
  console.log(`PASS: all eight life apps; calorie portions/templates/edit/reload; weather fixtures/search/coordinates/compare/errors/keyboard/favorites/reload; background-reminder sign-in state; planner conflict/DST/reload; timezone comparison; workout completion/pause; bill balances/repayment/reload; budget totals/currency; subscriptions; global reminder dismissal/reload; English/German at 1440px and 360px. Screenshots: ${output}`);
} finally {
  socket?.close(); chrome.kill(); await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch { /* Temporary Chrome files may still be closing. */ }
}
