const Github = require('./github');

module.exports = class Context {
  /**
   * Creates a new mock context.
   *
   * The payload is used to initialize this context. It should contain an owner
   * and repo field to emulate a Github repository. To simulate an issue, add
   * an additional issue field.
   *
   * @param {object} payload The initial payload
   */
  constructor(payload = {}) {
    this.payload = Object.assign({}, payload);
    this.github = new Github();
  }

  /**
   * Returns all parameters passed in the payload.
   *
   * If props are specified, they are merged into the result. Note that the
   * props will overwrite the payload, if the same keys are used.
   *
   * @param {object} props Additional props to include in the return value
   * @returns {object} The merged object including payload and props
   */
  repo(props = {}) {
    return Object.assign({}, this.payload, props);
  }
};
