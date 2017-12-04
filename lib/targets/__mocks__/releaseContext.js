/* eslint-env jest */

const Context = require('../../__mocks__/context');
const logger = require('../../__mocks__/logger');
const createStore = require('../../stores');

jest.mock('../../stores');

class ReleaseContext extends Context {
  constructor(config = {}, issue = {}) {
    super(issue);

    this.config = config;
    this.logger = logger;
    this.store = createStore();
    this.tag = { ref: ReleaseContext.TAG_REF, sha: ReleaseContext.TAG_SHA };
  }
}

ReleaseContext.TAG_REF = 'v1.0.0';
ReleaseContext.TAG_SHA = '2720b2c9037c0258118517725d2ac0d6364ae585';

module.exports = ReleaseContext;
