const Github = require('./github');

class Context {
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
    const issue = {
      owner: Context.OWNER,
      repo: Context.REPO,
      issue: Context.ISSUE,
    };

    this.payload = Object.assign(issue, payload);
    this.github = new Github();
  }

  /**
   * Returns all properties identifying the repository of this context.
   *
   * If props are specified, they are merged into the result. Note that the
   * props will overwrite the payload, if the same keys are used.
   *
   * @param {object} props Additional props to include in the return value
   * @returns {object} The merged object including payload and props
   */
  repo(props = {}) {
    const { owner, repo } = this.payload;
    return Object.assign({}, { owner, repo }, props);
  }

  /**
   * Returns all properties identifying the issue/PR of this context.
   *
   * If props are specified, they are merged into the result. Note that the
   * props will overwrite the payload, if the same keys are used.
   *
   * @param {object} props Additional props to include in the return value
   * @returns {object} The merged object including payload and props
   */
  issue(props = {}) {
    const { owner, repo, issue } = this.payload;
    return Object.assign({}, { owner, repo, issue }, props);
  }
}

Context.OWNER = '__owner__';
Context.REPO = '__repo__';
Context.ISSUE = '__issue__';

module.exports = Context;
