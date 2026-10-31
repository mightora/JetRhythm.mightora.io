# JetRhythm by Mightora

**Arrive in sync.** JetRhythm is an independently developed, open-source, privacy-first jet lag and body-clock planner.

Website: [jetrhythm.mightora.io](https://jetrhythm.mightora.io/) · [Model methodology](METHODOLOGY.md)

## What it does

- Plans journeys with up to eight flights, including local airport times and daylight-saving transitions.
- Lets users enter and save flight numbers (for identification; no live lookup or API is enabled).
- Estimates biological waking, gradual time-zone adjustment, light-seeking and light-avoidance windows.
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

Open `dist/index.html` through a local web server to test the online edition. To run without any server, open `dist/downloads/JetRhythm-Offline.html` directly. The ZIP includes instructions and a copy of the MIT licence.

## Deployment

The `pages.yml` workflow builds `dist/` and publishes it to GitHub Pages. In repository Settings → Pages choose **GitHub Actions** as the source. The custom hostname is declared in `src/CNAME` and needs a DNS CNAME to `mightora.github.io` for GitHub Pages.

## Flight numbers and APIs

Flight numbers are optional labels only. There is no live flight-status integration because a secure provider API key must not be embedded in public JavaScript. A future optional Cloudflare Worker proxy can handle authorised server-side flight-data lookups, rate limits and short-lived caches. Core planning must remain functional without it.

## Scientific and safety boundaries

See [METHODOLOGY.md](METHODOLOGY.md) before changing the algorithm. The displayed phase and light windows are educational approximations, not measured circadian phase or clinically validated care. Never describe the estimated adjustment days as guaranteed recovery. Medication dosing is deliberately excluded.

## Privacy

No app analytics or advertising are active. Plan calculation stays in the browser, and save is opt-in. The online Mightora shared UI and repository badges use third-party asset hosts; see the [network transparency page](https://jetrhythm.mightora.io/network.html). Functional storage and preferences are disclosed. Review PECR/UK GDPR duties before adding any tracking or paid flight-data provider.

## Licence

MIT. Copyright © 2026 Tweed Technology Ltd. The scientific publications linked from the methodology are separate works and are not relicensed by this repository.
