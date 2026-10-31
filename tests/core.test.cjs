const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');

test('Converts wall time across winter and summer London offsets',()=>{
  assert.equal(C.zonedToUtc('2026-07-01T12:00','Europe/London').toISOString(),'2026-07-01T11:00:00.000Z');
  assert.equal(C.zonedToUtc('2026-11-01T12:00','Europe/London').toISOString(),'2026-11-01T12:00:00.000Z');
});

test('Handles the 2026 US/UK daylight saving mismatch',()=>{
  const before=Date.parse('2026-10-31T19:00:00Z');
  const after=Date.parse('2026-11-01T19:00:00Z');
  assert.equal(C.shortestShift('America/Los_Angeles','Europe/London',before),420);
  assert.equal(C.shortestShift('America/Los_Angeles','Europe/London',after),480);
});

test('Rejects imaginary DST time, overlapping flights and inverted times',()=>{
  assert.throws(()=>C.zonedToUtc('2026-03-29T01:30','Europe/London'),/does not exist/);
  assert.throws(()=>C.flightDetails([{fromZone:'UTC',toZone:'UTC',departure:'2026-05-01T18:00',arrival:'2026-05-01T17:00'}]),/after it departs/);
  assert.throws(()=>C.flightDetails([
    {fromZone:'UTC',toZone:'UTC',departure:'2026-05-01T10:00',arrival:'2026-05-01T12:00'},
    {fromZone:'UTC',toZone:'UTC',departure:'2026-05-01T11:00',arrival:'2026-05-01T14:00'}
  ]),/overlap/);
});

test('Creates arrival schedule with time zone and flight calculations',()=>{
  const result=C.plan({bed:'23:00',wake:'07:00',pace:'balanced',legs:[{
    number:'TEST1',from:'LAS',to:'LHR',fromZone:'America/Los_Angeles',toZone:'Europe/London',
    departure:'2026-10-31T14:00',arrival:'2026-11-01T10:00'
  }]});
  assert.equal(result.direction,'advance');
  assert.equal(result.timeDifferenceHours,8);
  assert.ok(result.estimatedAdjustmentDays>3);
  assert.ok(result.days[0].seekLight);
  assert.equal(result.flights[0].durationMinutes,780);
  assert.equal(result.days[result.days.length-1].remainingHours,0);
});

test('Westbound plan delays clock, no-time-zone-change plan is aligned',()=>{
  const west=C.plan({bed:'23:00',wake:'07:00',pace:'focused',legs:[{
    from:'LHR',to:'JFK',fromZone:'Europe/London',toZone:'America/New_York',
    departure:'2026-10-30T10:00',arrival:'2026-10-30T14:00'
  }]});
  assert.equal(west.direction,'delay');
  const same=C.plan({bed:'23:00',wake:'07:00',pace:'balanced',legs:[{
    from:'LHR',to:'NCL',fromZone:'Europe/London',toZone:'Europe/London',
    departure:'2026-10-30T10:00',arrival:'2026-10-30T12:00'
  }]});
  assert.equal(same.direction,'none');
  assert.equal(same.estimatedAdjustmentDays,0);
  assert.equal(same.days[0].seekLight,null);
});

test('Detects destination-night opportunity on a long flight',()=>{
  const f=C.flightDetails([{
    fromZone:'America/New_York',toZone:'Europe/London',
    departure:'2026-10-30T18:00',arrival:'2026-10-31T05:30'
  }])[0];
  const window=C.flightSleepWindow(f,'Europe/London','23:00','07:00');
  assert.ok(window && window.minutes>=120);
});
