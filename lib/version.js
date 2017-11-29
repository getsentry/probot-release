/**
 * Regular expression for matching semver versions
 *
 * Modified to match version components
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
 * @see https://github.com/sindresorhus/semver-regex
 */
const semverRegex = () =>
  /\bv?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([\da-z-]+(?:\.[\da-z-]+)*))?(?:\+([\da-z-]+(?:\.[\da-z-]+)*))?\b/gi;

/**
 * Extracts a version number from the given text
 *
 * In case the version contains a leading "v", it is stripped from the result.
 * All semantic versions are supported. See {@link http://semver.org/} for
 * more information.
 *
 * @param {string} text Some text containing a version
 * @returns {string} The extracted version or null
 */
function getVersion(text) {
  const matches = semverRegex().exec(text);
  const version = matches && matches[0];
  return version && version[0].toLowerCase() === 'v'
    ? version.substr(1)
    : version;
}

/**
 * @typedef {object} SemVer Parsed semantic version
 *
 * @prop {number} major The major version number
 * @prop {number} minor The minor version number
 * @prop {number} patch The patch version number
 * @prop {string?} pre Optional pre-release specifier
 * @prop {string?} build Optional build metadata
 */

/**
 * Parses a version number from the given text
 *
 * @param {string} text Some text containing a version
 * @returns {SemVer?} The parsed version or null
 */
function parseVersion(text) {
  const matches = semverRegex().exec(text);
  return (
    matches && {
      major: parseInt(matches[1], 10),
      minor: parseInt(matches[2], 10),
      patch: parseInt(matches[3], 10),
      pre: matches[4],
      build: matches[5],
    }
  );
}

module.exports = {
  getVersion,
  parseVersion,
};
