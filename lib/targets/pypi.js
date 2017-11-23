const { shouldPerform } = require('dryrun');
const { extname } = require('path');
const { spawn } = require('../utils');

/**
 * Command to launch twine
 */
const TWINE_BIN = process.env.TWINE_BIN || 'twine';

/**
 * White list for file extensions uploaded to PyPI
 */
const WHEEL_EXTENSIONS = ['.whl', '.gz', '.zip'];

/**
 * @typedef {object} TwineCredentials
 * @prop {string} TWINE_USERNAME
 * @prop {string} TWINE_PASSWORD
 */

/**
 * Uploads a wheel to PyPI using twine
 *
 * @param {string} path Absolute path to the wheel to upload
 * @param {object} logger An optional logger to pipe stdout and stderr to
 * @returns {Promise} A promise that resolves when the upload has completed
 * @async
 */
function uploadAsset(path, logger) {
  // TODO: Sign the wheel with "--sign"
  return spawn(TWINE_BIN, ['upload', path], undefined, logger);
}

/**
 * Uploads all files to PyPI using Twine
 *
 * Requires twine to be configured in the environment (see .env.example). Only
 * *.whl files are uploaded.
 *
 * @param {Context} context Enriched Github context
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async context => {
  const { logger, store, tag } = context;

  if (!process.env.TWINE_USERNAME || !process.env.TWINE_PASSWORD) {
    logger.warn('Skipping PyPI release due to missing credentials');
    return;
  }

  const files = await store.listFiles();
  const wheelFiles = files.filter(file =>
    WHEEL_EXTENSIONS.includes(extname(file.name))
  );
  if (wheelFiles.length === 0) {
    logger.info('Skipping PyPI release since there are no wheels');
    return;
  }

  const { owner, repo } = context.repo();
  logger.info(
    `Releasing ${wheelFiles.length} wheels for ${owner}/${repo} tag ${
      tag.ref
    } to PyPI`
  );

  await Promise.all(
    wheelFiles.map(async file => {
      const path = await store.downloadFile(file);
      logger.info(`Uploading asset "${file.name}" via twine`);
      return shouldPerform() && uploadAsset(path, logger);
    })
  );

  logger.info('PyPI release completed');
};
