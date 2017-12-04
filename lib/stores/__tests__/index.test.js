/* eslint-env jest */
/* global fail */

const tryRequire = require('try-require');
const createStore = require('../index');

beforeEach(() => {
  jest.restoreAllMocks();
});

test('invokes the store function', () => {
  const storeFn = jest.fn();
  tryRequire.mockReturnValue(storeFn);

  const commit = { owner: 'owner', repo: 'repo', sha: 'feedface' };
  const logger = { debug: true };
  createStore('type', commit, '/some/path', logger);

  expect(storeFn).toHaveBeenCalledWith(commit, '/some/path', logger);
});

test('returns the created store', () => {
  const store = {};
  const storeFn = jest.fn().mockReturnValue(store);
  tryRequire.mockReturnValue(storeFn);

  const result = createStore('type');
  expect(result).toBe(store);
});

test('throws for unknown stores', () => {
  tryRequire.mockReturnValue(null);
  expect(() => createStore('type')).toThrow(/unknown store/i);
});

test('throws when store type is missing', () => {
  tryRequire.mockImplementation(() => fail('Not allowed'));
  expect(() => createStore('')).toThrow(/invalid store type/i);
});

test('throws for a store called "index"', () => {
  tryRequire.mockImplementation(() => fail('Not allowed'));
  expect(() => createStore('index')).toThrow(/invalid store type/i);
});

test('defaults to the console as logger', () => {
  const storeFn = jest.fn();
  tryRequire.mockReturnValue(storeFn);

  const commit = { owner: 'owner', repo: 'repo', sha: 'feedface' };
  createStore('type', commit, '/some/path');

  expect(storeFn).toHaveBeenCalledWith(commit, '/some/path', console);
});
