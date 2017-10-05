const fs = require('fs');
const os = require('os');
const path = require('path');
const rimrafCallback = require('rimraf');
const util = require('util');

const lstat = util.promisify(fs.lstat);
const mkdtemp = util.promisify(fs.mkdtemp);
const readdir = util.promisify(fs.readdir);
const rimraf = util.promisify(rimrafCallback);

/**
 * Asynchronously calls the predicate on every element of the array and filters
 * for all elements where the predicate resolves to true.
 *
 * @param {Array} array An array to filter
 * @param {Function} predicate A predicate function that resolves to a boolean
 * @param {any} args Any further args passed to the predicate
 */
async function filterAsync(array, predicate, ...args) {
  const verdicts = await Promise.all(array.map(predicate, ...args));
  return array.filter((element, index) => verdicts[index]);
}

async function listFiles(directory) {
  const files = await readdir(directory);
  const paths = files.map(name => path.join(directory, name));
  return filterAsync(paths, async (filePath) => {
    const stats = await lstat(filePath);
    return stats.isFile();
  });
}

/**
 * Execute an asynchronous callback within a temp directory
 *
 * Automatically removes the directory and all contents when the callback
 * finishes or throws.
 *
 * @param {Function} callback A callback that receives the directory path
 * @returns {Promise<any>} The return value of the callback
 * @async
 */
async function withTempDir(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 's3-'));
  try {
    return await callback(directory);
  } finally {
    await rimraf(directory);
  }
}

module.exports = {
  listFiles,
  withTempDir,
};
