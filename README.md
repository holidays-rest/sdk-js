# holidays.rest JavaScript SDK

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/f7388d86cf3141c7bf32b9aa5edd1af7)](https://app.codacy.com/gh/holidays-rest/sdk-js/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

Official JavaScript SDK for the [holidays.rest](https://holidays.rest) API.

## Requirements

- Node.js ≥ 18 (uses native `fetch` — no dependencies)

## Installation

```bash
npm install holidays.rest
```

## Quick Start

```js
import HolidaysClient from 'holidays.rest';

const client = new HolidaysClient({ apiKey: 'YOUR_API_KEY' });

const holidays = await client.holidays({ country: 'US', year: 2024 });
console.log(holidays);
```

Get an API key at [holidays.rest/dashboard](https://www.holidays.rest/dashboard).

---

## API

### `new HolidaysClient(options)`

| Option    | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `apiKey`  | string | yes      | Bearer token from dashboard  |
| `baseUrl` | string | no       | Override base URL (for tests)|

---

### `client.holidays(params)` → `Promise`

Fetch public holidays for a country and year.

| Param      | Type               | Required | Description                                      |
|------------|--------------------|----------|--------------------------------------------------|
| `country`  | string             | yes      | ISO 3166 alpha-2 code (e.g. `"US"`)              |
| `year`     | number \| string   | yes      | Four-digit year (e.g. `2024`)                    |
| `month`    | number \| string   | no       | Month filter (1–12)                              |
| `day`      | number \| string   | no       | Day filter (1–31)                                |
| `type`     | string \| string[] | no       | `"religious"`, `"national"`, `"local"`           |
| `religion` | string \| string[] | no       | Religion name(s) (e.g. `"Christianity"`, `"Islam"`) |
| `region`   | string \| string[] | no       | Region/subdivision code(s) — see `client.country()`|
| `lang`     | string \| string[] | no       | Language code(s) — see `client.languages()`      |
| `response` | string             | no       | `"json"` (default) \| `"xml"` \| `"yaml"` \| `"csv"` |

```js
// All US holidays in 2024
await client.holidays({ country: 'US', year: 2024 });

// National holidays only
await client.holidays({ country: 'DE', year: 2024, type: 'national' });

// Multiple types
await client.holidays({ country: 'TR', year: 2024, type: ['national', 'religious'] });

// Filter by month and day
await client.holidays({ country: 'GB', year: 2024, month: 12, day: 25 });

// Specific region
await client.holidays({ country: 'US', year: 2024, region: 'US-CA' });

// Get CSV format
await client.holidays({ country: 'US', year: 2024, response: 'csv' });
```

**Response shape** (each item in the returned array):

```js
{
  country_code: "DE",           // ISO 3166 alpha-2
  country_name: "Germany",
  date: "2026-01-01",           // ISO 8601
  name: { en: "New Year's Day" },  // keyed by language code
  isNational: true,
  isReligious: false,
  isLocal: false,
  isEstimate: false,
  day: {
    actual: "Thursday",         // day the holiday falls on
    observed: "Thursday"        // day it is observed (may differ)
  },
  religion: "",                 // e.g. "Christianity", or "" if not religious
  regions: []                   // subdivision codes; empty means nationwide
}
```

---

### `client.countries()` → `Promise`

List all supported countries with their alpha-2 codes.

```js
const countries = await client.countries();
```

---

### `client.country(countryCode)` → `Promise`

Get details for a specific country, including available region/subdivision codes.

```js
const us = await client.country('US');
// us.subdivisions → list of region codes usable in holidays()
```

---

### `client.languages()` → `Promise`

List all supported language codes.

```js
const langs = await client.languages();
```

---

## Error Handling

Failed requests throw `HolidaysApiError`:

```js
import HolidaysClient, { HolidaysApiError } from 'holidays.rest';

try {
  await client.holidays({ country: 'US', year: 2024 });
} catch (err) {
  if (err instanceof HolidaysApiError) {
    console.error(err.status);  // HTTP status code
    console.error(err.message); // Error message
    console.error(err.body);    // Raw response body
  }
}
```

| Status | Meaning              |
|--------|----------------------|
| 400    | Bad request          |
| 401    | Invalid API key      |
| 404    | Not found            |
| 500    | Server error         |
| 503    | Service unavailable  |

---

## License

MIT
