const _ = require('lodash');
const s3 = require('s3');
const { forEachFile, withTempDir } = require('./utils');

/**
 * Git Reference type: Tag
 */
const REF_TYPE_TAG = 'tag';

/**
 * Status check state: Pending
 */
const STATE_PENDING = 'pending';

/**
 * Status check state: Success
 */
const STATE_SUCCESS = 'success';

/**
 * Internal cache for tags by repository
 */
const tagCache = {};

/**
 * AWS S3 client used to retrieve assets
 */
const s3Client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

/**
 * Logger instance provided by probot
 */
let logger;

/**
 * Resolves a git reference (e.g. branch or tag) and returns the object it points to
 *
 * Be sure to pass the entire reference name including its type, e.g.: "tags/v1.0.0".
 *
 * @param {Context} context Github context
 * @param {String} ref The git reference to resolve
 * @returns {Promise<object>} The reference object containing a "type" and "sha"
 */
async function getReference(context, ref) {
  const params = context.repo({ ref });
  const response = await context.github.gitdata.getReference(params);
  return response.data.object;
}

/**
 * Fetches all tags of the context's repository
 *
 * The tag requests are cached infinitely by repository. To add or remove tags, use
 * {@link addTag} and {@link removeTag} respectively.
 *
 * @param {Context} context Github context
 * @returns {Promise<object[]>} The list of tags, each containing a "ref" and "sha"
 * @async
 */
function getTags(context) {
  const { owner, repo } = context.repo();
  const key = `${owner}/${repo}`;

  const cached = tagCache[key];
  if (cached) {
    // Serve the cached promise
    return cached;
  }

  // Directly store the promise in the cache to allow for concurrent requests.
  // The caller has to resolve it anyway, even when loading from the cache.
  logger.info(`Loading all tags for ${owner}/${repo}`);
  tagCache[key] = context.github.paginate(
    context.github.repos.getTags({ owner, repo, per_page: 100 }),
    result => result.data.map(tag => ({ ref: tag.tag, sha: tag.commit.sha })),
  );

  return tagCache[key];
}

/**
 * Tries to find a tag referring to the given commit SHA.
 *
 * @param {Context} context Github context
 * @param {String} sha A full commit SHA
 * @returns {Promise<object>} The tag object containing "ref" and "sha", if
 *                            found; otherwise null
 * @async
 */
async function findTag(context, sha) {
  const tags = await getTags(context);
  return tags.find(tag => tag.sha === sha);
}

/**
 * Adds a new tag to the cached list of tags
 *
 * This method can be called even if the cache is cold. In this case, all tags
 * will be loaded first, and then the tag will be inserted, to avoid race
 * conditions. If the tag is already registered, it is removed and re-added to
 * the cache to ensure its sha is up to date.
 *
 * @param {Context} context Github context
 * @param {String} ref The name of this tag (without "tags/")
 * @param {String} sha The commit SHA that this tag points to
 * @returns {Promise<object>} The new tag object containing "ref" and "sha"
 * @async
 */
async function addTag(context, ref, sha) {
  const { owner, repo } = context.repo();
  logger.info(`Adding tag ${ref} to ${owner}/${repo}`);

  const tags = await getTags(context);
  const index = tags.findIndex(tag => tag.ref === ref);
  if (index >= 0) {
    tags.splice(index, 1);
  }

  const tag = { ref, sha };
  tags.push(tag);
  return tag;
}

/**
 * Removes a tag from the cache
 *
 * @param {Context} context Github context
 * @param {String} ref The name of this tag (without "tags/")
 * @returns {Promise<bool>} True if a tag was found and removed; otherwise false
 * @async
 */
async function removeTag(context, ref) {
  const { owner, repo } = context.repo();
  logger.info(`Removing tag ${ref} from ${owner}/${repo}`);

  const tags = await getTags(context);
  const index = tags.findIndex(tag => tag.ref === ref);
  if (index >= 0) {
    tags.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * Resolves all status checks for a given reference (e.g. a branch or tag)
 *
 * NOTE that the list might contain multiple versions of the same status check,
 * identified by the "context" property. Use {@link filterLatestStatuses} to
 * only retrieve the most recent status checks (as shown by Github).
 *
 * @param {Context} context Github context
 * @param {String} ref A tag name
 * @returns {Promise<object[]>} A list of status check objects
 * @async
 */
async function getStatuses(context, ref) {
  // NOTE we assume that there are not more than roughly 30 status checks to fit on one page
  // Try to get statuses in chronological order first, as always delivered by Github
  const response = await context.github.repos.getStatuses(context.repo({ ref }));
  // TODO: Verify chronological order and fall back to github.paginate
  return response.data;
}

/**
 * Removes all succeeded status checks from the given list
 *
 * Status checks are considered succeeded if there is another check with the
 * same "context", but a later "updated_at" value.
 *
 * @param {object[]} statuses A list of status checks
 * @returns {object[]} The list of filtered status checks
 */
function filterLatestStatuses(statuses) {
  const statusesByContext = _.groupBy(statuses, status => status.context);
  return _.values(statusesByContext)
    .map(context => _.maxBy(context, status => status.updated_at));
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
async function createRelease(context, tag) {
  const params = context.repo({
    tag_name: tag,
    // TODO: Parse name from CHANGELOG.md
    // TODO: Parse body from CHANGELOG.md
    draft: false,
    prerelease: false,
  });

  logger.info(`Creating release ${params.owner}/${params.repo}:${tag}`);
  const created = await context.github.repos.createRelease(params);
  return created.data;
}

/**
 * Downloads all files from an S3 bucket to the local file system
 *
 * @param {string} remoteDir A path within the S3 bucket to download
 * @param {string} localDir Absolute path to download files to
 * @returns {Promise} A promise that resolves when the download has finished
 * @async
 */
function downloadS3Directory(remoteDir, localDir) {
  const bucket = process.env.S3_BUCKET;
  logger.info(`Downloading S3 bucket ${bucket}:${remoteDir} to ${localDir}`);

  const downloader = s3Client.downloadDir({
    localDir,
    s3Params: {
      Prefix: remoteDir,
      Bucket: bucket,
    },
  });

  return new Promise((resolve, reject) => {
    // NOTE: The timeout is necessary to be able to list files immediately
    downloader.on('end', () => setTimeout(resolve, 100));
    downloader.on('error', reject);
  });
}

/**
 * Uploads all files from a local directory to a Github release
 *
 * Only files from the local directory are uploaded; symlinks and folders
 * are skipped.
 *
 * @param {Context} context Github context
 * @param {object} release Github release object
 * @param {string} directory Absolute path to the asset directory
 * @returns {Promise} A promise that resolves when the upload has finished
 * @async
 */
function uploadReleaseAssets(context, release, directory) {
  logger.info(`Uploading release assets from ${directory}`);
  return forEachFile(directory, (path, name) => {
    const params = context.repo({
      id: release.id,
      filePath: path,
      name,
    });

    logger.info(`Uploading asset "${name}" to ${params.owner}/${params.repo}:${release.tag_name}`);
    return context.github.repos.uploadAsset(params);
  });
}

/**
 * Handles a newly created or updated Github tag
 *
 * Creates a new release on Github, downloads build artifacts from S3 and
 * uploads them to the Github release. Uses a local temp directory to store
 * the assets, and deletes it automatically upon completion.
 *
 * If the tag has no status checks attached or some of them are still pending,
 * it is skipped. If at least one status check failed, an error is reported and
 * the tag is skipped.
 *
 * @param {Context} context Github context
 * @param {object} tag A tag object containing "ref" and "sha"
 */
async function processTag(context, tag) {
  const { owner, repo } = context.repo();
  logger.info(`Processing tag ${owner}/${repo}:${tag.ref} (${tag.sha})`);

  const statuses = await getStatuses(context, tag.ref);
  const latestStatuses = filterLatestStatuses(statuses);

  if (latestStatuses.length === 0) {
    // We assume that status checks have been configured but haven't started yet
    // This means, we'll come back here once status checks have been added
    return;
  }

  if (latestStatuses.some(status => status.state === STATE_PENDING)) {
    // Checks are still running, so no reason to proceed
    return;
  }

  if (latestStatuses.some(status => status.state !== STATE_SUCCESS)) {
    // Some checks have failed, skip this release
    logger.info(`Skipping release of ${owner}/${repo}:${tag.ref} as status checks have failed`);
    return;
  }

  // All checks have cleared, we're ready to release now
  await withTempDir(async (downloadDirectory) => {
    const commitDirectory = `${owner}/${repo}/${tag.sha}`;
    const release = await createRelease(context, tag.ref);

    await downloadS3Directory(commitDirectory, downloadDirectory);
    await uploadReleaseAssets(context, release, downloadDirectory);

    logger.info(`Release completed: ${release.html_url}`);
  });
}

module.exports = (robot) => {
  // TODO: Ignore all repos without a certain config file
  logger = robot.log;

  // Add created tags to the cache and create a release, if applicable
  // see https://developer.github.com/v3/activity/events/types/#createevent
  robot.on('create', async (context) => {
    // Ignore everything except tags
    if (context.payload.ref_type !== REF_TYPE_TAG) {
      return;
    }

    const { ref } = context.payload;
    const reference = await getReference(context, `tags/${ref}`);
    const tag = await addTag(context, ref, reference.sha);
    await processTag(context, tag);
  });

  // Remove deleted tags from the cache
  // see https://developer.github.com/v3/activity/events/types/#deleteevent
  robot.on('delete', async (context) => {
    // Ignore everything except tags
    if (context.payload.ref_type !== REF_TYPE_TAG) {
      return;
    }

    await removeTag(context, context.payload.ref);
  });

  // Create a release for succeeded status checks of a tag
  // see https://developer.github.com/v3/activity/events/types/#statusevent
  robot.on('status', async (context) => {
    const { sha, state } = context.payload;
    if (state === STATE_PENDING) {
      // Ignore, we're only interested in completed checks
      return;
    }

    const tag = await findTag(context, sha);
    if (tag == null) {
      // Ignore, we're only interested in status checks of tags
      return;
    }

    await processTag(context, tag);
  });
};
