/* eslint-env jest */

const defaultHelpers = {
  mockResponse(data) {
    this.mockReturnValue({ data });
  },

  mockResponseOnce(data) {
    this.mockReturnValueOnce({ data });
  },

  mockError(code, message) {
    this.mockImplementation(() => {
      const e = new Error(message);
      e.code = code;
      throw e;
    });
  },

  mockErrorOnce(code, message) {
    this.mockImplementationOnce(() => {
      const e = new Error(message);
      e.code = code;
      throw e;
    });
  },
};

const spy = (helpers = {}) => Object.assign(jest.fn(), defaultHelpers, helpers);

module.exports = class Github {
  constructor() {
    this.repos = {
      getContent: spy({
        mockContent(content) {
          this.mockResponse({ content: global.btoa(content) });
        },

        mockContentOnce(content) {
          this.mockResponseOnce({ content: global.btoa(content) });
        },
      }),
    };
  }
};
