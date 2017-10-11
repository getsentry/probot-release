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
module.exports = async (context) => {
  const { logger, tag } = context;
  const { owner, repo } = context.repo();

  if (context.spec == null) {
    context.logger.error(`Missing podspec configuration for ${owner}/${repo}`);
    return;
  }

  context.logger.info(`Loading podspec from ${owner}/${repo}:${context.spec}`);
  const spec = await getFile(context, context.spec, tag);
  if (spec == null) {
    context.logger.error(`Podspec not found at ${owner}/${repo}:${context.spec}`);
    return;
  }

  await withTempDir(async (directory) => {
    const fileName = basename(context.spec);
    const filePath = join(directory, fileName);
    await writeFile(filePath, spec, 'utf8');

    context.logger.info(`Pushing podspec ${fileName} to cocoapods`);
    if (shouldPerform()) {
      await spawn(COCOAPODS_BIN, ['repo', 'update'], { cwd: directory });
      await spawn(COCOAPODS_BIN, ['trunk', 'push', fileName], { cwd: directory });
    }

    logger.info(`Cocoapods release completed: ${fileName}`);
  });
};
