const child = require('child_process');

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
 * Creates an error object and attaches the error code
 *
 * @param {number} code A non-zero error code
 * @returns {Error} The error with code
 */
function exitCodeError(code) {
  const error = new Error(`Process exited with code ${code}`);
  error.code = code;
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
    const process = child.spawn(command, args, options);
    process.on('exit', code => (code === 0 ? resolve() : reject(exitCodeError(code))));
    process.on('error', reject);
  });
}

module.exports = {
  isSorted,
  cloneContext,
  spawn,
};
