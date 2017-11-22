/* eslint-env jest */

const defaultHelpers = {
  /**
   * Defines a response to the API request that will be returned for all
   * subsequent calls.
   *
   * @param {object} data Any data that the server would have returned
   * @param {object} meta Optional response metadata (status and headers)
   * @returns {this}
   */
  mockResponse(data, meta = {}) {
    return this.mockReturnValue({ data, meta });
  },

  /**
   * Defines a response to the API request that will be returned for the
   * next call only.
   *
   * @param {object} data Any data that the server would have returned
   * @param {object} meta Optional response metadata (status and headers)
   * @returns {this}
   */
  mockResponseOnce(data) {
    return this.mockReturnValueOnce({ data });
  },

  /**
   * Defines an API error that will be thrown for all subsequent calls.
   *
   * @param {number} code The response status code
   * @param {string} message An optional message to include in the error
   * @returns {this}
   */
  mockError(code, message) {
    return this.mockImplementation(() => {
      const e = new Error(message);
      e.code = code;
      throw e;
    });
  },

  /**
   * Defines an API error that will be thrown for the next call only.
   *
   * @param {number} code The response status code
   * @param {string} message An optional message to include in the error
   * @returns {this}
   */
  mockErrorOnce(code, message) {
    return this.mockImplementationOnce(() => {
      const e = new Error(message);
      e.code = code;
      throw e;
    });
  },
};

module.exports = class Github {
  /**
   * Defines a new mock function with additional helpers
   *
   *  - mockResponse / mockResponseOnce: set success response data
   *  - mockError / mockErrorOnce: set error objectes
   *
   * @param {object} helpers Additional helpers to include in this endpoint
   * @returns {function} A jest mock function
   */
  static fn(helpers = {}) {
    return Object.assign(jest.fn(), defaultHelpers, helpers);
  }

  constructor() {
    this.repos = {
      getContent: Github.fn({
        /**
         * Mocks the requested file's contents for all subsequent calls. The
         * contents will be base64 encoded in the response.
         *
         * @param {string} content File contents to be returned by the API
         * @returns {this}
         */
        mockContent(content) {
          return this.mockResponse({ content: global.btoa(content) });
        },
        /**
         * Mocks the requested file's contents for the next call. The contents
         * will be base64 encoded in the response.
         *
         * @param {string} content File contents to be returned by the API
         * @returns {this}
         */
        mockContentOnce(content) {
          this.mockResponseOnce({ content: global.btoa(content) });
        },
      }),
    };
  }
};
