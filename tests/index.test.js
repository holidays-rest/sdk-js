import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HolidaysClient, HolidaysApiError } from '../index.js';

const HOLIDAY_NATIONAL = {
  country_code: 'DE',
  country_name: 'Germany',
  date: '2026-01-01',
  name: { en: "New Year's Day" },
  isNational: true,
  isReligious: false,
  isLocal: false,
  isEstimate: false,
  day: { actual: 'Thursday', observed: 'Thursday' },
  religion: '',
  regions: [],
};

const HOLIDAY_RELIGIOUS_LOCAL = {
  country_code: 'DE',
  country_name: 'Germany',
  date: '2026-01-06',
  name: { en: 'Epiphany' },
  isNational: false,
  isReligious: true,
  isLocal: true,
  isEstimate: false,
  day: { actual: 'Tuesday', observed: 'Tuesday' },
  religion: 'Christianity',
  regions: ['BW', 'BY', 'ST'],
};

const HOLIDAYS_FIXTURE = [HOLIDAY_NATIONAL, HOLIDAY_RELIGIOUS_LOCAL];

function mockFetch(status, body, contentType = 'application/json') {
  return vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
      headers: { get: (h) => (h === 'content-type' ? contentType : null) },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    }),
  );
}

// ─── HolidaysApiError ────────────────────────────────────────────────────────

describe('HolidaysApiError', () => {
  it('extends Error', () => {
    const err = new HolidaysApiError('msg', 404, {});
    expect(err instanceof Error).toBe(true);
  });

  it('sets name, message, status, body', () => {
    const body = { error: true };
    const err = new HolidaysApiError('Not Found', 404, body);
    expect(err.name).toBe('HolidaysApiError');
    expect(err.message).toBe('Not Found');
    expect(err.status).toBe(404);
    expect(err.body).toBe(body);
  });
});

// ─── HolidaysClient constructor ──────────────────────────────────────────────

describe('HolidaysClient constructor', () => {
  it('throws when apiKey omitted', () => {
    expect(() => new HolidaysClient()).toThrow('apiKey is required');
  });

  it('throws when apiKey is empty string', () => {
    expect(() => new HolidaysClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('stores apiKey', () => {
    const client = new HolidaysClient({ apiKey: 'my-key' });
    expect(client._apiKey).toBe('my-key');
  });

  it('uses default base URL', () => {
    const client = new HolidaysClient({ apiKey: 'key' });
    expect(client._baseUrl).toBe('https://api.holidays.rest/v1');
  });

  it('strips trailing slash from custom baseUrl', () => {
    const client = new HolidaysClient({ apiKey: 'key', baseUrl: 'https://example.com/' });
    expect(client._baseUrl).toBe('https://example.com');
  });

  it('accepts custom baseUrl without slash', () => {
    const client = new HolidaysClient({ apiKey: 'key', baseUrl: 'https://example.com' });
    expect(client._baseUrl).toBe('https://example.com');
  });
});

// ─── HolidaysClient._request ─────────────────────────────────────────────────

describe('HolidaysClient._request', () => {
  let client;

  beforeEach(() => {
    client = new HolidaysClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends GET request with Authorization header', async () => {
    mockFetch(200, []);
    await client._request('/holidays', {});
    const [, opts] = fetch.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe('Bearer test-key');
  });

  it('sends Accept: application/json header', async () => {
    mockFetch(200, []);
    await client._request('/holidays', {});
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers.Accept).toBe('application/json');
  });

  it('appends string query params to URL', async () => {
    mockFetch(200, []);
    await client._request('/holidays', { country: 'US', year: '2024' });
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('country=US');
    expect(url).toContain('year=2024');
  });

  it('skips null params', async () => {
    mockFetch(200, []);
    await client._request('/holidays', { country: 'US', month: null });
    const [url] = fetch.mock.calls[0];
    expect(url).not.toContain('month');
  });

  it('skips undefined params', async () => {
    mockFetch(200, []);
    await client._request('/holidays', { country: 'US', day: undefined });
    const [url] = fetch.mock.calls[0];
    expect(url).not.toContain('day=');
  });

  it('joins array params as comma-separated values', async () => {
    mockFetch(200, []);
    await client._request('/holidays', { type: ['religious', 'national'] });
    const [url] = fetch.mock.calls[0];
    expect(decodeURIComponent(url)).toContain('type=religious,national');
  });

  it('returns parsed JSON body on success', async () => {
    mockFetch(200, { data: 'ok' });
    const result = await client._request('/holidays', {});
    expect(result).toEqual({ data: 'ok' });
  });

  it('returns text body when content-type is not JSON', async () => {
    mockFetch(200, 'plain response', 'text/plain');
    const result = await client._request('/holidays', {});
    expect(result).toBe('plain response');
  });

  it('throws HolidaysApiError on non-ok response', async () => {
    mockFetch(404, { message: 'Not Found' });
    await expect(client._request('/missing')).rejects.toThrow(HolidaysApiError);
  });

  it('uses body.message as error message', async () => {
    mockFetch(422, { message: 'Invalid country code' });
    await expect(client._request('/holidays', {})).rejects.toMatchObject({
      message: 'Invalid country code',
      status: 422,
    });
  });

  it('falls back to statusText when body has no message', async () => {
    mockFetch(500, {});
    await expect(client._request('/holidays', {})).rejects.toMatchObject({
      status: 500,
      name: 'HolidaysApiError',
    });
  });

  it('attaches raw body to thrown error', async () => {
    const body = { message: 'oops', detail: 'extra' };
    mockFetch(400, body);
    await expect(client._request('/holidays', {})).rejects.toMatchObject({ body });
  });
});

// ─── holidays() ──────────────────────────────────────────────────────────────

describe('HolidaysClient.holidays', () => {
  let client;

  beforeEach(() => {
    client = new HolidaysClient({ apiKey: 'key', baseUrl: 'https://api.example.com' });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('throws when country missing', () => {
    expect(() => client.holidays({ year: 2024 })).toThrow('country is required');
  });

  it('throws when year missing', () => {
    expect(() => client.holidays({ country: 'US' })).toThrow('year is required');
  });

  it('throws when called with no args', () => {
    expect(() => client.holidays()).toThrow();
  });

  it('calls /holidays endpoint', async () => {
    mockFetch(200, HOLIDAYS_FIXTURE);
    await client.holidays({ country: 'DE', year: 2026 });
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/holidays');
  });

  it('returns array of holiday objects', async () => {
    mockFetch(200, HOLIDAYS_FIXTURE);
    const result = await client.holidays({ country: 'DE', year: 2026 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('holiday has expected shape', async () => {
    mockFetch(200, HOLIDAYS_FIXTURE);
    const [holiday] = await client.holidays({ country: 'DE', year: 2026 });
    expect(holiday).toMatchObject({
      country_code: 'DE',
      country_name: 'Germany',
      date: '2026-01-01',
      name: { en: "New Year's Day" },
      isNational: true,
      isReligious: false,
      isLocal: false,
      isEstimate: false,
      day: { actual: 'Thursday', observed: 'Thursday' },
      religion: '',
      regions: [],
    });
  });

  it('religious local holiday has religion string and regions array', async () => {
    mockFetch(200, HOLIDAYS_FIXTURE);
    const result = await client.holidays({ country: 'DE', year: 2026 });
    const epiphany = result[1];
    expect(epiphany.religion).toBe('Christianity');
    expect(epiphany.regions).toEqual(['BW', 'BY', 'ST']);
    expect(epiphany.isReligious).toBe(true);
    expect(epiphany.isLocal).toBe(true);
    expect(epiphany.isNational).toBe(false);
  });

  it('passes all optional params', async () => {
    mockFetch(200, HOLIDAYS_FIXTURE);
    await client.holidays({
      country: 'DE',
      year: 2026,
      month: 1,
      day: 6,
      type: 'religious',
      religion: 'Christianity',
      region: 'BW',
      lang: 'en',
      response: 'json',
    });
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('month=1');
    expect(url).toContain('day=6');
    expect(url).toContain('type=religious');
    expect(url).toContain('religion=Christianity');
    expect(url).toContain('region=BW');
    expect(url).toContain('lang=en');
  });

  it('passes religion as comma-separated string when array given', async () => {
    mockFetch(200, HOLIDAYS_FIXTURE);
    await client.holidays({ country: 'DE', year: 2026, religion: ['Christianity', 'Islam'] });
    const [url] = fetch.mock.calls[0];
    expect(decodeURIComponent(url)).toContain('religion=Christianity,Islam');
  });
});

// ─── countries() ─────────────────────────────────────────────────────────────

describe('HolidaysClient.countries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls /countries endpoint', async () => {
    const client = new HolidaysClient({ apiKey: 'key', baseUrl: 'https://api.example.com' });
    mockFetch(200, []);
    await client.countries();
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/countries');
  });
});

// ─── country() ───────────────────────────────────────────────────────────────

describe('HolidaysClient.country', () => {
  let client;

  beforeEach(() => {
    client = new HolidaysClient({ apiKey: 'key', baseUrl: 'https://api.example.com' });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('throws when countryCode missing', () => {
    expect(() => client.country()).toThrow('countryCode is required');
  });

  it('throws when countryCode is empty string', () => {
    expect(() => client.country('')).toThrow('countryCode is required');
  });

  it('calls /country/:code', async () => {
    mockFetch(200, {});
    await client.country('US');
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/country/US');
  });

  it('URL-encodes the country code', async () => {
    mockFetch(200, {});
    await client.country('US/extra');
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('US%2Fextra');
  });
});

// ─── languages() ─────────────────────────────────────────────────────────────

describe('HolidaysClient.languages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls /languages endpoint', async () => {
    const client = new HolidaysClient({ apiKey: 'key', baseUrl: 'https://api.example.com' });
    mockFetch(200, []);
    await client.languages();
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/languages');
  });
});
