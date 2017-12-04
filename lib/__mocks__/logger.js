/* eslint-env jest */

const logger = jest.fn();
logger.error = logger;
logger.warn = logger;
logger.info = logger;
logger.debug = logger;
module.exports = logger;
