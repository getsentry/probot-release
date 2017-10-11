module.exports = class Context {
  constructor(payload = {}) {
    this.payload = { ...payload };
  }

  repo(obj) {
    return { ...this.payload, ...obj };
  }
};
