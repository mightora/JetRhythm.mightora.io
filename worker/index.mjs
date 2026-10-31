/* JetRhythm's first-party flight-lookup proxy. No journey or sleep data reaches this Worker. */
const HOST = 'aerodatabox.p.rapidapi.com';
const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const FLIGHT_PATTERN = /^[A-Z0-9]{3,10}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers:JSON_HEADERS});
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) return false;
  // Exclude accidental or abusive requests for years outside published schedules.
  return Math.abs(parsed.getTime() - Date.now()) <= 366 * 86400000;
}

function localTime(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  return match ? `${match[1]}T${match[2]}` : null;
}

function normalize(raw, requestedNumber, date) {
  const departure = raw.departure || {};
  const arrival = raw.arrival || {};
  const from = String(departure.airport?.iata || departure.airport?.iataCode || '').toUpperCase();
  const to = String(arrival.airport?.iata || arrival.airport?.iataCode || '').toUpperCase();
  const departAt = localTime(departure.scheduledTime?.local || departure.scheduledTimeLocal);
  const arriveAt = localTime(arrival.scheduledTime?.local || arrival.scheduledTimeLocal);
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !departAt || !arriveAt || departAt.slice(0,10) !== date) return null;
  return {number:String(raw.number || requestedNumber).slice(0,12),from,to,departure:departAt,arrival:arriveAt};
}

async function providerLookup(number, date, key, fetcher) {
  const endpoint = new URL(`https://${HOST}/flights/number/${encodeURIComponent(number)}/${date}`);
  endpoint.searchParams.set('dateLocalRole','Departure');
  const response = await fetcher(endpoint, {
    headers:{'X-RapidAPI-Key':key,'X-RapidAPI-Host':HOST,'Accept':'application/json'},
    redirect:'error', signal:AbortSignal.timeout(8500)
  });
  if (response.status === 429) return json({error:'The flight-data quota is busy. Please use the ticket times or try again later.'},429);
  if (response.status === 404) return json({flights:[],source:'AeroDataBox'});
  if (!response.ok) return json({error:'The flight schedule provider is temporarily unavailable. Use the times on your ticket.'},502);
  const records = await response.json();
  const candidates = Array.isArray(records) ? records : Array.isArray(records.flights) ? records.flights : [];
  const flights = candidates.map(f => normalize(f,number,date)).filter(Boolean).slice(0,12);
  return json({flights,source:'AeroDataBox',attribution:'https://aerodatabox.com'});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      // Direct-API deployment fallback: generated bundle embeds the static files.
      return typeof embeddedAsset === 'function' ? embeddedAsset(request) : new Response('Not found',{status:404});
    }
    if (request.method !== 'GET') return json({error:'Method not allowed'},405);
    if (url.pathname === '/api/status') {
      return json({available:Boolean(env.AERODATABOX_RAPIDAPI_KEY),provider:'AeroDataBox'});
    }
    if (url.pathname !== '/api/flights') return json({error:'Not found'},404);
    const number = String(url.searchParams.get('flight') || '').trim().toUpperCase();
    const date = String(url.searchParams.get('date') || '');
    if (!FLIGHT_PATTERN.test(number) || !validDate(date) || [...url.searchParams.keys()].some(k=>!['flight','date'].includes(k))) {
      return json({error:'Enter a valid flight number and a travel date within one year of today.'},400);
    }
    if (!env.AERODATABOX_RAPIDAPI_KEY) {
      return json({error:'Live lookup is awaiting an aviation data subscription. Please enter the route and ticket times manually; airport time zones are automatic.'},503);
    }
    // Identical public flight schedules are cached for six hours, within the provider's
    // published seven-day retention limit. Neither API keys nor sleep plans are cached.
    const key = new Request(`https://jetrhythm.mightora.io/api/flights?flight=${number}&date=${date}`);
    const edgeCache = globalThis.caches?.default;
    const cached = edgeCache && await edgeCache.match(key);
    if (cached) return new Response(cached.body,{status:cached.status,headers:JSON_HEADERS});
    try {
      const result = await providerLookup(number,date,env.AERODATABOX_RAPIDAPI_KEY,fetch);
      if (result.ok && edgeCache) {
        const cacheable = new Response(result.clone().body,{status:200,headers:{'content-type':'application/json','cache-control':'public, max-age=21600'}});
        ctx?.waitUntil?.(edgeCache.put(key,cacheable));
      }
      return result;
    } catch (_) {
      return json({error:'Flight lookup could not be completed. Check the airline ticket and try again later.'},502);
    }
  }
};

export {localTime, normalize, validDate};
