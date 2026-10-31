# JetRhythm by Mightora

**Arrive in sync.** JetRhythm is an independently developed, open-source, privacy-first jet lag and body-clock planner.

Website: [jetrhythm.mightora.io](https://jetrhythm.mightora.io/) · [Model methodology](METHODOLOGY.md)

## What it does

- Plans journeys with up to eight flights, including local airport times and daylight-saving transitions.
- Automatically derives IANA time zones from airport codes using an MIT-licensed reference mapping of more than 7,900 airports. Visitors never select a time zone.
- Provides a flight-number and departure-date lookup interface, ready for a first-party schedule API; until a provider is connected, manual entry of ticket times is available and clearly labelled.
- Estimates biological waking, gradual time-zone adjustment, light-seeking and light-avoidance windows.
- Shows results as a vertical day-by-day, 24-hour Gantt chart with separate sleep, light-seeking and light-reduction bars plus expandable details.
- Shows possible destination-night sleep windows on flight legs.
- Saves journeys in browser IndexedDB only at the user's request; supports JSON backup/import.
- Exports calendar `.ics` files, supports printing, and provides a double-clickable offline HTML/ZIP.
- Exposes SEO/AEO-friendly page content, schema.org metadata, a sitemap, robots.txt, methodology, FAQs and privacy pages.
- Uses Mightora's shared header, author, footer and styling online; offline branding is bundled locally.

## Build and test

No runtime npm dependencies or paid APIs are required.

```sh
npm test
npm run build
npm run verify
```

Open `dist/index.html` through a local web server to test the online edition. To run without any server, open `dist/downloads/JetRhythm-Offline.html` directly. The ZIP includes instructions, the MIT licence and third-party data notices.

## Deployment

The `pages.yml` workflow builds `dist/` and publishes it to GitHub Pages. In repository Settings → Pages choose **GitHub Actions** as the source and configure `jetrhythm.mightora.io` in the Custom domain field (the `CNAME` file by itself is ignored with Actions-based publishing). The DNS CNAME points to `mightora.github.io`.

## Flight numbers and APIs

Flight-number lookup requires a licensed source of **future scheduled flights**, not merely live aircraft positions. A provider API key must never be embedded in public JavaScript. The UI reads the `flight-lookup-url` meta tag in `src/index.html`, intentionally empty until a first-party proxy is deployed. The endpoint should return `{ "flights": [{ "number": "BA117", "from": "LHR", "to": "JFK", "departure": "2026-11-02T10:30", "arrival": "2026-11-02T14:00" }] }` with each time in the associated airport's local time zone; multiple options can be returned for codeshares or ambiguity.

An optional Cloudflare Worker proxy can handle the provider secret, rate limits and permitted short-lived caches. Since no provider key has been supplied, live lookup remains explicitly unavailable. Core planning and automatic airport time zones work without a provider, including offline.

Airport reference source: [airportsdata](https://github.com/mborsetti/airportsdata), MIT licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). To refresh the mapping, download its airports CSV and run `node scripts/generate-airports.cjs /path/to/airports.csv`.

## Scientific and safety boundaries

See [METHODOLOGY.md](METHODOLOGY.md) before changing the algorithm. The displayed phase and light windows are educational approximations, not measured circadian phase or clinically validated care. Never describe the estimated adjustment days as guaranteed recovery. Medication dosing is deliberately excluded.

## Privacy

No app analytics or advertising are active. Plan calculation stays in the browser, and save is opt-in. The online Mightora shared UI and repository badges use third-party asset hosts; see the [network transparency page](https://jetrhythm.mightora.io/network.html). Functional storage and preferences are disclosed. Review PECR/UK GDPR duties before adding any tracking or paid flight-data provider.

## Licence

MIT. Copyright © 2026 Tweed Technology Ltd. Airport mapping data carries a separate attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The scientific publications linked from the methodology are separate works and are not relicensed by this repository.
