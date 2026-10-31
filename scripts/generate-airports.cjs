/* Refresh the bundled airport IATA → IANA-zone lookup from airportsdata (MIT).
 * Usage: node scripts/generate-airports.cjs /path/to/airports.csv
 * Source: https://github.com/mborsetti/airportsdata
 */
const fs = require('node:fs');
const path = require('node:path');
const csv = fs.readFileSync(process.argv[2] || '', 'utf8');
const records = [];
let row = [], field = '', quoted = false;
for (let i = 0; i < csv.length; i++) {
  const char = csv[i];
  if (char === '"') {
    if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
    else quoted = !quoted;
  } else if (char === ',' && !quoted) { row.push(field); field = ''; }
  else if ((char === '\n' || char === '\r') && !quoted) {
    if (char === '\r' && csv[i+1] === '\n') i++;
    row.push(field); if (row.some(Boolean)) records.push(row);
    row = []; field = '';
  } else field += char;
}
if (field || row.length) { row.push(field); records.push(row); }
const columns = records.shift();
const ix = name => columns.indexOf(name);
const entries = new Map();
for (const record of records) {
  const code = record[ix('iata')];
  const zone = record[ix('tz')];
  if (!/^[A-Z]{3}$/.test(code || '') || !zone) continue;
  try { new Intl.DateTimeFormat('en',{timeZone:zone}); } catch (_) { continue; }
  if (!entries.has(code)) entries.set(code,[record[ix('city')] || record[ix('name')] || code,zone]);
}
const sorted = Object.fromEntries([...entries].sort(([a],[b])=>a.localeCompare(b)));
const output = '/* Airport/time-zone data adapted from airportsdata.\n' +
  ' * Copyright (c) 2020 Mike Borsetti. Licensed under the MIT licence.\n' +
  ' * Source: https://github.com/mborsetti/airportsdata — times use IANA zones.\n' +
  ' * Verify booking details with the airline. */\n' +
  'window.JetRhythmAirports = ' + JSON.stringify(sorted) + ';\n';
fs.writeFileSync(path.join(__dirname,'../src/airports.js'),output);
console.log('Generated',entries.size,'airport time-zone mappings.');
