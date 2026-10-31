const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/airports.js'),'utf8'),sandbox);
const airports = sandbox.window.JetRhythmAirports;

test('globally bundled airport mapping requires no network request or manual time zone',() => {
  assert.ok(Object.keys(airports).length > 7900);
  assert.equal(airports.LHR[1],'Europe/London');
  assert.equal(airports.JFK[1],'America/New_York');
  assert.equal(airports.SYD[1],'Australia/Sydney');
  assert.equal(airports.LAS[1],'America/Los_Angeles');
  assert.equal(airports.DXB[1],'Asia/Dubai');
});

test('every bundled airport has a valid IANA zone',() => {
  for (const [iata,[name,zone]] of Object.entries(airports)) {
    assert.match(iata,/^[A-Z]{3}$/);
    assert.ok(name.length);
    assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:zone}));
  }
});
