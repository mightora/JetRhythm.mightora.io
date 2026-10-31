(function () {
  'use strict';
  const C = window.JetRhythmCore;
  const $ = id => document.getElementById(id);
  const MAX_LEGS = 8;
  const AIRPORTS = window.JetRhythmAirports || {};
  // The future service is a first-party endpoint, not a third-party API key in public JavaScript.
  // A flight number and travel date are the only parameters sent when this is configured.
  const LOOKUP_URL = document.querySelector('meta[name="flight-lookup-url"]')?.content || '';
  let currentInput = null;
  let currentPlan = null;
  let toastTimeout;
  const memory = new Map();

  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const localAirportDate = leg => (leg.departure || '').slice(0,10);
  const airportName = code => AIRPORTS[code] ? `${AIRPORTS[code][0]} (${code})` : code;
  const fmtDate = date => new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date + 'T12:00:00Z'));
  const formatInstant = (date,zone) => new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(date));

  const DB = {
    async connect() {
      if (!('indexedDB' in window)) return null;
      return new Promise(resolve => {
        try {
          const request = indexedDB.open('jetrhythm-journeys',1);
          request.onupgradeneeded = () => request.result.createObjectStore('journeys',{keyPath:'id'});
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        } catch (_) { resolve(null); }
      });
    },
    async all() {
      const db = await this.connect();
      if (!db) return [...memory.values()];
      return new Promise(resolve => {
        const req = db.transaction('journeys','readonly').objectStore('journeys').getAll();
        req.onsuccess = () => { const all = [...req.result,...memory.values()]; db.close(); resolve(all); };
        req.onerror = () => { db.close(); resolve([...memory.values()]); };
      });
    },
    async put(item) {
      const db = await this.connect();
      if (!db) { memory.set(item.id,item); return false; }
      return new Promise(resolve => {
        const tx = db.transaction('journeys','readwrite');
        tx.objectStore('journeys').put(item);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); memory.set(item.id,item); resolve(false); };
      });
    },
    async remove(id) {
      memory.delete(id);
      const db = await this.connect();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction('journeys','readwrite');
        tx.objectStore('journeys').delete(id);
        tx.oncomplete = tx.onerror = () => { db.close(); resolve(); };
      });
    },
    async clear() {
      memory.clear();
      const db = await this.connect();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction('journeys','readwrite');
        tx.objectStore('journeys').clear();
        tx.oncomplete = tx.onerror = () => { db.close(); resolve(); };
      });
    }
  };

  function addLeg(leg = {}) {
    const holder = $('flight-legs');
    if (holder.children.length >= MAX_LEGS) return notice('Up to eight connecting flights can be added.');
    const count = holder.children.length + 1;
    const entry = document.createElement('div');
    entry.className = 'flight-leg';
    const fromCode = String(leg.from || '').toUpperCase();
    const toCode = String(leg.to || '').toUpperCase();
    entry.innerHTML = `<div class="leg-title"><strong>✈ Flight ${count}</strong><button type="button" class="remove-leg text-button" ${count === 1 ? 'hidden' : ''}>Remove</button></div>
      <div class="flight-lookup-fields">
        <label class="field"><span>Flight number</span><input class="flight-number" maxlength="12" placeholder="e.g. BA117" value="${escape(leg.number || '')}" autocomplete="off"></label>
        <label class="field"><span>Departure date</span><input class="lookup-date" type="date" value="${escape(localAirportDate(leg))}"></label>
        <button class="btn btn-outline lookup-flight" type="button">Find this flight <span aria-hidden="true">↗</span></button>
      </div>
      <p class="lookup-feedback" role="status" aria-live="polite"></p>
      <div class="lookup-options" hidden></div>
      <details class="manual-details" ${!LOOKUP_URL || leg.departure ? 'open' : ''}><summary>Enter the route and ticket times manually</summary>
        <div class="leg-fields">
          <label class="field"><span>From · airport code</span><input class="from" list="airport-codes" maxlength="3" minlength="3" required placeholder="LHR" value="${escape(fromCode)}" aria-label="Departure airport code"></label>
          <label class="field"><span>To · airport code</span><input class="to" list="airport-codes" maxlength="3" minlength="3" required placeholder="JFK" value="${escape(toCode)}" aria-label="Arrival airport code"></label>
          <label class="field"><span>Departs · local time</span><input class="departure" type="datetime-local" required value="${escape(leg.departure || '')}"></label>
          <label class="field"><span>Arrives · local time</span><input class="arrival" type="datetime-local" required value="${escape(leg.arrival || '')}"></label>
        </div>
        <p class="leg-help airport-zone-status" aria-live="polite"></p>
      </details>`;
    const updateAirportStatus = () => {
      const from = entry.querySelector('.from').value;
      const to = entry.querySelector('.to').value;
      const known = [from,to].filter(Boolean).map(code => AIRPORTS[code] ? `${code}: ${AIRPORTS[code][1].replaceAll('_',' ')}` : `${code}: unknown airport`);
      entry.querySelector('.airport-zone-status').textContent = known.length
        ? 'Automatic time zones · ' + known.join(' · ') : 'Airport time zones are assigned automatically; no time-zone input is needed.';
    };
    for (const type of ['from','to']) {
      const field = entry.querySelector('.' + type);
      field.addEventListener('input', () => {
        field.value = field.value.toUpperCase().replace(/[^A-Z]/g,'');
        updateAirportStatus();
        refreshAirportList(field.value);
      });
      field.addEventListener('focus',() => refreshAirportList(field.value));
    }
    updateAirportStatus();
    entry.querySelector('.lookup-flight').addEventListener('click', () => lookupFlight(entry));
    entry.querySelector('.remove-leg').addEventListener('click', () => {
      entry.remove();
      [...holder.children].forEach((el,i) => {
        el.querySelector('.leg-title strong').textContent = '✈ Flight ' + (i + 1);
        el.querySelector('.remove-leg').hidden = i === 0;
      });
      $('add-leg').disabled = holder.children.length >= MAX_LEGS;
    });
    holder.appendChild(entry);
    $('add-leg').disabled = holder.children.length >= MAX_LEGS;
  }

  function refreshAirportList(query = '') {
    const list = $('airport-codes'); if (!list) return;
    const needle = query.toUpperCase();
    const matches = Object.entries(AIRPORTS).filter(([code]) => !needle || code.startsWith(needle)).slice(0,100);
    list.innerHTML = matches.map(([code,[name]]) => `<option value="${code}">${escape(name)}</option>`).join('');
  }

  function useFlight(entry, flight) {
    const from = String(flight.from || '').toUpperCase();
    const to = String(flight.to || '').toUpperCase();
    if (!AIRPORTS[from] || !AIRPORTS[to] || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(flight.departure || '') || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(flight.arrival || '')) {
      throw new Error('This flight record is incomplete. Please use your ticket details instead.');
    }
    entry.querySelector('.from').value = from;
    entry.querySelector('.to').value = to;
    entry.querySelector('.departure').value = flight.departure;
    entry.querySelector('.arrival').value = flight.arrival;
    entry.querySelector('.lookup-date').value = flight.departure.slice(0,10);
    entry.querySelector('.airport-zone-status').textContent = `Automatic time zones · ${from}: ${AIRPORTS[from][1]} · ${to}: ${AIRPORTS[to][1]}`;
    entry.querySelector('.manual-details').open = false;
    entry.querySelector('.lookup-feedback').textContent = `${airportName(from)} → ${airportName(to)} loaded. Check the times against your airline booking.`;
  }

  async function lookupFlight(entry) {
    const number = entry.querySelector('.flight-number').value.trim().toUpperCase().replace(/\s+/g,'');
    const date = entry.querySelector('.lookup-date').value;
    const feedback = entry.querySelector('.lookup-feedback');
    const chooser = entry.querySelector('.lookup-options');
    chooser.hidden = true;
    if (!/^[A-Z0-9]{3,10}$/.test(number) || !/^\d{4}-\d\d-\d\d$/.test(date)) {
      feedback.textContent = 'Enter a flight number and departure date to look up the schedule.'; return;
    }
    if (!LOOKUP_URL || location.protocol === 'file:') {
      feedback.textContent = 'Automatic flight schedules are not connected yet. For now, expand the manual details and use your airline booking. You will not need to enter a time zone.';
      entry.querySelector('.manual-details').open = true;
      return;
    }
    const button = entry.querySelector('.lookup-flight');
    button.disabled = true; feedback.textContent = 'Looking up the published schedule…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),12000);
    try {
      const request = new URL(LOOKUP_URL,location.href);
      request.searchParams.set('flight',number); request.searchParams.set('date',date);
      const response = await fetch(request.toString(),{signal:controller.signal,headers:{'Accept':'application/json'},cache:'no-store'});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Flight schedule lookup is unavailable right now.');
      const flights = Array.isArray(payload.flights) ? payload.flights : [];
      if (!flights.length) throw new Error('No published flight found for that number and date. Check your booking or enter ticket details.');
      const valid = flights.filter(f => AIRPORTS[f.from] && AIRPORTS[f.to]);
      if (!valid.length) throw new Error('The provider returned airport codes we cannot identify. Please use your booking.');
      if (valid.length === 1) useFlight(entry,valid[0]);
      else {
        chooser.innerHTML = '<label class="field"><span>Multiple matching flights · choose your route</span><select class="lookup-choice">' +
          valid.map((f,i) => `<option value="${i}">${escape(`${f.from} → ${f.to} · ${f.departure} to ${f.arrival}`)}</option>`).join('') +
          '</select></label><button type="button" class="btn btn-primary use-lookup">Use selected flight</button>';
        chooser.hidden = false;
        chooser.querySelector('.use-lookup').addEventListener('click',() => { useFlight(entry,valid[Number(chooser.querySelector('.lookup-choice').value)]); chooser.hidden = true; });
        feedback.textContent = 'Several scheduled flights match. Select the correct route from your booking.';
      }
    } catch (error) {
      feedback.textContent = error.name === 'AbortError' ? 'Flight lookup timed out. Enter your ticket details below.' : error.message;
      entry.querySelector('.manual-details').open = true;
    } finally { clearTimeout(timeout); button.disabled = false; }
  }

  function formData() {
    return {
      bed: $('bed').value, wake: $('wake').value, pace: $('pace').value,
      legs: [...$('flight-legs').children].map(el => ({
        number: el.querySelector('.flight-number').value.trim().toUpperCase().slice(0,12),
        from: el.querySelector('.from').value.trim().toUpperCase(),
        to: el.querySelector('.to').value.trim().toUpperCase(),
        fromZone: AIRPORTS[el.querySelector('.from').value.trim().toUpperCase()]?.[1],
        toZone: AIRPORTS[el.querySelector('.to').value.trim().toUpperCase()]?.[1],
        departure: el.querySelector('.departure').value,
        arrival: el.querySelector('.arrival').value
      }))
    };
  }

  function validate(input) {
    if (!Array.isArray(input.legs) || input.legs.length < 1 || input.legs.length > 8) throw new Error('A journey needs one to eight flights.');
    for (const [i,leg] of input.legs.entries()) {
      if (!/^[A-Z]{3}$/.test(leg.from) || !/^[A-Z]{3}$/.test(leg.to)) throw new Error('Flight ' + (i + 1) + ': enter three-letter airport codes.');
      if (!AIRPORTS[leg.from] || !AIRPORTS[leg.to]) throw new Error('Flight ' + (i + 1) + ': an airport code was not recognised. Check the IATA code on your ticket.');
      if (leg.from === leg.to) throw new Error('Flight ' + (i + 1) + ': arrival and departure airports must differ.');
      if (leg.number && !/^[A-Z0-9 -]{1,12}$/.test(leg.number)) throw new Error('Flight ' + (i + 1) + ': check the flight number.');
      if (i && input.legs[i-1].to !== leg.from) throw new Error('Flight ' + (i+1) + ' does not connect to the previous arrival airport.');
    }
  }

  function calculate(input, scroll = true) {
    try {
      validate(input);
      const normalised = {...input,legs:input.legs.map(leg => ({...leg,fromZone:AIRPORTS[leg.from][1],toZone:AIRPORTS[leg.to][1]}))};
      const result = C.plan(normalised);
      currentInput = normalised;
      currentPlan = result;
      $('form-message').hidden = true;
      render(result,input);
      if (scroll) $('results').scrollIntoView({behavior:'smooth'});
      return true;
    } catch (error) {
      $('form-message').textContent = error.message || 'Check your journey details and try again.';
      $('form-message').hidden = false;
      $('planner').scrollIntoView({behavior:'smooth'});
      return false;
    }
  }

  // A vertical day-by-day Gantt: each row spans 00:00–24:00 local time.
  // Windows crossing midnight are split into two bars on the same day track.
  function chartSegments(times) {
    if (!times) return [];
    const start = C.minutes(times[0]);
    const end = C.minutes(times[1]);
    if (end > start) return [[start,end]];
    if (end === start) return [];
    return [[0,end],[start,1440]];
  }

  function chartLane(label,times,kind) {
    const bars = chartSegments(times).map(([start,end]) => {
      const left = (start/1440*100).toFixed(3);
      const width = ((end-start)/1440*100).toFixed(3);
      return `<span class="gantt-bar gantt-${kind}" style="left:${left}%;width:${width}%"></span>`;
    }).join('');
    const range = times ? times.join('–') : 'No timed guidance';
    return `<div class="gantt-lane"><span class="gantt-lane-name">${escape(label)}</span><div class="gantt-track" aria-label="${escape(label)}: ${escape(range)}">${bars}</div><span class="gantt-lane-time">${escape(range)}</span></div>`;
  }

  function chartHtml(plan) {
    const days = plan.days.map(day => `<div class="gantt-day-row">
      <div class="gantt-day-title"><strong>${day.day === 0 ? 'Arrival' : 'Day ' + day.day}</strong><span>${escape(fmtDate(day.date))}</span><small>${day.remainingHours}h shift remaining</small></div>
      <div class="gantt-day-lanes">
        ${chartLane('Sleep',day.sleep,'sleep')}
        ${chartLane('Seek light',day.seekLight,'light')}
        ${chartLane('Dim light',day.avoidLight,'dark')}
      </div>
    </div>`).join('');
    return `<div class="gantt-legend" aria-label="Chart key"><span><i class="swatch swatch-sleep"></i>Target sleep</span><span><i class="swatch swatch-light"></i>Seek bright light</span><span><i class="swatch swatch-dark"></i>Reduce bright light</span></div>
      <div class="gantt-scroller" tabindex="0" role="region" aria-label="Scrollable 24-hour schedule">
        <div class="gantt-inner"><div class="gantt-axis"><span>Destination local time</span><div class="gantt-axis-ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>${days}</div>
      </div><p class="gantt-footnote">These bars show estimated timing, not measured biological responses. A bar wrapping midnight appears at both ends of the 24-hour scale.</p>`;
  }

  function render(plan,input) {
    $('result-placeholder').hidden = true;
    $('plan-output').hidden = false;
    $('results-intro').textContent = `${input.legs[0].from} → ${input.legs[input.legs.length-1].to}, arriving ${fmtDate(plan.arrivalDate)}. Flight times should always be checked against your airline booking.`;
    const stats = [
      ['Time zone change', (plan.timeDifferenceHours > 0 ? '+' : '') + plan.timeDifferenceHours + ' hours'],
      ['Direction', {advance:'Shift earlier',delay:'Shift later',none:'No shift needed'}[plan.direction]],
      ['Estimated adjustment',plan.estimatedAdjustmentDays + ' days after arrival'],
      ['Flights in journey',String(plan.flights.length)]
    ];
    $('summary').innerHTML = stats.map(([label,value]) => `<div class="stat"><small>${escape(label)}</small><strong>${escape(value)}</strong></div>`).join('');
    $('rhythm-chart').innerHTML = chartHtml(plan);
    let html = '<div class="day-card"><div class="day-head"><strong>Before you fly · ' + escape(plan.origin) + '</strong><span>Preparation</span></div>';
    html += plan.pre.map(day => `<div class="day-detail"><div class="signal"><small>${escape(fmtDate(day.date))} · Sleep</small><strong>${day.bed}–${day.wake}</strong></div><div class="signal"><small>Sleep shift from usual</small><strong>${Math.abs(day.phaseShiftHours).toFixed(2)} hours</strong></div></div>`).join('');
    html += '</div>';
    html += plan.days.map(day => `<details class="day-card day-details"><summary><strong>${day.day === 0 ? 'Arrival day' : 'Day ' + day.day} · ${escape(fmtDate(day.date))}</strong><span>Show guidance</span></summary>
      <div class="day-detail"><div class="signal"><small>Estimated biological wake time</small><strong>${day.bodyWake}</strong></div><div class="signal"><small>Target local sleep window</small><strong>${day.sleep[0]}–${day.sleep[1]}</strong></div>
      ${day.seekLight ? `<div class="signal light"><small>☀ Seek bright light</small><strong>${day.seekLight.join('–')}</strong></div><div class="signal dark"><small>☾ Reduce bright light</small><strong>${day.avoidLight.join('–')}</strong></div>` : '<div class="signal"><small>Estimated alignment</small><strong>Maintain a regular schedule</strong></div>'}
      <div class="signal"><small>Caffeine cut-off</small><strong>${day.caffeineCutoff}</strong></div><div class="signal"><small>Estimated shift remaining</small><strong>${day.remainingHours} h</strong></div></div></details>`).join('');
    $('schedule-list').innerHTML = html;
    $('flight-suggestions').innerHTML = plan.flights.map(flight => {
      let overlap = null;
      try { overlap = C.flightSleepWindow(flight,plan.destination,input.bed,input.wake); } catch (_) {}
      return `<div class="flight-suggestion"><strong>${escape(flight.number || 'Flight')} · ${escape(flight.from)} → ${escape(flight.to)}</strong>
        <p>${escape(formatInstant(flight.departureUtc,flight.fromZone))} → ${escape(formatInstant(flight.arrivalUtc,flight.toZone))}</p>
        <small>${Math.floor(flight.durationMinutes/60)}h ${flight.durationMinutes%60}m flight</small>
        <p>${overlap ? 'Potential destination-night sleep opportunity: <strong>' + escape(formatInstant(overlap.startUtc,plan.destination)) + ' to ' + escape(formatInstant(overlap.endUtc,plan.destination)) + '</strong> (' + Math.round(overlap.minutes/60*10)/10 + 'h).' : 'No substantial destination-night sleep window on this leg. Rest if you need to.'}</p>
        </div>`;
    }).join('');
  }

  function notice(message) {
    const toast = $('toast'); toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { toast.hidden = true; },4300);
  }

  function download(filename,text,mime) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([text],{type:mime}));
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function calendarExport() {
    if (!currentPlan) return;
    const plan = currentPlan;
    const input = currentInput;
    const events = [];
    const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const escapeIcs = value => String(value).replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
    const event = (title,from,to,description) => {
      const utc = date => date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      events.push(['BEGIN:VEVENT','UID:' + (events.length+1) + '-' + stamp + '@jetrhythm.mightora.io','DTSTAMP:'+stamp,'DTSTART:'+utc(from),'DTEND:'+utc(to),'SUMMARY:'+escapeIcs(title),'DESCRIPTION:'+escapeIcs(description),'END:VEVENT'].join('\r\n'));
    };
    const addWindow = (date,times,title,description) => {
      try {
        const start = C.zonedToUtc(date + 'T' + times[0],plan.destination);
        const endDate = times[1] <= times[0] ? C.addDays(date,1) : date;
        const end = C.zonedToUtc(endDate + 'T' + times[1],plan.destination);
        if (end > start) event(title,start,end,description);
      } catch (_) { /* Skip non-existent DST wall times. */ }
    };
    plan.flights.forEach(f => event(`Flight ${f.number || f.from+'–'+f.to}`,new Date(f.departureUtc),new Date(f.arrivalUtc),`${f.from} to ${f.to}; verify all flight details with your airline.`));
    plan.days.forEach(day => {
      if (day.seekLight) addWindow(day.date,day.seekLight,'JetRhythm · seek light','Estimated light window; do not compromise safety or essential sleep.');
      if (day.avoidLight) addWindow(day.date,day.avoidLight,'JetRhythm · reduce bright light','Estimated light-avoidance window.');
      addWindow(day.date,day.sleep,'JetRhythm · target sleep','Target local night, not a prediction of when you will feel sleepy.');
    });
    download('JetRhythm-' + plan.arrivalDate + '.ics','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mightora//JetRhythm//EN\r\nCALSCALE:GREGORIAN\r\n' + events.join('\r\n') + '\r\nEND:VCALENDAR\r\n','text/calendar;charset=utf-8');
  }

  function exportCurrent() {
    if (!currentInput) return;
    const file = {format:'jetrhythm-journey',version:1,exportedAt:new Date().toISOString(),journey:currentInput};
    download('JetRhythm-journey.json',JSON.stringify(file,null,2),'application/json');
  }

  async function saveCurrent() {
    if (!currentInput || !currentPlan) return;
    const item = {id: 'trip-' + Date.now() + '-' + Math.random().toString(36).slice(2,8),
      createdAt: new Date().toISOString(),input:currentInput};
    const saved = await DB.put(item);
    await listSaved();
    notice(saved ? 'Journey saved in this browser.' : 'This browser could not persist the journey. Please export a JSON backup.');
  }

  function fillForm(data) {
    $('bed').value = data.bed || '23:00'; $('wake').value = data.wake || '07:00';
    $('pace').value = data.pace || 'balanced';
    $('flight-legs').replaceChildren();
    data.legs.forEach(leg => addLeg(leg));
    $('add-leg').disabled = data.legs.length >= MAX_LEGS;
  }

  async function listSaved() {
    const saved = (await DB.all()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    $('clear-all').hidden = saved.length === 0;
    if (!saved.length) { $('saved-list').innerHTML = '<p class="subtle">No journeys saved yet.</p>'; return; }
    $('saved-list').innerHTML = saved.map(item => {
      const legs = item.input.legs;
      return `<article class="saved-item"><div><h3>${escape(legs[0].from)} → ${escape(legs[legs.length-1].to)}</h3><p>${escape(legs.length)} flight${legs.length > 1 ? 's' : ''} · Saved ${escape(new Date(item.createdAt).toLocaleDateString('en-GB'))}</p></div><div class="saved-actions"><button class="btn btn-outline" type="button" data-action="load" data-id="${escape(item.id)}">Open</button><button type="button" class="text-button danger-link" data-action="delete" data-id="${escape(item.id)}">Delete</button></div></article>`;
    }).join('');
  }

  async function onSavedClick(event) {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === 'delete') {
      await DB.remove(id); await listSaved(); notice('Saved journey deleted.'); return;
    }
    const item = (await DB.all()).find(x => x.id === id);
    if (item) { fillForm(item.input); calculate(item.input); notice('Saved journey opened and recalculated.'); }
  }

  async function onImport(event) {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    try {
      if (file.size > 100000) throw new Error('The file is too large for a journey.');
      const payload = JSON.parse(await file.text());
      if (payload.format !== 'jetrhythm-journey' || payload.version !== 1) throw new Error('Not a supported JetRhythm journey file.');
      const input = payload.journey;
      validate(input);
      C.plan(input);
      fillForm(input);
      calculate(input);
      notice('Journey imported. Choose Save to keep it in this browser.');
    } catch (error) { notice(error.message || 'Unable to import this file.'); }
    event.target.value = '';
  }

  function setUpNavigation() {
    const header = document.querySelector('mightora-header');
    if (!window.customElements || !customElements.get('mightora-header')) {
      const menu = header.querySelector('.offline-menu');
      const nav = header.querySelector('.header-nav');
      menu.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        menu.setAttribute('aria-expanded',String(open));
      });
      nav.addEventListener('click',event => { if (event.target.closest('a')) { nav.classList.remove('open'); menu.setAttribute('aria-expanded','false'); } });
    }
    const setHeight = () => document.documentElement.style.setProperty('--header-h',Math.round(header.getBoundingClientRect().height)+'px');
    setHeight();
    if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(header);
  }

  function init() {
    setUpNavigation();
    const list = document.createElement('datalist'); list.id = 'airport-codes';
    document.body.appendChild(list);
    refreshAirportList();
    $('lookup-availability').textContent = LOOKUP_URL && location.protocol !== 'file:'
      ? 'Checking flight lookup…' : 'Offline: enter ticket times';
    if (LOOKUP_URL && location.protocol !== 'file:') {
      fetch('/api/status',{headers:{'Accept':'application/json'},cache:'no-store'})
        .then(response => { if (!response.ok) throw new Error('Status unavailable'); return response.json(); })
        .then(status => { $('lookup-availability').textContent = status.available ? 'Flight lookup ready' : 'Live lookup awaiting subscription'; })
        .catch(() => { $('lookup-availability').textContent = 'Live lookup unavailable'; });
    }
    addLeg();
    $('add-leg').addEventListener('click', () => addLeg());
    $('fill-example').addEventListener('click', () => {
      fillForm({bed:'23:00',wake:'07:00',pace:'balanced',legs:[
        {from:'LAS',to:'DTW',departure:'2026-10-31T08:00',arrival:'2026-10-31T15:30'},
        {from:'DTW',to:'CDG',departure:'2026-10-31T18:30',arrival:'2026-11-01T07:30'},
        {from:'CDG',to:'NCL',departure:'2026-11-01T10:30',arrival:'2026-11-01T11:30'}]});
      notice('Illustrative example loaded. These are NOT verified flight times.');
    });
    $('plan-form').addEventListener('submit',event => { event.preventDefault(); calculate(formData()); });
    $('save-plan').addEventListener('click',saveCurrent);
    $('export-calendar').addEventListener('click',calendarExport);
    $('export-json').addEventListener('click',exportCurrent);
    $('print-plan').addEventListener('click',() => window.print());
    $('saved-list').addEventListener('click',onSavedClick);
    $('import-plan').addEventListener('click',() => $('import-file').click());
    $('import-file').addEventListener('change',onImport);
    $('clear-all').addEventListener('click',async () => {
      if (!window.confirm('Permanently delete every journey saved in this browser?')) return;
      await DB.clear(); await listSaved(); notice('All saved journeys deleted.');
    });
    $('forget-theme').addEventListener('click',() => {
      try { localStorage.removeItem('jetrhythm-theme'); } catch (_) {}
      document.documentElement.setAttribute('data-theme','light');
      notice('Appearance preference removed.');
    });
    listSaved();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
