const child = require('child_process');

/**
 * Asynchronously calls the predicate on every element of the array and filters
 * for all elements where the predicate resolves to true.
 *
 * @param {Array} array An array to filter
 * @param {Function} predicate A predicate function that resolves to a boolean
 * @param {any} thisArg Optional argument passed as this to the predicate
 * @returns {Promise<Array>} The filtered array
 * @async
 */
async function filterAsync(array, predicate, thisArg) {
  const verdicts = await Promise.all(array.map(predicate, thisArg));
  return array.filter((element, index) => verdicts[index]);
}

/**
 * Loads a file from the context's repository
 *
 * @param {Context} context Github context
 * @param {string} path The path of the file in the repository
 * @param {string} ref The string name of commit / branch / tag
 * @returns {Promise<string>} The decoded file contents
 * @async
 */
async function getFile(context, path, ref) {
  const params = context.repo({ path, ref });
  try {
    const response = await context.github.repos.getContent(params);
    return Buffer.from(response.data.content, 'base64').toString();
  } catch (err) {
    if (err.code === 404) {
      return null;
    }

    throw err;
  }
}

/**
 * Checks whether the given element is sorted
 *
 * @param {array} array An array containing potentially sorted elements
 * @param {bool} descending Whether to check for descending sort order
 */
function isSorted(array, descending = false) {
  const ordered = descending
    ? (prev, next) => prev >= next
    : (prev, next) => prev <= next;

  return array.every((element, index) => (index === 0) || ordered(array[index - 1], element));
}

/**
 * Clones the given github context and attaches parameters to it
 *
 * @param {Context} context Github context
 * @param {object} params Optional params to assign to the new context
 * @returns {Context} A cloned instance of the context with additional parameters
 */
function cloneContext(context, params = {}) {
  return Object.assign(new context.constructor(), context, params);
}

/**
 * Strips env values from the options object
 *
 * @param {object} options Optional options passed to spawn
 */
function stripEnv(options = {}) {
  const override = options.env && { env: Object.keys(options.env) };
  return Object.assign({}, options, override);
}

/**
 * Creates an error object and attaches the error code
 *
 * @param {number|string} code A non-zero error code
 * @param {string} command The command to run
 * @param {string[]} args Optional arguments to pass to the command
 * @param {object} options Optional options to pass to child_process.spawn
 * @returns {Error} The error with code
 */
function processError(code, command, args, options) {
  const error = new Error(`Process "${command}" errored with code ${code}`);
  error.code = code;
  error.args = args;
  error.options = stripEnv(options);
  return error;
}

/**
 * Asynchronously spawns a child process
 *
 * @param {string} command The command to run
 * @param {string[]} args Optional arguments to pass to the command
 * @param {object} options Optional options to pass to child_process.spawn
 * @returns {Promise} A promise that resolves when the child process exists
 * @async
 */
function spawn(command, args, options) {
  return new Promise((resolve, reject) => {
    try {
      const process = child.spawn(command, args, options);
      process.on('exit', code => (code === 0 ? resolve() : reject(processError(code, command, args, options))));
      process.on('error', error => reject(processError(error.code, command, args, options)));
    } catch (error) {
      reject(processError(error.code, command, args, options));
    }
  });
}

module.exports = {
  cloneContext,
  filterAsync,
  getFile,
  isSorted,
  spawn,
};
