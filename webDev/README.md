# WayWithYou Search (webDev)

Search page for WayWithYou registrants by **state** (2-letter abbreviation) and **origination/destination city**. Search is **case insensitive** (e.g. `ny` returns results where state is `NY`).

## Run the dev server

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

## Design

- STOA-aligned UX/UI: simple hierarchy, clear primary action, logo-aligned color scheme (blue, orange, dark hero).
- Data is read from `data/riders.json` (same format as the Django project’s `rides/fixtures/riders.json`).

## Logo

- The WayWithYou logo is in `public/logo.png`.
