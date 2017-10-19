const { shouldPerform } = require('dryrun');
const _ = require('lodash');
const { basename, extname } = require('path');
const { spawn } = require('../utils');

/**
 * Command to launch twine
 */
const TWINE_BIN = process.env.TWINE_BIN || 'twine';

/**
 * White list for file extensions uploaded to PyPI
 */
const WHEEL_EXTENSIONS = ['.whl', '.gz'];

/**
 * @typedef {object} TwineCredentials
 * @prop {string} TWINE_USERNAME
 * @prop {string} TWINE_PASSWORD
 */

/**
 * Uploads a wheel to PyPI using twine
 *
 * @param {string} path Absolute path to the wheel to upload
 * @param {TwineCredentials} credentials User name and password to authenticate
 * @returns {Promise} A promise that resolves when the upload has completed
 * @async
 */
function uploadAsset(path, credentials) {
  // TODO: Sign the wheel with "--sign"
  const env = { ...credentials, PATH: process.env.PATH };
  return spawn(TWINE_BIN, ['upload', path], { env });
}

/**
 * Uploads all files to PyPI using Twine
 *
 * Requires twine to be configured in the environment (see .env.example). Only
 * *.whl files are uploaded.
 *
 * @param {Context} context Enriched Github context
 * @param {string[]} files Absolute paths to the build artifacts
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async (context, files) => {
  const { logger, tag } = context;

  const credentials = _.pick(process.env, ['TWINE_USERNAME', 'TWINE_PASSWORD']);
  if (!credentials.TWINE_USERNAME || !credentials.TWINE_PASSWORD) {
    logger.warn('Skipping PyPI release due to missing credentials');
    return;
  }

  const wheelFiles = files.filter(file => WHEEL_EXTENSIONS.includes(extname(file)));
  if (wheelFiles.length === 0) {
    logger.info('Skipping PyPI release since there are no wheels');
    return;
  }

  const { owner, repo } = context.repo();
  logger.info(`Releasing ${wheelFiles.length} wheels for ${owner}/${repo} tag ${tag.ref} to PyPI`);

  await Promise.all(wheelFiles.map((file) => {
    logger.info(`Uploading asset "${basename(file)}" via twine`);
    return shouldPerform() && uploadAsset(file, credentials);
  }));

  logger.info('PyPI release completed');
};
