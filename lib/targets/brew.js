const crypto = require('crypto');
const { shouldPerform } = require('dryrun');
const { createReadStream } = require('fs');
const _ = require('lodash');
const { basename } = require('path');
const { promiseProps } = require('../utils');

/**
 * Regex used to parse homebrew taps (github repositories)
 */
const TAP_REGEX = /^([a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38})\/([-_.\w\d]+)$/i;

/**
 * Extracts repository information for a homebrew tap from the given context
 *
 * If no explicit tap is given, 'homebrew/core' is assumed. Otherwise, the
 * string "<owner>/>tap>" is transformed to "<owner>/homebrew-<tap>".
 *
 * @param {object} config Configuration for the brew target
 * @returns {object} The owner and repository of the tap
 */
function getTapRepo(config) {
  const { tap } = config;
  if (!tap) {
    return {
      owner: 'homebrew',
      repo: 'homebrew-core',
    };
  }

  const match = TAP_REGEX.exec(tap);
  if (!match) {
    throw new Error(`Invalid tap name: ${tap}`);
  }

  return {
    owner: match[1],
    repo: `homebrew-${match[2]}`,
  };
}

/**
 * Calculates the checksum of a file's contents
 *
 * @param {string} path The path to a file to process
 * @param {string} algorithm A crypto algorithm, defaults to "sha256"
 * @returns {Promise<string>} The checksum as hex string
 * @async
 */
function calculateChecksum(path, algorithm = 'sha256') {
  const stream = createReadStream(path);
  const hash = crypto.createHash(algorithm);

  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data, 'utf8'));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * Resolves the content sha of a formula at the specified location. If the
 * formula does not exist, `null` is returned.
 *
 * @param {Context} context A Github context
 * @param {object} tap Owner and repository of the tap
 * @param {string} path The path to the formula
 * @returns {Promise<string>} The SHA of the file, if it exists; otherwise null
 * @async
 */
async function getFormulaSha(context, tap, path) {
  const { logger, github } = context;

  try {
    logger.debug(`Loading SHA for ${tap.owner}/${tap.repo}:${path}`);
    const response = await github.repos.getContent({ ...tap, path });
    return response.data.sha;
  } catch (err) {
    if (err.code === 404) {
      return null;
    }

    throw err;
  }
}

/**
 * Pushes a new formula to a homebrew tap
 *
 * @param {TargetContext} context Enriched Github context
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async context => {
  const { config, github, logger } = context;
  const { formula, path, tag, template, store } = config;
  const { owner, repo } = context.repo();
  const { ref, sha } = tag;

  if (!template) {
    throw new Error('Missing template parameter in "brew" configuration');
  }

  // Get default formula name and location from the config
  const formulaName = formula || repo;
  const formulaPath =
    path == null ? `Formula/${formulaName}.rb` : `${path}/${formulaName}.rb`;

  // Format checksums and the tag version into the formula file
  const files = await store.downloadAll();
  const fileMap = _.keyBy(files, file => basename(file));
  const promises = _.mapValues(fileMap, file => calculateChecksum(file));
  const checksums = await promiseProps(promises);
  const data = _.template(template)({ ref, sha, checksums });
  logger.debug(`Homebrew formula for ${formulaName}:\n${data}`);

  // Try to find the repository to publish in
  const tapRepo = getTapRepo(config);
  if (tapRepo.owner !== owner) {
    // TODO: Create a PR if we have no push rights to this repo
    logger.warn('Skipping homebrew release: PRs not supported yet');
    return;
  }

  const params = {
    owner: tapRepo.owner,
    repo: tapRepo.repo,
    path: formulaPath,
    message: `release: ${formulaName} ${ref}`,
    content: Buffer.from(data).toString('base64'),
    sha: await getFormulaSha(context, tapRepo, formulaPath),
  };

  logger.info(
    `Releasing ${owner}/${repo} tag ${tag.ref} ` +
      `to homebrew tap ${tapRepo.owner}/${tapRepo.repo} ` +
      `formula ${formulaName}`
  );

  if (params.sha == null) {
    logger.debug(
      `Creating new file ${params.owner}/${params.repo}:${params.path}`
    );
    if (shouldPerform()) {
      github.repos.createFile(params);
    }
  } else {
    logger.debug(
      `Updating file ${params.owner}/${params.repo}:${params.path} (${
        params.sha
      })`
    );
    if (shouldPerform()) {
      github.repos.updateFile(params);
    }
  }

  logger.info('Homebrew release completed');
};
