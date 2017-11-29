/* eslint-env jest */

const { getVersion } = require('../version');

test('extracts a basic SemVer versions', () => {
  expect(getVersion('1.0.0')).toBe('1.0.0');
});

test('extracts a SemVer version with leading "v"', () => {
  expect(getVersion('v1.0.0')).toBe('1.0.0');
});

test('extracts a SemVer version from text', () => {
  expect(getVersion('1.0.0 (foobar)')).toBe('1.0.0');
});
