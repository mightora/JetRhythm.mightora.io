/* JetRhythm's independent, educational circadian planning model.
 * Times are estimates based on self-reported sleep, not measurements of DLMO/CBTmin.
 * References and modelling limitations are documented in METHODOLOGY.md.
 */
(function (root, create) {
  const api = create();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JetRhythmCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const formatterCache = new Map();
  const DAY = 86400000;

  function formatter(zone) {
    if (!formatterCache.has(zone)) {
      formatterCache.set(zone, new Intl.DateTimeFormat('en-GB', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }));
    }
    return formatterCache.get(zone);
  }

  function zoneParts(instant, zone) {
    const fields = {};
    for (const part of formatter(zone).formatToParts(new Date(instant))) {
      if (part.type !== 'literal') fields[part.type] = Number(part.value);
    }
    return fields;
  }

  function offsetMinutes(zone, instant) {
    const date = new Date(instant);
    const p = zoneParts(instant, zone);
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  }

  function zonedToUtc(local, zone) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
      throw new Error('Enter a complete date and time for every flight.');
    }
    const [year, month, day, hour, minute] = local.match(/\d+/g).map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    if (new Date(wall).toISOString().slice(0, 16) !== local) {
      throw new Error('Invalid calendar date or time.');
    }
    let instant = wall;
    for (let i = 0; i < 5; i++) {
      const next = wall - offsetMinutes(zone, instant) * 60000;
      if (next === instant) break;
      instant = next;
    }
    const p = zoneParts(instant, zone);
    if ([p.year, p.month, p.day, p.hour, p.minute].join('-') !==
        [year, month, day, hour, minute].join('-')) {
      throw new Error('This local time does not exist in ' + zone + ' because of a clock change.');
    }
    return new Date(instant);
  }

  function localDate(instant, zone) {
    const p = zoneParts(instant, zone);
    return [p.year, String(p.month).padStart(2, '0'), String(p.day).padStart(2, '0')].join('-');
  }

  function addDays(date, days) {
    const result = new Date(date + 'T12:00:00Z');
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
  }

  function minutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Please enter a valid sleep time.');
    const [h, m] = value.split(':').map(Number);
    if (h > 23 || m > 59) throw new Error('Please enter a valid sleep time.');
    return h * 60 + m;
  }

  function clock(value) {
    const m = ((Math.round(value) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  function checkZone(zone) {
    try { formatter(zone).format(new Date()); } catch (_) { throw new Error('Choose a valid IANA time zone.'); }
  }

  function flightDetails(legs) {
    if (!Array.isArray(legs) || legs.length < 1 || legs.length > 8) {
      throw new Error('Add between one and eight flight legs.');
    }
    const flights = legs.map((leg, index) => {
      checkZone(leg.fromZone);
      checkZone(leg.toZone);
      const departure = zonedToUtc(leg.departure, leg.fromZone);
      const arrival = zonedToUtc(leg.arrival, leg.toZone);
      if (arrival <= departure) throw new Error('Flight ' + (index + 1) + ' must arrive after it departs.');
      if ((arrival - departure) / 3600000 > 26) throw new Error('Flight ' + (index + 1) + ' is longer than 26 hours. Check the dates.');
      return { ...leg, departureUtc: departure.toISOString(), arrivalUtc: arrival.toISOString(),
        durationMinutes: Math.round((arrival - departure) / 60000) };
    });
    for (let i = 1; i < flights.length; i++) {
      if (Date.parse(flights[i].departureUtc) < Date.parse(flights[i - 1].arrivalUtc)) {
        throw new Error('Flights overlap. Please check the dates and order.');
      }
    }
    return flights;
  }

  function shortestShift(originZone, destinationZone, instant) {
    const difference = offsetMinutes(destinationZone, instant) - offsetMinutes(originZone, instant);
    return ((difference + 720 + 1440) % 1440) - 720;
  }

  function plan(input) {
    const flights = flightDetails(input.legs);
    const first = flights[0];
    const last = flights[flights.length - 1];
    const origin = first.fromZone;
    const destination = last.toZone;
    const arrivalUtc = Date.parse(last.arrivalUtc);
    const difference = shortestShift(origin, destination, arrivalUtc);
    const wake = minutes(input.wake || '07:00');
    const bed = minutes(input.bed || '23:00');
    const sleepHours = ((wake - bed + 1440) % 1440) / 60;
    if (sleepHours < 5 || sleepHours > 12) throw new Error('Your usual sleep window should be 5 to 12 hours.');
    const pace = { gentle: 30, balanced: 45, focused: 60 }[input.pace] || 45;
    const prepDays = 2;
    const shiftSign = Math.sign(difference);
    const total = Math.abs(difference);
    const preShift = Math.min(total, prepDays * pace);
    const arrivalDate = localDate(arrivalUtc, destination);
    const departureDate = localDate(first.departureUtc, origin);
    const pre = [];
    for (let i = 0; i < prepDays; i++) {
      const shifted = Math.min(total, (i + 1) * pace) * shiftSign;
      pre.push({ date: addDays(departureDate, i - prepDays),
        wake: clock(wake - shifted), bed: clock(bed - shifted),
        phaseShiftHours: Number((shifted / 60).toFixed(2)) });
    }
    const daysToAlign = total ? Math.ceil((total - preShift) / pace) : 0;
    const days = [];
    const length = Math.max(5, daysToAlign + 1);
    for (let i = 0; i < length; i++) {
      const remaining = Math.max(0, total - preShift - i * pace);
      const biologicalWake = wake + shiftSign * remaining;
      const nadir = biologicalWake - 180; // estimated core-temperature minimum
      const advancing = shiftSign > 0;
      days.push({
        date: addDays(arrivalDate, i),
        day: i,
        remainingHours: Number((remaining / 60).toFixed(2)),
        bodyWake: clock(biologicalWake),
        estimatedNadir: clock(nadir),
        seekLight: !remaining ? null : advancing
          ? [clock(nadir + 60), clock(nadir + 180)]
          : [clock(nadir - 180), clock(nadir - 60)],
        avoidLight: !remaining ? null : advancing
          ? [clock(nadir - 180), clock(nadir)]
          : [clock(nadir), clock(nadir + 180)],
        sleep: [clock(bed), clock(wake)],
        caffeineCutoff: clock(bed - 480)
      });
    }
    return {
      flights, origin, destination, arrivalDate, departureDate,
      timeDifferenceHours: Number((difference / 60).toFixed(2)),
      direction: difference > 0 ? 'advance' : difference < 0 ? 'delay' : 'none',
      estimatedAdjustmentDays: daysToAlign, pre, days,
      paceMinutesPerDay: pace,
      model: 'JetRhythm educational phase-response approximation v1',
      limitations: 'This is an estimate, not a measured circadian phase or clinically validated treatment plan.'
    };
  }

  function flightSleepWindow(flight, destinationZone, bedtime, wakeTime) {
    const start = Date.parse(flight.departureUtc);
    const end = Date.parse(flight.arrivalUtc);
    const bed = minutes(bedtime);
    const wake = minutes(wakeTime);
    let best = null;
    for (let offset = -2; offset < 4; offset++) {
      const date = addDays(localDate(start, destinationZone), offset);
      const sleepStart = zonedToUtc(date + 'T' + clock(bed), destinationZone).getTime();
      const next = addDays(date, wake <= bed ? 1 : 0);
      const sleepEnd = zonedToUtc(next + 'T' + clock(wake), destinationZone).getTime();
      const overlapStart = Math.max(start, sleepStart);
      const overlapEnd = Math.min(end, sleepEnd);
      if (overlapEnd - overlapStart > (best ? best.minutes * 60000 : 0)) {
        best = { startUtc: new Date(overlapStart).toISOString(),
          endUtc: new Date(overlapEnd).toISOString(),
          minutes: Math.round((overlapEnd - overlapStart) / 60000) };
      }
    }
    return best && best.minutes >= 60 ? best : null;
  }

  return { zoneParts, offsetMinutes, zonedToUtc, localDate, addDays, minutes, clock,
    flightDetails, shortestShift, plan, flightSleepWindow };
});
