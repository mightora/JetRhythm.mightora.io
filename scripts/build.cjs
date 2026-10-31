const fs = require('node:fs');
const path = require('node:path');
const {deflateRawSync} = require('node:zlib');
const base = path.resolve(__dirname, '..');
const source = path.join(base, 'src');
const dist = path.join(base, 'dist');
fs.mkdirSync(dist,{recursive:true});
fs.cpSync(source,dist,{recursive:true,force:true});
fs.writeFileSync(path.join(dist,'.nojekyll'),'');

const brand = 'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png';
const pages = {
  'privacy.html': {
    title:'Privacy and browser storage | JetRhythm',
    description:'How JetRhythm stores flight journeys locally, uses browser storage and keeps its free jet lag calculator private.',
    html:`<h1>Privacy and browser storage</h1><p class="lead">JetRhythm is designed to help you plan time-zone adjustments without creating an account. Core plan calculations and saved journeys remain in your browser.</p>
    <h2>What happens to your journey</h2><p>Flight numbers, airport codes, flight times, sleep settings and calculated schedules are processed locally by JavaScript in your browser. We do not collect, transmit or store them on a Mightora server. The optional <strong>Save on this device</strong> button stores a journey in your browser's IndexedDB. This storage exists to provide the save-and-reopen feature you requested.</p>
    <h2>What is stored on your device?</h2><ul><li><strong>IndexedDB:</strong> journeys you explicitly save, until you delete them or your browser clears site data.</li><li><strong>Local storage:</strong> the shared Mightora header may remember your light/dark appearance preference when you change it.</li><li><strong>Cache Storage:</strong> an optional service worker saves core application files to make the site available offline.</li></ul>
    <p>Browser data is not a secure backup. Private browsing often clears it on close. Export journeys as JSON if you want to keep a copy or move devices. Use the Delete buttons to erase saved journeys.</p>
    <h2>Cookies and analytics</h2><p>JetRhythm itself sets no advertising cookies, analytics cookies or tracking identifiers. No third-party advertising or analytics is active in this release. Browser storage is used for explicitly requested functions and preferences. We provide this notice and control to delete stored plans. If we introduce non-exempt tracking later, the consent mechanism will be reviewed before activation.</p>
    <h2>Hosting and third-party resources</h2><p>When you load the online website, hosting providers process standard HTTP requests (which can include IP address and browser details). Mightora shared components and styles are retrieved from jsDelivr and GitHub-hosted assets. Those providers may receive normal request metadata. There is currently no live aviation API integration. When one is connected, a request to look up a flight will send its flight number and departure date to the aviation data service through a first-party proxy, never your sleep schedule or saved plans.</p>
    <h2>Offline alternative</h2><p>The downloadable standalone HTML embeds the code and branding. Opening it directly does not make application network requests. External links remain optional and open only if you choose them.</p>
    <h2>Contact and updates</h2><p>JetRhythm is an open-source Mightora project by Ian Tweedie. For questions or issues, use the <a href="https://github.com/mightora/JetRhythm.mightora.io/issues">GitHub issue tracker</a>. We will update this notice when functionality changes.</p>
    <p><em>Last reviewed: 31 October 2026. This is a functional privacy statement, not a promise about how other websites or browser extensions process data.</em></p>`
  },
  'network.html': {
    title:'Network transparency | JetRhythm',
    description:'Inspect external requests used by JetRhythm and learn how to verify browser-only flight and sleep calculations.',
    html:`<h1>Network transparency</h1><p class="lead">You should be able to check our privacy claims yourself.</p>
    <h2>Online edition</h2><p>Core calculation functions run locally. The website is served by its host. Its Mightora UI stylesheet, components and YAML parser are fetched from jsDelivr; branded imagery may load from GitHub or TechTweedie. No flight itinerary data is included in those resource URLs. Optional quality badges load from GitHub and Shields.io. Flight-number lookup will transmit a flight number and date to a provider only once an explicit lookup endpoint is configured and you click Find this flight.</p>
    <h2>Observed resource hosts</h2><p>The list below shows hosts from resource timing entries visible to this page. Cross-origin restrictions, cache hits and browser behaviour can limit what appears, so this is <strong>not an independent security audit</strong>.</p><div id="resource-hosts" class="host-list" aria-live="polite">Loading resource summary…</div>
    <h2>Verify in Developer Tools</h2><ol><li>Open this site in a desktop browser.</li><li>Press F12 and select the Network panel.</li><li>Enable <strong>Preserve log</strong> and reload.</li><li>Filter by domain and inspect request URLs and payloads.</li><li>Generate a plan: your itinerary should not appear in any request.</li></ol>
    <h2>Offline edition</h2><p>The HTML download contains its application code, CSS and Mightora logo. It does not load any external scripts, images, fonts, analytics or APIs. You can open the file from disk with your connection disabled. External links are optional and are not requested until clicked.</p>
    <p>Open-source code and workflows: <a href="https://github.com/mightora/JetRhythm.mightora.io">GitHub repository</a>.</p>
    <script>window.addEventListener('load',function(){const items=performance.getEntriesByType('resource');const hosts=[...new Set(items.map(x=>{try{return new URL(x.name).hostname}catch{return ''}}).filter(Boolean))].sort();document.getElementById('resource-hosts').textContent=hosts.length?hosts.join(' · '):'No resource hosts were exposed by the browser’s Resource Timing API.';});</script>`
  }
};

function inlineMarkdown(markdown) {
  return markdown.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
}

function markdownToHtml(text) {
  const output=[]; let list=null;
  for (const original of text.split(/\r?\n/)) {
    const line=original.trim();
    if (!line) { if (list) {output.push('</'+list+'>');list=null;} continue; }
    const h=line.match(/^(#{1,3})\s+(.*)/);
    if (h) { if (list) {output.push('</'+list+'>');list=null;}output.push(`<h${h[1].length}>${inlineMarkdown(h[2])}</h${h[1].length}>`);continue; }
    const bullet=line.match(/^([-*]|\d+\.)\s+(.*)/);
    if (bullet) { const type=/\d/.test(bullet[1])?'ol':'ul';if(list!==type){if(list)output.push('</'+list+'>');output.push('<'+type+'>');list=type;}output.push('<li>'+inlineMarkdown(bullet[2])+'</li>');continue; }
    if (list) {output.push('</'+list+'>');list=null;}
    output.push('<p>'+inlineMarkdown(line)+'</p>');
  }
  if(list)output.push('</'+list+'>');
  return output.join('\n');
}

pages['METHODOLOGY.html'] = {
  title:'Jet lag planner methodology and scientific references | JetRhythm',
  description:'Read the research, assumptions, accuracy limits and independent calculation method behind the free JetRhythm body clock planner.',
  html:markdownToHtml(fs.readFileSync(path.join(base,'METHODOLOGY.md'),'utf8'))
};

function documentPage(slug, page) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#102b32"><title>${page.title}</title><meta name="description" content="${page.description}"><link rel="canonical" href="https://jetrhythm.mightora.io/${slug}"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/shared.css"><link rel="stylesheet" href="styles.css"><script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js" defer></script><script src="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/components.js" defer></script></head><body><a href="#main" class="skip-link">Skip to content</a><mightora-header site-name="JetRhythm" site-url="/" logo-light="${brand}" logo-dark="${brand}" nav-links='[{"label":"Planner","url":"/"},{"label":"Methodology","url":"/METHODOLOGY.html"},{"label":"Privacy","url":"/privacy.html"}]'><div class="container offline-header-inner"><a href="/" class="site-logo"><img src="mightora-logo.png" alt="Mightora" class="site-logo-brand-img"> JetRhythm</a><nav><a href="/">Back to planner</a></nav></div></mightora-header><main id="main" class="doc-page"><div class="container narrow doc-content"><a class="back-link" href="/">← Back to the planner</a>${page.html}</div></main><mightora-author><div class="author-section-overlay"><div class="author-section-inner"><div class="author-text"><h2 class="author-heading">Built by TechTweedie</h2><p class="author-bio">JetRhythm is an open-source Mightora tool by Ian Tweedie.</p></div></div></div></mightora-author><mightora-footer><div class="container"><div class="footer-bottom"><div class="footer-copy">© 2026 Mightora · <a href="https://github.com/mightora/JetRhythm.mightora.io">Source code</a></div></div></div></mightora-footer></body></html>`;
}
for (const [slug,page] of Object.entries(pages)) fs.writeFileSync(path.join(dist,slug),documentPage(slug,page));

// Generate a double-clickable, network-free edition from exactly the same source code.
const core=fs.readFileSync(path.join(source,'core.js'),'utf8');
const airports=fs.readFileSync(path.join(source,'airports.js'),'utf8');
const app=fs.readFileSync(path.join(source,'app.js'),'utf8');
const css=fs.readFileSync(path.join(source,'styles.css'),'utf8');
const logo=fs.readFileSync(path.join(source,'mightora-logo.png')).toString('base64');
const favicon=fs.readFileSync(path.join(source,'favicon.svg')).toString('base64');
let offline=fs.readFileSync(path.join(source,'index.html'),'utf8');
offline=offline.replace(/<link[^>]*data-online-only[^>]*>/gs,'');
offline=offline.replace(/<script[^>]*data-online-only[^>]*>[\s\S]*?<\/script>/g,'');
offline=offline.replace(/<link rel="manifest"[^>]*>/g,'');
offline=offline.replace(/<link rel="stylesheet" href="styles.css">/,'<style>'+css+'</style>');
offline=offline.replace(/<link rel="icon" href="favicon.svg" type="image\/svg\+xml">/,'<link rel="icon" href="data:image/svg+xml;base64,'+favicon+'" type="image/svg+xml">');
offline=offline.replace(/<script src="core.js" defer><\/script>/,'<script>'+core.replace(/<\/script/gi,'<\\/script')+'</script>');
offline=offline.replace(/<script src="airports.js" defer><\/script>/,'<script>'+airports.replace(/<\/script/gi,'<\\/script')+'</script>');
offline=offline.replace(/<script src="app.js" defer><\/script>/,'<script>'+app.replace(/<\/script/gi,'<\\/script')+'</script>');
offline=offline.replace(/src="mightora-logo.png"/g,'src="data:image/png;base64,'+logo+'"');
offline=offline.replace(/<img src="https:\/\/techtweedie\.github\.io\/images\/author\/[^>]+>/g,'');
offline=offline.replace(/<img src="https:\/\/raw\.githubusercontent\.com\/TechTweedie\/[^>]+>/g,'');
offline=offline.replace(/<div class="container badge-row"[\s\S]*?<\/div>\s*<mightora-author>/,'<mightora-author>');
offline=offline.replace(/href="METHODOLOGY.html"/g,'href="#science"').replace(/href="privacy.html"/g,'href="#privacy"').replace(/href="network.html"/g,'href="#privacy"');
offline=offline.replace(/<a href="downloads\/JetRhythm-Offline.html"[^>]*>[^<]*<\/a>\s*·\s*<a href="downloads\/JetRhythm-Offline.zip"[^>]*>[^<]*<\/a>/g,'<span>Offline Edition – No Internet Connection Required</span>');
offline=offline.replace('<body>','<body><div class="offline-banner">Offline Edition – No Internet Connection Required</div>');
offline=offline.replace('</body>','</body>');
const downloads=path.join(dist,'downloads');
fs.mkdirSync(downloads,{recursive:true});
fs.writeFileSync(path.join(downloads,'JetRhythm-Offline.html'),offline);
const temp=path.join(base,'.offline-package');
fs.mkdirSync(temp,{recursive:true});
fs.copyFileSync(path.join(downloads,'JetRhythm-Offline.html'),path.join(temp,'JetRhythm-Offline.html'));
fs.copyFileSync(path.join(base,'LICENSE'),path.join(temp,'LICENSE'));
fs.copyFileSync(path.join(base,'THIRD_PARTY_NOTICES.md'),path.join(temp,'THIRD_PARTY_NOTICES.md'));
fs.writeFileSync(path.join(temp,'README.txt'),'JetRhythm — Offline Edition\n\nDouble-click JetRhythm-Offline.html to run in a modern web browser. No installation, network connection or account is required. Your plan is calculated locally. Browser storage may not persist when opening files from disk, so export journeys as JSON. The application provides educational estimates, not medical advice.\n');
const zip=path.join(downloads,'JetRhythm-Offline.zip');
function crc32(buffer) {
  let value=0xffffffff;
  for(const byte of buffer) {
    value ^= byte;
    for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
  }
  return (value^0xffffffff)>>>0;
}
function zipFiles(fileNames) {
  const local=[]; const central=[]; let offset=0;
  for(const name of fileNames) {
    const filename=Buffer.from(name);
    const data=fs.readFileSync(path.join(temp,name));
    const compressed=deflateRawSync(data,{level:9});
    const hash=crc32(data);
    const head=Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(8,8);
    head.writeUInt32LE(hash,14);head.writeUInt32LE(compressed.length,18);head.writeUInt32LE(data.length,22);
    head.writeUInt16LE(filename.length,26);
    local.push(head,filename,compressed);
    const record=Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50,0);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);
    record.writeUInt16LE(8,10);record.writeUInt32LE(hash,16);
    record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(data.length,24);
    record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);
    central.push(record,filename);
    offset += head.length+filename.length+compressed.length;
  }
  const center=Buffer.concat(central);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(fileNames.length,8);end.writeUInt16LE(fileNames.length,10);
  end.writeUInt32LE(center.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,center,end]);
}
fs.writeFileSync(zip,zipFiles(['JetRhythm-Offline.html','README.txt','LICENSE','THIRD_PARTY_NOTICES.md']));
fs.rmSync(temp,{recursive:true,force:true});
console.log('Built',dist,'and network-free offline edition');
