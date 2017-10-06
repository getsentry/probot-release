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

module.exports = {
  isSorted,
  cloneContext,
};
