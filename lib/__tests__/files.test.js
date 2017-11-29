/* eslint-env jest */
/* eslint-disable global-require */

describe('listFiles', () => {
  const { listFiles } = require('../files');
  const { join, resolve } = require('path');
  const testDir = resolve(__dirname, '../__fixtures__/listFiles');
  const testFiles = ['a', 'b'].map(f => join(testDir, f));

  test('returns only files', async () => {
    expect.assertions(1);
    const files = await listFiles(testDir);
    expect(files).toEqual(testFiles);
  });
});

describe('withTempDir', () => {
  const { existsSync } = require('fs');
  const { withTempDir } = require('../files');

  async function testDirectories(callback) {
    let directory = null;

    try {
      await withTempDir(dir => {
        directory = dir;
        expect(existsSync(directory)).toBeTruthy();
        return callback(directory);
      });
    } finally {
      expect(existsSync(directory)).toBeFalsy();
    }
  }

  test('creates and removes synchronously', async () => {
    expect.assertions(2);
    await testDirectories(() => {});
  });

  test('creates and removes on error', async () => {
    try {
      expect.assertions(3);
      await testDirectories(() => {
        throw new Error('fail');
      });
    } catch (e) {
      expect(e.message).toBe('fail');
    }
  });

  test('creates and removes on Promise resolution', async () => {
    expect.assertions(2);
    await testDirectories(() => Promise.resolve('success'));
  });

  test('creates and removes on Promise rejection', async () => {
    try {
      expect.assertions(3);
      await testDirectories(() => Promise.reject(new Error('fail')));
    } catch (e) {
      expect(e.message).toBe('fail');
    }
  });

  test('returns the callback return value synchronously', async () => {
    expect.assertions(1);
    const result = await withTempDir(() => 'result');
    expect(result).toBe('result');
  });

  test('returns the callback return value asynchronously', async () => {
    expect.assertions(1);
    const result = await withTempDir(() => Promise.resolve('result'));
    expect(result).toBe('result');
  });
});
