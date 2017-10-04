/**
 * If this bot is in dry run it executes no side effects
 */
const DRY_RUN = String(process.env.DRY_RUN);

/**
 * Returns whether the DRY_RUN flag was set in the environment
 *
 * The DRY_RUN flag switches the bot into a "pure" mode. It still
 * executes all paths and creates logs but will not execute side
 * effects. This prevents repository modifications and external API
 * calls.
 *
 * NOTE: GitHub API calls are still executed and may count towards
 * the quota.
 */
function isDryRun() {
  return DRY_RUN === 'true' || DRY_RUN === '1' || DRY_RUN === 'yes';
}

/**
 * Returns whether the DRY_RUN flag was absent in the environment
 *
 * The DRY_RUN flag switches the bot into a "pure" mode. It still
 * executes all paths and creates logs but will not execute side
 * effects. This prevents repository modifications and external API
 * calls.
 *
 * NOTE: GitHub API calls are still executed and may count towards
 * the quota.
 */
function shouldPerform() {
  return !isDryRun();
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

module.exports = {
  isDryRun,
  shouldPerform,
  isSorted,
};
