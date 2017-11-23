const { shouldPerform } = require('dryrun');
const fs = require('fs');
const { basename, join } = require('path');
const { promisify } = require('util');
const { withTempDir } = require('../files');
const { getFile, spawn } = require('../utils');

const writeFile = promisify(fs.writeFile);

/**
 * Command to launch cocoapods
 */
const COCOAPODS_BIN = process.env.COCOAPODS_BIN || 'pod';

/**
 * Pushes a new Podspec to Cocoapods
 *
 * @param {Context} context Enriched Github context
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async context => {
  const { config, logger, tag } = context;
  const { owner, repo } = context.repo();

  if (!process.env.COCOAPODS_TRUNK_TOKEN) {
    logger.warn('Skipping cocoapods release due to missing trunk token');
    return;
  }

  if (config.spec == null) {
    logger.warn(`Missing podspec configuration for ${owner}/${repo}`);
    return;
  }

  logger.info(`Loading podspec from ${owner}/${repo}:${config.spec}`);
  const spec = await getFile(context, config.spec, tag.ref);
  if (spec == null) {
    logger.warn(`Podspec not found at ${owner}/${repo}:${config.spec}`);
    return;
  }

  await withTempDir(async directory => {
    const fileName = basename(config.spec);
    const filePath = join(directory, fileName);
    await writeFile(filePath, spec, 'utf8');

    logger.info(`Pushing podspec ${fileName} to cocoapods`);
    if (shouldPerform()) {
      await spawn(COCOAPODS_BIN, ['setup'], undefined, logger);
      await spawn(
        COCOAPODS_BIN,
        ['trunk', 'push', fileName],
        { cwd: directory, env: process.env },
        logger
      );
    }

    logger.info(`Cocoapods release completed: ${fileName}`);
  });
};
