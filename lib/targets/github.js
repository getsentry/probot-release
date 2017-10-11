const { shouldPerform } = require('dryrun');
const { basename } = require('path');
const { findChangeset } = require('../changes');

/**
 * Path to the changelog file in the target repository
 * TODO: Make this configurable
 */
const CHANGELOG_PATH = 'CHANGELOG.md';

/**
 * Loads a file from the context's repository
 *
 * @param {Context} context Github context
 * @param {string} path The path of the file in the repository
 * @returns {Promise<string>} The decoded file contents
 * @async
 */
async function getFile(context, path) {
  const params = context.repo({ path });
  try {
    const response = await context.github.repos.getContent(params);
    return Buffer.from(response.data.content, 'base64').toString();
  } catch (err) {
    if (err.code === 404) {
      return null;
    }

    throw err;
  }
}

/**
 * Creates a new release for the given tag
 *
 * If a release for the same tag already exists, it is converted to a draft.
 * Currently, the release does not infer name or body from the CHANGELOG
 *
 * @param {Context} context Github context
 * @param {string} tag Tag name for this release
 * @returns {Promise<object>} The newly created release
 * @async
 */
async function getOrCreateRelease(context, tag) {
  try {
    return await context.github.repos.getReleaseByTag(context.repo({ tag }));
  } catch (err) {
    if (err.code !== 404) {
      throw err;
    }

    // Release hasn't been found, so create one
  }

  const changelog = await getFile(context, CHANGELOG_PATH, tag);
  const changes = changelog && findChangeset(changelog, tag);

  const params = context.repo({
    tag_name: tag,
    draft: false,
    prerelease: false,
    ...changes,
  });

  if (changes) {
    context.logger.info(`Found changelog for ${params.owner}/${params.repo}:${tag}`);
  }

  context.logger.info(`Creating release ${params.owner}/${params.repo}:${tag}`);
  if (!shouldPerform()) {
    return { id: 42, tag_name: tag, html_url: '[no url during DRY_RUN]' };
  }

  const created = await context.github.repos.createRelease(params);
  return created.data;
}

/**
 * Uploads all files to a Github release
 *
 * This always creates a new release on github. If a release for the same tag
 * exists already, it is automatically converted to draft. All files are
 * uploaded to the Github release.
 *
 * @param {Context} context Enriched Github context
 * @param {string[]} files Absolute paths to the build artifacts
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async (context, files) => {
  const { logger, tag } = context;
  const release = await getOrCreateRelease(context, tag.ref);

  await Promise.all(files.map((file) => {
    const name = basename(file);
    const params = context.repo({
      id: release.id,
      filePath: file,
      name,
    });

    logger.info(`Uploading asset "${name}" to ${params.owner}/${params.repo}:${release.tag_name}`);
    return shouldPerform()
      ? context.github.repos.uploadAsset(params)
      : null;
  }));

  logger.info(`Github release completed: ${release.html_url}`);
};
