/* eslint-env jest */
/* global fail */

const tryRequire = require('try-require');
const { cloneContext } = require('../../utils');
const runTarget = require('../index');

jest.mock('../../utils');

beforeEach(() => {
  jest.clearAllMocks();
});

test('requires a target of the same name', async () => {
  const targetFn = jest.fn();
  tryRequire.mockReturnValue(targetFn);

  expect.assertions(1);
  await runTarget('name');
  expect(tryRequire).toHaveBeenCalledWith('./name', expect.anything());
});

test('requires a target of the same name from config', async () => {
  const targetFn = jest.fn();
  tryRequire.mockReturnValue(targetFn);

  expect.assertions(1);
  await runTarget({ name: 'name' });
  expect(tryRequire).toHaveBeenCalledWith('./name', expect.anything());
});

test('rejects when target config is missing', () => {
  tryRequire.mockImplementation(() => fail('Not allowed'));

  const err = new Error('Missing target specification');
  return expect(runTarget(null)).rejects.toEqual(err);
});

test('rejects when target name is missing', () => {
  tryRequire.mockImplementation(() => fail('Not allowed'));

  const err = new Error('Missing target specification');
  return expect(runTarget({})).rejects.toEqual(err);
});

test('rejects empty target name', () => {
  tryRequire.mockImplementation(() => fail('Not allowed'));

  const err = new Error('Missing target specification');
  return expect(runTarget('')).rejects.toEqual(err);
});

test('rejects unknown targets', () => {
  tryRequire.mockReturnValue(null);
  const err = new Error('Unknown deploy target "name"');
  return expect(runTarget('name')).rejects.toEqual(err);
});

test('creates a release context', async () => {
  const targetFn = jest.fn();
  tryRequire.mockReturnValue(targetFn);

  const config = { name: 'name' };
  const context = { context: true };
  const tag = { tag: true };
  const store = { store: true };
  const logger = { logger: true };

  expect.assertions(1);
  await runTarget(config, context, tag, store, logger);
  expect(cloneContext).lastCalledWith(context, {
    config,
    tag,
    logger,
    store,
  });
});

test('invokes the target function', async () => {
  const targetFn = jest.fn();
  tryRequire.mockReturnValue(targetFn);

  const clonedContext = { context: 'cloned' };
  cloneContext.mockReturnValue(clonedContext);

  expect.assertions(1);
  await runTarget('name');
  expect(targetFn).lastCalledWith(clonedContext);
});
