const { shouldPerform } = require('dryrun');
const fs = require('fs');
const _ = require('lodash');
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

  if (!process.env.COCOAPODS_TRUNK_TOKEN) {
    logger.warn('Skipping cocoapods release due to missing trunk token');
    return;
  }

  if (context.spec == null) {
    context.logger.error(`Missing podspec configuration for ${owner}/${repo}`);
    return;
  }

  context.logger.info(`Loading podspec from ${owner}/${repo}:${context.spec}`);
  const spec = await getFile(context, context.spec, tag.ref);
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
      const env = _.pick(process.env, ['COCOAPODS_TRUNK_TOKEN', 'PATH']);
      await spawn(COCOAPODS_BIN, ['repo', 'update'], { cwd: directory, env });
      await spawn(COCOAPODS_BIN, ['trunk', 'push', fileName], { cwd: directory, env });
    }

    logger.info(`Cocoapods release completed: ${fileName}`);
  });
};
