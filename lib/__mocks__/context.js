module.exports = class Context {
  constructor(payload = {}) {
    this.payload = Object.assign({}, payload);
  }

  repo(obj) {
    return Object.assign({}, this.payload, obj);
  }
};
