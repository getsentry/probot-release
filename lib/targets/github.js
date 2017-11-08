const { shouldPerform } = require('dryrun');
const { basename } = require('path');
const { findChangeset } = require('../changes');
const { getFile } = require('../utils');

/**
 * Path to the changelog file in the target repository
 * TODO: Make this configurable
 */
const CHANGELOG_PATH = 'CHANGELOG.md';

/**
 * Gets an existing or creates a new release for the given tag
 *
 * The release name and description body is loaded from CHANGELOG.md in the
 * respective tag, if present. Otherwise, the release name defaults to the
 * tag and the body to the commit it points to.
 *
 * @param {Context} context Github context
 * @param {string} tag Tag name for this release
 * @returns {Promise<object>} The newly created release
 * @async
 */
async function getOrCreateRelease(context, tag) {
  try {
    const response = await context.github.repos.getReleaseByTag(context.repo({ tag }));
    return response.data;
  } catch (err) {
    if (err.code !== 404) {
      throw err;
    }

    // Release hasn't been found, so create one
  }

  const changelog = await getFile(context, context.changelog || CHANGELOG_PATH, tag);
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
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async (context) => {
  const { logger, store, tag } = context;
  const release = await getOrCreateRelease(context, tag.ref);

  const files = await store.listFiles();
  await Promise.all(files.map(async (file) => {
    const path = await store.downloadFile(file);
    const name = basename(path);
    const params = context.repo({
      id: release.id,
      filePath: path,
      name,
    });

    logger.info(`Uploading asset "${name}" to ${params.owner}/${params.repo}:${release.tag_name}`);
    return shouldPerform()
      ? context.github.repos.uploadAsset(params)
      : null;
  }));

  logger.info(`Github release completed: ${release.html_url}`);
};
