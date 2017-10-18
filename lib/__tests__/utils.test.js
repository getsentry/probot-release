/* eslint-env jest */
/* eslint-disable global-require */

describe('filterAsync', () => {
  const { filterAsync } = require('../utils');

  test('filters with sync predicate', async () => {
    const filtered = await filterAsync([1, 2, 3, 4], i => i > 2);
    expect(filtered).toEqual([3, 4]);
  });

  test('filters with async predicate', async () => {
    const predicate = i => new Promise(resolve => setTimeout(() => resolve(i > 2), i * 100));
    const filtered = await filterAsync([1, 2, 3, 4], predicate);
    expect(filtered).toEqual([3, 4]);
  });

  test('passes filter arguments to the predicate', async () => {
    const arr = [1];
    const predicate = jest.fn();
    await filterAsync(arr, predicate);
    expect(predicate).toHaveBeenCalledWith(1, 0, arr);
  });

  test('passes this to the predicate', async () => {
    const that = {};
    expect.assertions(1);
    await filterAsync([1], function predicate() { expect(this).toBe(that); }, that);
  });
});

describe('isSorted', () => {
  const { isSorted } = require('../utils');

  const MODES = [
    { title: 'default', descending: undefined },
    { title: 'ascending', descending: false },
    { title: 'descending', descending: true },
  ];

  MODES.forEach(({ title, descending }) => describe(`sort: ${title}`, () => {
    function prepare(arr) {
      return (arr && descending) ? arr.reverse() : arr;
    }

    test('is true for empty arrays', () => {
      expect(isSorted([], descending)).toBe(true);
    });

    test('is true for a single element', () => {
      expect(isSorted([1], descending)).toBe(true);
    });

    test('verifies strict order', () => {
      const arr = prepare([1, 2, 3]);
      expect(isSorted(arr, descending)).toBe(true);
    });

    test('verifies loose order', () => {
      const arr = prepare([1, 2, 2]);
      expect(isSorted(arr, descending)).toBe(true);
    });

    test('detects disorder', () => {
      const arr = prepare([1, 2, 1]);
      expect(isSorted(arr, descending)).toBe(false);
    });

    test('works with ASCII strings', () => {
      const arr = prepare(['1', 'A', 'a']);
      expect(isSorted(arr, descending)).toBe(true);
    });

    test('returns false for elements with wrong types', () => {
      const arr = prepare([1, {}, 3]);
      expect(isSorted(arr, descending)).toBe(false);
    });

    test('returns false for null elements', () => {
      const arr = prepare([1, null, 3]);
      expect(isSorted(arr, descending)).toBe(false);
    });

    test('returns false for undefined elements', () => {
      const arr = prepare([1, undefined, 3]);
      expect(isSorted(arr, descending)).toBe(false);
    });
  }));
});

describe('cloneContext', () => {
  const { cloneContext } = require('../utils');
  const Context = require('../__mocks__/context');

  test('sets the correct constructor', () => {
    const clone = cloneContext(new Context());
    expect(clone.constructor).toBe(Context);
  });

  test('sets the correct prototype', () => {
    const clone = cloneContext(new Context({ owner: 'foo', repo: 'bar' }));
    expect(clone.repo()).toEqual({ owner: 'foo', repo: 'bar' });
  });

  test('creates a new instance', () => {
    const context = new Context();
    const clone = cloneContext(context);
    expect(clone).not.toBe(context);
  });

  test('clones default properties', () => {
    const context = new Context();
    const clone = cloneContext(context);
    expect(clone).toEqual(context);
  });

  test('clones additional properties', () => {
    const context = new Context();
    context.additional = 'property';
    const clone = cloneContext(context);
    expect(clone).toEqual(context);
  });

  test('clones a context with additional properties', () => {
    const clone = cloneContext(new Context(), { foo: 'bar' });
    expect(clone.constructor).toBe(Context);
    expect(clone.foo).toBe('bar');
  });

  test('overrides existing attributes', () => {
    const clone = cloneContext(new Context(), { payload: { a: 1 } });
    expect(clone.constructor).toBe(Context);
    expect(clone.payload).toEqual({ a: 1 });
  });
});

describe('spawn', () => {
  const { spawn } = require('../utils');

  test('resolves on success', async () => {
    expect.assertions(1);
    await spawn('test', ['1']);
    expect(true).toBe(true);
  });

  test('rejects on non-zero exit code', async () => {
    try {
      expect.assertions(2);
      await spawn('test', ['']);
    } catch (e) {
      expect(e.code).toBe(1);
      expect(e.message).toMatch(/code 1/);
    }
  });

  test('rejects on error', async () => {
    try {
      expect.assertions(1);
      await spawn('this_command_does_not_exist');
    } catch (e) {
      expect(e.message).toMatch(/ENOENT/);
    }
  });

  test('rejects and print args with options', async () => {
    try {
      expect.assertions(3);
      await spawn('test', ['x'], { cwd: 'file://yo.js' });
    } catch (e) {
      expect(e.message).toMatch(/ENOENT/);
      expect(e.message).toMatch(/args: x/);
      expect(e.message).toMatch(/file:\/\/yo.js/);
    }
  });

  test('rejects and strip env from options', async () => {
    try {
      expect.assertions(1);
      await spawn('test', [''], { env: { x: 123, password: 456 } });
    } catch (e) {
      expect(e.message).toMatch(/"envVars":\["x","password"\]/);
    }
  });
});
