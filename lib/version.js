const semverRegex = require('semver-regex');

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

module.exports = {
  getVersion,
};
