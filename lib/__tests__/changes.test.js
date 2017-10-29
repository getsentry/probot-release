/* eslint-env jest */

const { findChangeset, parseVersion } = require('../changes');

test('parse basic semver versions', () => {
  expect(parseVersion('1.0.0')).toBe('1.0.0');
});

test('parse semver version with leading "v"', () => {
  expect(parseVersion('v1.0.0')).toBe('1.0.0');
});

test('extracts semver version from text', () => {
  expect(parseVersion('1.0.0 (foobar)')).toBe('1.0.0');
});

test('extracts a single change', () => {
  const name = 'Version 1.0.0';
  const body = 'this is a test';
  const markdown = `# Changelog\n## ${name}\n${body}\n`;
  const changes = findChangeset(markdown, 'v1.0.0');
  expect(changes).toEqual({ name, body });
});

test('extracts a change between headings', () => {
  const name = 'Version 1.0.0';
  const body = 'this is a test';

  const markdown = `# Changelog
  ## 1.0.1
  newer

  ## ${name}
  ${body}

  ## 0.9.0
  older
  `;

  const changes = findChangeset(markdown, 'v1.0.0');
  expect(changes).toEqual({ name, body });
});

test('extracts changes from underlined headings', () => {
  const name = 'Version 1.0.0';
  const body = 'this is a test';
  const markdown = `Changelog\n====\n${name}\n----\n${body}\n`;
  const changes = findChangeset(markdown, 'v1.0.0');
  expect(changes).toEqual({ name, body });
});

test('extracts changes from alternating headings', () => {
  const name = 'Version 1.0.0';
  const body = 'this is a test';

  const markdown = `# Changelog
  ## 1.0.1
  newer

  ${name}
  -------
  ${body}

  ## 0.9.0
  older
  `;

  const changes = findChangeset(markdown, 'v1.0.0');
  expect(changes).toEqual({ name, body });
});
