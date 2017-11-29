const { shouldPerform } = require('dryrun');
const request = require('../request');

/**
 * Triggers a build in the docker cloud infrastructure
 *
 * @param {Context} context Enriched Github context
 * @returns {Promise} A promise that resolves when the trigger was successful
 * @async
 */
module.exports = async context => {
  const { logger, tag } = context;

  const { DOCKER_TRIGGER_URL } = process.env;
  if (!DOCKER_TRIGGER_URL) {
    logger.warn('Skipping docker build due to missing build trigger URL');
  }

  const trigger = {
    source_type: 'Tag',
    source_name: tag.ref,
  };

  logger.info('Triggering Docker Cloud build via API');
  if (shouldPerform()) {
    await request(DOCKER_TRIGGER_URL, {
      method: 'POST',
      body: JSON.stringify(trigger),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  logger.info('Docker Cloud build triggered successfully');
};
