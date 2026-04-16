/**
 * holidays.rest JavaScript SDK
 * https://docs.holidays.rest
 */

/**
 * Holiday name keyed by language code.
 * @typedef {Object.<string, string>} HolidayName
 */

/**
 * Day-of-week information for a holiday.
 * @typedef {Object} HolidayDay
 * @property {string} actual   - Day of week the holiday falls on (e.g. "Thursday")
 * @property {string} observed - Day of week the holiday is observed (may differ for substitution days)
 */

/**
 * A single holiday entry returned by the API.
 * @typedef {Object} Holiday
 * @property {string}      country_code - ISO 3166 alpha-2 country code (e.g. "DE")
 * @property {string}      country_name - Full country name (e.g. "Germany")
 * @property {string}      date         - ISO 8601 date string (e.g. "2026-01-01")
 * @property {HolidayName} name         - Holiday name keyed by language code (e.g. { en: "New Year's Day" })
 * @property {boolean}     isNational   - True if this is a national public holiday
 * @property {boolean}     isReligious  - True if this is a religious observance
 * @property {boolean}     isLocal      - True if this is a local or regional holiday
 * @property {boolean}     isEstimate   - True if the date is an estimate (e.g. lunar-based holidays)
 * @property {HolidayDay}  day          - Actual and observed day-of-week info
 * @property {string}      religion     - Religion name (e.g. "Christianity") or empty string
 * @property {string[]}    regions      - Region/subdivision codes where this holiday applies (empty = nationwide)
 */

const BASE_URL = 'https://api.holidays.rest/v1';

export class HolidaysApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'HolidaysApiError';
    this.status = status;
    this.body = body;
  }
}

export class HolidaysClient {
  /**
   * @param {object} options
   * @param {string} options.apiKey  - Bearer token from https://www.holidays.rest/dashboard
   * @param {string} [options.baseUrl] - Override base URL (useful for testing)
   */
  constructor({ apiKey, baseUrl = BASE_URL } = {}) {
    if (!apiKey) throw new Error('HolidaysClient: apiKey is required');
    this._apiKey = apiKey;
    this._baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ─── internal ────────────────────────────────────────────────────────────

  async _request(path, params = {}) {
    const url = new URL(`${this._baseUrl}${path}`);

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      // Support arrays as comma-separated values
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this._apiKey}`,
        Accept: 'application/json',
      },
    });

    let body;
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    if (!response.ok) {
      const message = (typeof body === 'object' && body?.message) || response.statusText;
      throw new HolidaysApiError(message, response.status, body);
    }

    return body;
  }

  // ─── public API ──────────────────────────────────────────────────────────

  /**
   * Fetch holidays for a country and year.
   *
   * @param {object} params
   * @param {string}           params.country   - ISO 3166 alpha-2 code (e.g. "US")
   * @param {number|string}    params.year      - Four-digit year (e.g. 2024)
   * @param {number|string}   [params.month]    - 1–12
   * @param {number|string}   [params.day]      - 1–31
   * @param {string|string[]} [params.type]     - "religious" | "national" | "local"
   * @param {string|string[]} [params.religion] - Religion name(s) (e.g. "Christianity", "Islam")
   * @param {string|string[]} [params.region]   - Region/subdivision code(s)
   * @param {string|string[]} [params.lang]     - Language code(s)
   * @param {string}          [params.response] - "json" | "xml" | "yaml" | "csv" (default: "json")
   * @returns {Promise<Holiday[]>}
   */
  holidays({ country, year, month, day, type, religion, region, lang, response } = {}) {
    if (!country) throw new Error('holidays(): country is required');
    if (!year) throw new Error('holidays(): year is required');
    return this._request('/holidays', { country, year, month, day, type, religion, region, lang, response });
  }

  /**
   * List all supported countries.
   * @returns {Promise<any>}
   */
  countries() {
    return this._request('/countries');
  }

  /**
   * Get details for a specific country (includes region/subdivision codes).
   * @param {string} countryCode - ISO 3166 alpha-2 code (e.g. "US")
   * @returns {Promise<any>}
   */
  country(countryCode) {
    if (!countryCode) throw new Error('country(): countryCode is required');
    return this._request(`/country/${encodeURIComponent(countryCode)}`);
  }

  /**
   * List all supported language codes.
   * @returns {Promise<any>}
   */
  languages() {
    return this._request('/languages');
  }
}

export default HolidaysClient;
