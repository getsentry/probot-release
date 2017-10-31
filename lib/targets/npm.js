const { shouldPerform } = require('dryrun');
const { basename } = require('path');
const { spawn } = require('../utils');

/**
 * Command to launch npm
 */
const NPM_BIN = process.env.NPM_BIN || 'npm';

/**
 * A regular expression used to find the package tarball
 */
const PACKAGE_REGEX = /.*\.tgz/;

/**
 * Publishes the tarball with NPM
 *
 * @param {string} path Absolute path to the tarball to upload
 * @param {object} logger An optional logger to pipe stdout and stderr to
 * @returns {Promise} A promise that resolves when the upload has completed
 * @async
 */
function publishPackage(path, logger) {
  return spawn(NPM_BIN, ['publish', path], undefined, logger);
}

/**
 * Publishes a package tarball on the NPM registry
 *
 * @param {Context} context Enriched Github context
 * @param {string[]} files Absolute paths to the build artifacts
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async (context, files) => {
  const { logger } = context;

  const packageFile = files.find(file => PACKAGE_REGEX.test(file));
  if (packageFile == null) {
    logger.info('Skipping NPM release since there is no package tarball');
    return;
  }

  logger.info(`Releasing ${basename(packageFile)} to NPM`);
  if (shouldPerform()) {
    await publishPackage(packageFile, logger);
  }

  logger.info('NPM release completed');
};
