import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { qrPayload, generateQr } from '../src/data/qrTools.ts';
import { birthdayDate, nextBirthday, dueBirthdays, validBirthdayPerson, birthdayReminderChanges } from '../src/data/birthdayTools.ts';
import { createLifeToolsStore, parseLifeTools } from '../src/data/lifeToolsStorage.ts';
import { validReminder } from '../supabase/functions/tool-push/model.ts';

const person = { id:'person', name:'Alex', month:2, day:29, birthYear:2000, zone:'Europe/Berlin', reminder:true };
const at = value => Date.parse(value);
test('QR images decode to the exact URL or Unicode text, with a quiet zone and downloadable SVG', async () => {
  for (const [input, mode] of [['  https://example.com/?q=hello%20world  ', 'link'], ['Happy birthday 🎉\n한국어, Grüß dich & <svg>!', 'text']]) {
    const payload=qrPayload(input,mode), output=await generateQr(payload);
    const image=PNG.sync.read(Buffer.from(output.png.split(',')[1], 'base64'));
    assert.equal(jsQR(new Uint8ClampedArray(image.data),image.width,image.height)?.data,payload);
    assert.match(output.svg, /^<svg/); assert.match(output.svg, /viewBox=/); assert.equal(output.svg.includes('<svg>!'),false);
    assert.equal(image.width,1024); assert.equal(image.data[0],255);
  }
  for (const input of ['', 'javascript:alert(1)', 'example.com', 'file:///etc/passwd']) assert.throws(()=>qrPayload(input,'link'));
  assert.throws(()=>qrPayload('🎉'.repeat(501),'text')); assert.equal(qrPayload('  hello  ','text'),'  hello  ');
});
test('annual dates handle leap days, today, year rollover, daylight saving and optional ages',()=>{
  assert.equal(birthdayDate(person,2027),'2027-02-28');assert.equal(birthdayDate(person,2028),'2028-02-29');
  assert.deepEqual(nextBirthday(person,at('2027-02-28T10:00Z')), {date:'2027-02-28',at:at('2027-02-28T08:00Z'),year:2027,age:27});
  assert.equal(nextBirthday(person,at('2027-03-01T00:00Z')).date,'2028-02-29');
  assert.equal(nextBirthday({...person,month:7,day:1},at('2027-01-01T00:00Z')).at,at('2027-07-01T07:00Z'));
  assert.equal(nextBirthday({...person,birthYear:undefined},at('2027-01-01T00:00Z')).age,null);
  assert.equal(nextBirthday({...person,month:1,day:1},at('2026-12-31T23:30Z')).year,2027);
  assert.equal(validBirthdayPerson(person),true);
  for (const bad of [{day:30},{month:13},{birthYear:2001},{zone:'invalid'},{name:''},{id:'../oops'},{reminder:'yes'}]) assert.equal(validBirthdayPerson({...person,...bad}),false);
});
test('birthday reminders appear only on the local birthday after 09:00, dismissal resets each year',()=>{
  assert.deepEqual(dueBirthdays([person],at('2027-02-28T07:59Z')),[]);
  assert.deepEqual(dueBirthdays([person],at('2027-02-28T08:00Z')),[person]);
  assert.deepEqual(dueBirthdays([{...person,dismissedYear:2027}],at('2027-02-28T12:00Z')),[]);
  assert.equal(dueBirthdays([{...person,dismissedYear:2027}],at('2028-02-29T08:00Z')).length,1);
  assert.deepEqual(dueBirthdays([person],at('2027-02-28T23:00Z')),[]);
  assert.deepEqual(dueBirthdays([{...person,reminder:false}],at('2027-02-28T12:00Z')),[]);
});
test('birthdays stay account-local; annual reminders, edits and deletion tombstones survive offline reload',()=>{
  const rows=new Map(),port={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)},store=createLifeToolsStore(port);
  assert.ok(store.save('alice','birthdays',person));assert.equal(store.read('bob').birthdays.length,0);
  store.update('alice',s=>({...s,background:{enabled:true,pending:[]}}));
  const change=store.read('alice').background.pending[0]; assert.equal(change.id,'birthday-person');assert.equal(change.enabled,true);assert.deepEqual(change.annual,{month:2,day:29,zone:'Europe/Berlin'}); assert.equal(validReminder(change),true);assert.equal('birthYear' in change,false);
  store.save('alice','birthdays',{...person,name:'New name'});assert.equal(store.read('alice').background.pending[0].title,'New name');
  store.remove('alice','birthdays',person.id);const restored=createLifeToolsStore(port).read('alice');assert.equal(restored.birthdays.length,0);assert.equal(restored.background.pending[0].enabled,false);
  assert.equal(parseLifeTools(JSON.stringify({version:1,birthdays:[person,{...person,id:'bad',day:31}]})).birthdays.length,1);
  assert.deepEqual(birthdayReminderChanges([person],[{...person,dismissedYear:2026}]),[]);
  assert.equal(validReminder({...change,annual:{month:2,day:30,zone:'UTC'}}),false);
  assert.equal(validReminder({...change,annual:{month:2,day:29,zone:'bad'}}),false);
  assert.equal(validReminder({...change,id:'not-a-birthday'}),false);
});
