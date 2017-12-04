const tryRequire = require('try-require');

/**
 * Loads an initializes the specified store implementation.
 * If no store with the given type can be found, an error is thrown.
 *
 * @param {string} type Identifier of the store type (e.g. "zeus")
 * @param {object} commit A repository and commit to lookup
 * @param {string} downloadDirectory Path to a local cache directory
 * @param {object} logger An optional logger
 * @returns {Store} A store implementation
 */
function createStore(type, commit, downloadDirectory, logger = console) {
  if (!type || type === 'index') {
    throw new Error(`Invalid store type "${type}"`);
  }

  const storeFn = tryRequire(`./${type}`, require);
  if (storeFn == null) {
    throw new Error(`Unknown store "${type}"`);
  }

  return storeFn(commit, downloadDirectory, logger);
}

module.exports = createStore;
