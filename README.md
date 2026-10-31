# JetRhythm by Mightora

**Arrive in sync.** JetRhythm is an independently developed, open-source, privacy-first jet lag and body-clock planner.

Website: [jetrhythm.mightora.io](https://jetrhythm.mightora.io/) · [Model methodology](METHODOLOGY.md)

## What it does

- Plans journeys with up to eight flights, including local airport times and daylight-saving transitions.
- Automatically derives IANA time zones from airport codes using an MIT-licensed reference mapping of more than 7,900 airports. Visitors never select a time zone.
- Provides a flight-number and departure-date lookup via a first-party Cloudflare Worker, enabled when a licensed schedule-provider key is configured; manual ticket-time entry remains available.
- Estimates biological waking, gradual time-zone adjustment, light-seeking and light-avoidance windows.
- Shows results as a vertical day-by-day, 24-hour Gantt chart with separate sleep, light-seeking and light-reduction bars plus expandable details.
- Shows possible destination-night sleep windows on flight legs.
- Saves journeys in browser IndexedDB only at the user's request; supports JSON backup/import.
- Exports calendar `.ics` files, supports printing, and provides a double-clickable offline HTML/ZIP.
- Exposes SEO/AEO-friendly page content, schema.org metadata, a sitemap, robots.txt, methodology, FAQs and privacy pages.
- Uses Mightora's shared header, author, footer and styling online; offline branding is bundled locally.

## Build and test

No runtime npm dependencies or paid APIs are required for the core planner. Live flight schedule lookup requires a suitable AeroDataBox subscription.

```sh
npm test
npm run build
npm run verify
npm run bundle:worker
```

Open `dist/index.html` through a local web server to test the online edition. To run without any server, open `dist/downloads/JetRhythm-Offline.html` directly. The ZIP includes instructions, the MIT licence and third-party data notices.

## Deployment

Cloudflare Workers hosts **both** the generated static files and the first-party API. GitHub is the source repository, not the website host. The preferred deployment uses Wrangler's static assets support, with API paths routed to the Worker. After authenticating Wrangler to the appropriate Cloudflare account:

```sh
npm run verify
npx wrangler deploy
npx wrangler secret put AERODATABOX_RAPIDAPI_KEY
```

Bind the Cloudflare Worker to the `jetrhythm.mightora.io` custom domain in the Cloudflare dashboard after testing its workers.dev address. Store credentials as Worker **secrets**, never source or public environment variables. Do not reactivate GitHub Pages deployment. An optional `npm run bundle:worker` builds a self-contained script for direct API deployment when Wrangler's asset-upload integration cannot be used.

## Flight numbers and APIs

Flight-number lookup requires a licensed source of **future scheduled flights**, not merely live aircraft positions. The Worker calls AeroDataBox's RapidAPI flight status by flight number and departure-local date, and returns `{ "flights": [{ "number": "BA117", "from": "LHR", "to": "JFK", "departure": "2026-11-02T10:30", "arrival": "2026-11-02T14:00" }] }` with local airport times; multiple matching flights can be returned. The browser uses `/api/status` to show whether a provider key is available.

The Worker validates input, never exposes the provider secret, caches public schedules for six hours (subject to the provider's licence), and reports upstream quota errors. Configure a Cloudflare rate-limiting rule on `/api/flights` before heavy public traffic. Since no provider key has been supplied, live lookup remains explicitly unavailable. Core planning and automatic airport time zones work without a provider, including offline. AeroDataBox's **2026 terms** require visible attribution on free/trial and Basic plans and do **not permit commercial use** on those plans. Check whether your deployment needs a paid subscription before enabling this integration. See [AeroDataBox pricing](https://aerodatabox.com/pricing) and [terms](https://aerodatabox.com/terms).

Airport reference source: [airportsdata](https://github.com/mborsetti/airportsdata), MIT licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). To refresh the mapping, download its airports CSV and run `node scripts/generate-airports.cjs /path/to/airports.csv`.

## Scientific and safety boundaries

See [METHODOLOGY.md](METHODOLOGY.md) before changing the algorithm. The displayed phase and light windows are educational approximations, not measured circadian phase or clinically validated care. Never describe the estimated adjustment days as guaranteed recovery. Medication dosing is deliberately excluded.

## Privacy

No app analytics or advertising are active. Plan calculation stays in the browser, and save is opt-in. The online Mightora shared UI and repository badges use third-party asset hosts; see the [network transparency page](https://jetrhythm.mightora.io/network.html). Functional storage and preferences are disclosed. Review PECR/UK GDPR duties before adding any tracking or paid flight-data provider.

## Licence

MIT. Copyright © 2026 Tweed Technology Ltd. Airport mapping data carries a separate attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The scientific publications linked from the methodology are separate works and are not relicensed by this repository.
