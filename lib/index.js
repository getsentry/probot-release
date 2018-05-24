const _ = require('lodash');
const defaults = require('./defaults');
const { withTempDir } = require('./files');
const createStore = require('./stores');
const runTarget = require('./targets');
const { isSorted } = require('./utils');

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
 * Configuration file used to activate this bot
 */
const CONFIG_NAME = 'release.yml';

/**
 * Time to wait before starting a release
 */
const RELEASE_TIMEOUT =
  process.env.RELEASE_TIMEOUT === '' ? 60 : process.env.RELEASE_TIMEOUT;

/**
 * Holds timeouts for deferred releases
 */
const scheduledReleases = {};

/**
 * Internal cache for tags by repository
 */
const tagCache = {};

/**
 * Logger instance provided by probot
 */
let logger;

/**
 * Retrieves the parsed configuration file from the context's repository, if any
 *
 * If the config is present in the repository, it is merged with defaults.
 *
 * @param {Context} context Github context
 * @returns {Promise<object>} The configuration file as object or null
 * @async
 */
async function getConfig(context) {
  const config = await context.config(CONFIG_NAME);
  return config && { ...defaults, ...config };
}

/**
 * Resolves a git tag and returns the object it points to, most likely a commit
 *
 * This is especially useful when resolving annotated tags, as passing the tag's sha
 * resolves the actual commit it points to.
 *
 * @param {Context} context Github context
 * @param {string} sha The SHA of the tag to resolve
 * @returns {Promise<object>} The tag object containing a "type" and "sha"
 * @async
 */
async function getTagObject(context, sha) {
  const params = context.repo({ sha });
  const response = await context.github.gitdata.getTag(params);
  return response.data.object;
}

/**
 * Resolves a git reference (e.g. branch or tag) and returns the object it points to
 *
 * If the ref points to an annotated tag, the tag is resolved and the inner object is
 * resolved instead. Be sure to pass the entire reference name including its type,
 * e.g.: "tags/v1.0.0".
 *
 * @param {Context} context Github context
 * @param {String} ref The git reference to resolve
 * @returns {Promise<object>} The reference object containing a "type" and "sha"
 */
async function getReference(context, ref) {
  const params = context.repo({ ref });
  const response = await context.github.gitdata.getReference(params);

  const { object } = response.data;
  if (object.type === 'tag') {
    return getTagObject(context, object.sha);
  }

  return object;
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
    result => result.data.map(tag => ({ ref: tag.name, sha: tag.commit.sha }))
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
  const response = await context.github.repos.getStatuses(
    context.repo({ ref })
  );
  if (isSorted(response.data.map(status => status.updated_at), true)) {
    return response.data;
  }

  // For some reason, the statuses on the first page were not sorted by "updated_at"
  // To be safe, continue to fetch all pages and sort manually
  logger.warn(`Statuses of commit ${ref} were not sorted by created_at`);
  const statuses = await context.github.paginate(
    response,
    result => result.data
  );
  return _.sortBy(statuses, status => status.updated_at);
}

/**
 * Removes all succeeded status checks from the given list
 *
 * Status checks are considered succeeded if there is another check with the
 * same "context", but a later "updated_at" value. If the configuration
 * specifies "ignoredChecks" then those status checks will be omitted from the
 * list.
 *
 * @param {object[]} statuses A list of status checks
 * @param {object} config Release configuration for the repository
 * @returns {object[]} The list of filtered status checks
 */
function filterLatestStatuses(statuses, config) {
  const ignoredChecks = config.ignoredChecks || [];
  const filtered = statuses.filter(
    status => !ignoredChecks.some(check => status.context.startsWith(check))
  );

  const statusesByContext = _.groupBy(filtered, status => status.context);
  return _.values(statusesByContext).map(context =>
    _.maxBy(context, status => status.updated_at)
  );
}

/**
 * Releases build artifacts to all configured targets
 *
 * Creates a store object for the configured provider and passes it to all
 * configured targets, if any. The store is able to list all release artifacts
 * and download them to a local temp directory. This directory is removed after
 * the release has completed.
 *
 * @param {Context} context Github context
 * @param {object} tag A tag object containing "ref" and "sha"
 * @param {object} config Release configuration for the repository
 * @returns A promise that resolves when the release has completed
 * @async
 */
async function performRelease(context, tag, config) {
  const { owner, repo } = context.repo();
  logger.info(`Starting scheduled release of ${owner}/${repo}:${tag.ref}`);

  await withTempDir(async downloadDirectory => {
    try {
      const store = createStore(
        config.store,
        context.repo({ ref: tag.ref, sha: tag.sha }),
        downloadDirectory,
        logger
      );

      const runs = config.targets.map(target =>
        runTarget(target, context, tag, store, logger).catch(e =>
          logger.error(e)
        )
      );

      await Promise.all(runs);
    } catch (e) {
      logger.error(e);
    }
  });
}

/**
 * Handles a newly created or updated Github tag
 *
 * If the tag has no status checks attached or some of them are still pending,
 * it is skipped. If at least one status check failed, an error is reported and
 * the tag is skipped.
 *
 * If a release for the same tag had been scheduled, it is cancelled. This
 * prevents repeated releases due to cascading or rapidly changing status
 * checks reported by third party services (e.g. code coverage or CI).
 *
 * @param {Context} context Github context
 * @param {object} tag A tag object containing "ref" and "sha"
 * @param {object} config Configurations for this task
 * @returns A promise that resolves when the tag has been processed
 * @async
 */
async function processTag(context, tag, config) {
  if (config == null) {
    throw new Error('Missing release config');
  }

  const { owner, repo } = context.repo();
  const id = `${owner}/${repo}:${tag.ref}`;
  logger.info(`Processing tag ${id} (${tag.sha})`);

  const statuses = await getStatuses(context, tag.ref);
  const latestStatuses = filterLatestStatuses(statuses, config);

  // Prevent a previously scheduled release. In case this status update is
  // successful again, we will reschedule down below.
  const scheduled = scheduledReleases[id];
  if (scheduled != null) {
    clearTimeout(scheduled);
    delete scheduledReleases[id];
  }

  if (latestStatuses.length === 0) {
    // We assume that status checks have been configured but haven't started yet
    // This means, we'll come back here once status checks have been added
    logger.info(`Skipping release of ${id} as no status checks were found`);
    return;
  }

  if (latestStatuses.some(status => status.state === STATE_PENDING)) {
    // Checks are still running, so no reason to proceed
    logger.info(`Skipping release of ${id} as status checks are pending`);
    return;
  }

  if (latestStatuses.some(status => status.state !== STATE_SUCCESS)) {
    // Some checks have failed, skip this release
    logger.info(`Skipping release of ${id} as status checks have failed`);
    return;
  }

  if (config.targets.length === 0) {
    // Only proceed to download if we are actually releasing
    logger.info(`Skipping release of ${id} since no targets were configured`);
    return;
  }

  // All checks have cleared, we're ready to release now
  logger.info(`Scheduling release of ${id} in ${RELEASE_TIMEOUT} seconds`);
  scheduledReleases[id] = setTimeout(() => {
    delete scheduledReleases[id];
    performRelease(context, tag, config).catch(logger.error);
  }, RELEASE_TIMEOUT * 1000);
}

module.exports = robot => {
  logger = robot.log;

  // Add created tags to the cache and create a release, if applicable
  // see https://developer.github.com/v3/activity/events/types/#createevent
  robot.on('create', async context => {
    // Ignore everything except tags
    if (context.payload.ref_type !== REF_TYPE_TAG) {
      return;
    }

    // Ignore repos without config file
    const config = await getConfig(context);
    if (config == null) {
      return;
    }

    const { ref } = context.payload;
    const reference = await getReference(context, `tags/${ref}`);
    const tag = await addTag(context, ref, reference.sha);
    await processTag(context, tag, config);
  });

  // Remove deleted tags from the cache
  // see https://developer.github.com/v3/activity/events/types/#deleteevent
  robot.on('delete', async context => {
    // Ignore everything except tags
    if (context.payload.ref_type !== REF_TYPE_TAG) {
      return;
    }

    // Ignore repos without config file
    const config = await getConfig(context);
    if (config == null) {
      return;
    }

    await removeTag(context, context.payload.ref);
  });

  // Create a release for succeeded status checks of a tag
  // see https://developer.github.com/v3/activity/events/types/#statusevent
  robot.on('status', async context => {
    // Ignore repos without config file
    const config = await getConfig(context);
    if (config == null) {
      return;
    }

    const tag = await findTag(context, context.payload.sha);
    if (tag == null) {
      // Ignore, we're only interested in status checks of tags
      return;
    }

    await processTag(context, tag, config);
  });
};
