import test from 'node:test';
import assert from 'node:assert/strict';
import { portionNumber, foodCalories, totalCalories, calorieHistory, validFoodEntry, validSavedMeal } from '../src/data/calorieTools.ts';
import { reminderChanges } from '../src/data/toolNotifications.ts';
import { createLifeToolsStore, parseLifeTools, emptyLifeTools } from '../src/data/lifeToolsStorage.ts';
import { validSubscription, validReminder, validPushEndpoint } from '../supabase/functions/tool-push/model.ts';
const food = { id:'food',name:'Label example',date:'2026-10-06',meal:'Breakfast',quantity:150,energy:80,unit:'g' };
const task = {id:'appointment',title:'Reminder',date:'2026-10-06',time:'09:00',zone:'Europe/Berlin',at:Date.parse('2026-10-06T07:00Z'),duration:30,done:false,reminder:true,reminded:false};
const memory = () => { const rows=new Map(); return {getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)}; };

test('manual energy uses label basis, serving fractions, tenths rounding and zero-energy food',()=>{
 assert.equal(foodCalories(food),120);assert.equal(foodCalories({...food,unit:'serving',quantity:1.5}),120);assert.equal(totalCalories([food,{...food,quantity:50}]),160);
 assert.equal(foodCalories({...food,energy:0}),0);assert.equal(foodCalories({...food,quantity:33.33,energy:123}),41);
 assert.equal(portionNumber('1,25'),1.25);for(const value of ['-1','NaN','1e3','1/2','1.234','1000000',''])assert.equal(portionNumber(value),null);
 for(const invalid of [{quantity:0},{quantity:Infinity},{energy:-1},{energy:10001},{unit:'kg'},{date:'2026-02-30'},{meal:'unknown'}])assert.equal(validFoodEntry({...food,...invalid}),false);
 assert.equal(validFoodEntry(food),true);assert.equal(validSavedMeal({id:'meal',name:'Template',foods:[food]}),true);assert.equal(validSavedMeal({id:'meal',name:'Template',foods:[]}),false);
});
test('food history, meal snapshots, place favorites, old records and accounts survive reload independently',()=>{
 const storage=memory(),store=createLifeToolsStore(storage);assert.ok(store.save('alice','foodEntries',food));assert.ok(store.save('alice','savedMeals',{id:'meal',name:'Example',foods:[food]}));assert.ok(store.save('alice','weatherPlaces',{id:'berlin',name:'Berlin',latitude:52.52,longitude:13.41}));
 store.save('alice','foodEntries',{...food,quantity:50});const reloaded=createLifeToolsStore(storage).read('alice');assert.equal(foodCalories(reloaded.savedMeals[0].foods[0]),120);assert.deepEqual(calorieHistory(reloaded.foodEntries),[{date:'2026-10-06',calories:40,count:1}]);assert.equal(reloaded.weatherPlaces.length,1);assert.equal(store.read('bob').foodEntries.length,0);
 const parsed=parseLifeTools(JSON.stringify({version:1,tasks:[task],foodEntries:[food,{...food,id:'bad',energy:NaN}],weatherPlaces:[{id:'bad',name:'Bad',latitude:91,longitude:0}]}));assert.equal(parsed.tasks.length,1);assert.equal(parsed.foodEntries.length,1);assert.equal(parsed.weatherPlaces.length,0);assert.equal(parsed.background.enabled,false);
});
test('only changed tasks publish; completion, dismissal and deletion cancel, and offline tombstones survive reload',()=>{
 assert.deepEqual(reminderChanges([task],[{...task,duration:90}]),[]);assert.equal(reminderChanges([task],[{...task,done:true}])[0].enabled,false);assert.equal(reminderChanges([task],[{...task,reminded:true}])[0].enabled,false);assert.equal(reminderChanges([task],[])[0].enabled,false);
 const storage=memory(),store=createLifeToolsStore(storage);store.save('alice','tasks',task);assert.equal(store.read('alice').background.pending.length,0);
 store.update('alice',s=>({...s,background:{enabled:true,pending:[]}}));assert.equal(store.read('alice').background.pending[0].enabled,true);
 store.remove('alice','tasks',task.id);const restored=createLifeToolsStore(storage).read('alice');assert.equal(restored.background.pending.length,1);assert.equal(restored.background.pending[0].enabled,false);
 store.update('alice',s=>({...s,background:{...s.background,enabled:false}}));store.save('alice','tasks',task);assert.equal(store.read('alice').background.pending[0].enabled,false);
 store.update('alice',s=>({...s,background:{...s.background,enabled:true}}));assert.equal(store.read('alice').background.pending[0].enabled,true);assert.equal(store.read('bob').background.enabled,false);
});
test('push subscription and reminder contracts reject private endpoints, forged hosts and invalid records',()=>{
 const endpoint='https://fcm.googleapis.com/fcm/send/device',sub={endpoint,keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};assert.equal(validSubscription(sub),true);
 for(const endpoint of ['https://127.0.0.1/private','http://fcm.googleapis.com/x','https://fcm.googleapis.com.attacker.test/x','https://fcm.googleapis.com:444/x','https://user:password@fcm.googleapis.com/x','file:///etc/passwd','https://169.254.169.254/metadata'])assert.equal(validPushEndpoint(endpoint),false,endpoint);
 assert.equal(validSubscription({...sub,keys:{auth:'bad'}}),false);assert.equal(validReminder({id:task.id,title:task.title,at:task.at,enabled:true}),true);assert.equal(validReminder({id:'../bad',title:'x',at:task.at,enabled:true}),false);
});
