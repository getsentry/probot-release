const tryRequire = require('try-require');
const { cloneContext } = require('../utils');

/**
 * Performs the release to a specific target
 *
 * The target can either be specified via a string containing its name ore an
 * object with the name as key. All further properties of the object will be
 * passed as context to the target.
 *
 * The target also receives the current logger instance and the tag via the
 * context, as well as the store to retrieve release artifacts. It can then
 * decide which artifacts will be included in the release.
 *
 * @param {object | string} target Target name or configuration
 * @param {Context} context Github context
 * @param {object} tag A tag object containing "ref" and "sha"
 * @param {string[]} store A store bound to the commit
 * @returns {Promise} A promise that resolves when the release has succeeded
 * @async
 */
async function runTarget(target, context, tag, store, logger) {
  const config = typeof target === 'string' ? { name: target } : target;
  const targetFn = tryRequire(`./${config.name}`, require);
  if (targetFn == null) {
    throw new Error(`Skipping unknown deploy target "${config.name}"`);
  }

  const targetContext = cloneContext(context, {
    config,
    tag,
    logger,
    store,
  });

  await targetFn(targetContext);
}

module.exports = runTarget;
