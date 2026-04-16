/**
 * holidays.rest JavaScript SDK
 * https://docs.holidays.rest
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
   * @param {number|number[]} [params.religion] - Religion code(s) 1–11
   * @param {string|string[]} [params.region]   - Region/subdivision code(s)
   * @param {string|string[]} [params.lang]     - Language code(s)
   * @param {string}          [params.response] - "json" | "xml" | "yaml" | "csv" (default: "json")
   * @returns {Promise<any>}
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
