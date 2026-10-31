const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const importWorker = import(pathToFileURL(path.resolve(__dirname,'../worker/index.mjs')).href);
function req(route,method='GET') {return new Request('https://jetrhythm.mightora.io'+route,{method});}
test('flight lookup rejects malformed input without calling a provider',async()=>{
  const {default:worker}=await importWorker;
  for(const route of ['/api/flights?flight=../bad&date=2026-11-02','/api/flights?flight=BA117&date=2026-02-30','/api/flights?flight=BA117&date=2026-11-02&secret=1']) {
    const result=await worker.fetch(req(route),{},{});assert.equal(result.status,400);
  }
  assert.equal((await worker.fetch(req('/api/flights?flight=BA117&date=2026-11-02'),{},{})).status,503);
  assert.equal((await worker.fetch(req('/api/flights?flight=BA117&date=2026-11-02','POST'),{},{})).status,405);
  assert.equal((await worker.fetch(req('/api/unknown'),{},{})).status,404);
});
test('health checks reflect whether aviation credentials are configured',async()=>{
  const {default:worker}=await importWorker;
  assert.deepEqual(await (await worker.fetch(req('/api/status'),{},{})).json(),{available:false,provider:'AeroDataBox'});
  assert.equal((await (await worker.fetch(req('/api/status'),{AERODATABOX_RAPIDAPI_KEY:'placeholder'},{})).json()).available,true);
});
test('provider response only uses local scheduled times and IATA airports',async()=>{
  const {normalize,localTime}=await importWorker;
  assert.equal(localTime('2026-11-02T15:45:00+01:00'),'2026-11-02T15:45');
  assert.deepEqual(normalize({number:'BA117',departure:{airport:{iata:'LHR'},scheduledTime:{local:'2026-11-02 10:30+00:00'}},arrival:{airport:{iata:'JFK'},scheduledTime:{local:'2026-11-02 13:20-05:00'}}},'BA117','2026-11-02'),{number:'BA117',from:'LHR',to:'JFK',departure:'2026-11-02T10:30',arrival:'2026-11-02T13:20'});
  assert.equal(normalize({departure:{},arrival:{}},'BA117','2026-11-02'),null);
});
test('static assets binding is used for non-API requests',async()=>{
  const {default:worker}=await importWorker;
  const result=await worker.fetch(req('/'),{ASSETS:{fetch:()=>new Response('home')}});
  assert.equal(await result.text(),'home');
});
