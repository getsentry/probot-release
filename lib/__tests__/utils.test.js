/* eslint-env jest */
/* eslint-disable global-require */

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
