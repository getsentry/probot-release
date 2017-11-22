const Github = require('./github');

module.exports = class Context {
  constructor(payload = {}) {
    this.payload = Object.assign({}, payload);
    this.github = new Github();
  }

  repo(obj) {
    return Object.assign({}, this.payload, obj);
  }
};
