const { shouldPerform } = require('dryrun');
const { spawn } = require('../utils');

/**
 * Command to launch npm
 */
const NPM_BIN = process.env.NPM_BIN || 'npm';

/**
 * Parameter used to reset NPM to its default registry.
 * If launched from yarn, this parameter is overwritten.
 * @see https://github.com/lerna/lerna/issues/896#issuecomment-311894609
 */
const NPM_REGISTRY = '--registry=https://registry.npmjs.org/';

/**
 * A regular expression used to find the package tarball
 */
const PACKAGE_REGEX = /.*\.tgz$/;

/**
 * Publishes the tarball to the NPM registry
 *
 * @param {string} path Absolute path to the tarball to upload
 * @param {object} logger An optional logger to pipe stdout and stderr to
 * @returns {Promise} A promise that resolves when the upload has completed
 * @async
 */
function publishPackage(path, access, logger) {
  const accessParam = access ? `--access=${access}` : '';
  return spawn(NPM_BIN, ['publish', NPM_REGISTRY, accessParam, path], undefined, logger);
}

/**
 * Publishes a package tarball on the NPM registry
 *
 * @param {Context} context Enriched Github context
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async (context) => {
  const { access, logger, store } = context;

  const files = await store.listFiles();
  const packageFile = files.find(file => PACKAGE_REGEX.test(file.name));
  if (packageFile == null) {
    logger.info('Skipping NPM release since there is no package tarball');
    return;
  }

  const packagePath = await store.downloadFile(packageFile);
  logger.info(`Releasing ${packageFile.name} to NPM`);
  if (shouldPerform()) {
    await publishPackage(packagePath, access, logger);
  }

  logger.info('NPM release completed');
};
