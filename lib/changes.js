const semverRegex = require('semver-regex');

/**
 * Parses a version number from the given text
 *
 * In case the version contains a leading "v", it is stripped from the result.
 * All semantic versions are supported. See {@link http://semver.org/} for
 * more information.
 *
 * @param {string} text Some text containing a version
 * @returns {string} The parsed version or null
 */
function parseVersion(text) {
  const matches = semverRegex().exec(text);
  const version = matches && matches[0];
  return (version && version[0].toLowerCase() === 'v')
    ? version.substr(1)
    : version;
}

/**
 * A single changeset with name and description
 *
 * @typedef {object} Changeset
 * @prop {string} name The name of this changeset
 * @prop {string} body The markdown body describing the changeset
 */

/**
 * Extracts a specific changeset from a markdown document
 *
 * The changes are bounded by a header preceding the changes and an optional
 * header at the end. If the latter is omitted, the markdown document will be
 * reat until its end. The title of the changes will be extracted from the
 * given header.
 *
 * @param {string} markdown The full changelog markdown
 * @param {RegExpExecArray} header The header of the section to extract
 * @param {RegExpExecArray?} nextHeader An optional header of the next section
 * @returns {Changeset} The extracted changes
 */
function extractChangeset(markdown, header, nextHeader = null) {
  const start = header.index + header[0].length;
  const end = nextHeader ? nextHeader.index : undefined;
  const body = markdown.substring(start, end).trim();
  return { name: header[1], body };
}

/**
 * Searches for a changeset within the given markdown
 *
 * @param {string} markdown The markdown containing the changeset
 * @param {string} tag A git tag containing a version number
 * @returns {Changeset?} The changeset if found; otherwise null
 */
function findChangeset(markdown, tag) {
  const version = parseVersion(tag);
  if (version == null) {
    return null;
  }

  const regex = /^ *## *([^\n]+?) *#* *(?:\n+|$)/gm;
  for (let match = regex.exec(markdown); match != null; match = regex.exec(markdown)) {
    if (parseVersion(match[1]) === version) {
      return extractChangeset(markdown, match, regex.exec(markdown));
    }
  }

  return null;
}

module.exports = {
  parseVersion,
  findChangeset,
};
