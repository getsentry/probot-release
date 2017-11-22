const child = require('child_process');
const _ = require('lodash');
const split = require('split');

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
 * Asynchronously calls the iteratee on each element of the array one element at
 * a time. This results in a chain of asynchronous actions that resolves once
 * the last item action has completed. In contrast, `Promise.all` exectues each
 * promise simultaneously.
 *
 * The iteratee is invoked as with `Array.forEach`: It receives the current
 * element, index and the array. This is bound to `thisArg` if present.
 *
 * @param {Array} array An array to iterate over
 * @param {Function} iteratee An action function that receives the element
 * @param {any} thisArg  Optional argument passed as this to the action
 * @returns {Promise} Resolves when the last action has completed
 * @async
 */
async function forEachChained(array, iteratee, thisArg) {
  return array.reduce(
    (prev, ...args) => prev.then(() => iteratee.apply(thisArg, args)),
    Promise.resolve(),
    thisArg
  );
}

/**
 * Returns a promise that resolves when each value of the given object resolves.
 * Works just like `Promise.all`, just on objects.
 *
 * @param {object} object An object with one or more
 * @returns {Promise<object>} A promise that resolves with each value
 * @async
 */
async function promiseProps(object) {
  const pairs = _.toPairs(object).map(async ([key, value]) => [
    key,
    await value,
  ]);

  return _.fromPairs(await Promise.all(pairs));
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

  return array.every(
    (element, index) => index === 0 || ordered(array[index - 1], element)
  );
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
 * @param {object} logger A logger to pipe stdout and stderr to
 * @returns {Promise<Buffer>} A promise that resolves to the standard output when
 *                            the child process exists
 * @async
 */
function spawn(command, args, options, logger) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    // NOTE: On Linux, stdout and stderr might flush immediately after the
    // process exists. By adding a 0 timeout, we can make sure that the promise
    // is not resolved before both pipes have finished.
    const succeed = () => setTimeout(() => resolve(Buffer.concat(chunks)), 0);
    const fail = e => reject(processError(e.code, command, args, options));

    try {
      const process = child
        .spawn(command, args, options)
        .on('exit', code => (code === 0 ? succeed() : fail({ code })))
        .on('error', error => fail(error));

      process.stdout.on('data', chunk => chunks.push(chunk));

      if (logger) {
        process.stdout
          .pipe(split())
          .on('data', data => logger.debug(`${command}: ${data}`));
        process.stderr
          .pipe(split())
          .on('data', data => logger.debug(`${command}: ${data}`));
      }
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  promiseProps,
  cloneContext,
  filterAsync,
  forEachChained,
  getFile,
  isSorted,
  spawn,
};
