/* eslint-env jest */

const { parseVersion } = require('../version');

test('parses basic semver versions', () => {
  expect(parseVersion('1.0.0')).toBe('1.0.0');
});

test('parses semver version with leading "v"', () => {
  expect(parseVersion('v1.0.0')).toBe('1.0.0');
});

test('extracts semver version from text', () => {
  expect(parseVersion('1.0.0 (foobar)')).toBe('1.0.0');
});
