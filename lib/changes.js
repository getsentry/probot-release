const { parseVersion } = require('./version');

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
function extractChangeset(markdown, header, nextHeader) {
  const start = header.index + header[0].length;
  const end = nextHeader ? nextHeader.index : undefined;
  const body = markdown.substring(start, end).trim();
  const name = (header[1] || header[2]).trim();
  return { name, body };
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

  const regex = /^ *## *([^\n]+?) *#* *(?:\n+|$)|^([^\n]+)\n *(?:-){2,} *(?:\n+|$)/gm;
  for (
    let match = regex.exec(markdown);
    match != null;
    match = regex.exec(markdown)
  ) {
    if (parseVersion(match[1] || match[2]) === version) {
      return extractChangeset(markdown, match, regex.exec(markdown));
    }
  }

  return null;
}

module.exports = {
  findChangeset,
};
