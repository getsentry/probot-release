/* eslint-env jest */

// TODO(ja): Update to jest v21.3.0 once released:
//            - use expect(promise).rejects.toThrow()
//            - use expect(jest.fn).toMatchSnapshot()

const fetch = require('node-fetch');
const request = require('../request');

const mockPromise = (value, reason) =>
  new Promise((resolve, reject) => {
    setImmediate(() => (reason ? reject(reason) : resolve(value)));
  });

function mockFetch(status, json, statusText) {
  const ok = status >= 200 && status <= 300;
  fetch.mockReturnValue(mockPromise({ status, ok, json, statusText }));
}

describe('request', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  test('passes all parameters to fetch', async () => {
    expect.assertions(1);
    mockFetch(200, () => mockPromise());

    await request('http://example.org', {
      method: 'POST',
      headers: { Authorization: 'bearer yo!' },
    });

    expect(fetch.mock.calls[0]).toMatchSnapshot();
  });

  test('allows Accept header overrides', async () => {
    expect.assertions(1);
    mockFetch(200, () => mockPromise());

    await request('http://example.org', {
      headers: { Accept: 'text/html' },
    });

    expect(fetch.mock.calls[0]).toMatchSnapshot();
  });

  test('resolves the parsed JSON result for status 200', async () => {
    expect.assertions(1);
    mockFetch(200, () => mockPromise({ foo: 'bar' }));
    const result = await request('http://example.org');
    expect(result).toEqual({ foo: 'bar' });
  });

  test('resolves undefined for status 204', async () => {
    expect.assertions(1);
    mockFetch(204, () => {
      throw new Error('should not be called');
    });

    const result = await request('http://example.org');
    expect(result).toBeUndefined();
  });

  test('throws an error containing the status text', async () => {
    expect.assertions(1);
    mockFetch(400, () => mockPromise(null, 'empty'), 'BAD REQUEST');

    try {
      await request('http://example.org');
    } catch (e) {
      expect(e.message).toBe('400 BAD REQUEST');
    }
  });

  test('throws an error containing the resolved error message', async () => {
    expect.assertions(1);
    const message = 'Error message';
    mockFetch(400, () => mockPromise({ message }));

    try {
      await request('http://example.org');
    } catch (e) {
      expect(e.message).toBe(message);
    }
  });

  test('falls back to the status text when parsing errors', async () => {
    expect.assertions(1);
    mockFetch(400, () => mockPromise({}), 'BAD REQUEST');

    try {
      await request('http://example.org');
    } catch (e) {
      expect(e.message).toBe('400 BAD REQUEST');
    }
  });
});
