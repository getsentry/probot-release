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
 * Asynchronously traverses all files in a directory
 *
 * Skips symlinks and subfolders. Resolves when all iterees have resolved.
 * Invokes the iteratee with the full path and the file name.
 *
 * @param {string} directory A directory to traverse
 * @param {Function} iteratee A callback invoked for every file
 * @returns {Promise<any[]>} The return values of the iteratees
 * @async
 */
async function forEachFile(directory, iteratee) {
  const files = await readdir(directory);
  return Promise.all(files.map(async (name) => {
    const filePath = path.join(directory, name);
    const stats = await lstat(filePath);
    return stats.isFile()
      ? iteratee(filePath, name)
      : null;
  }));
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
  forEachFile,
  withTempDir,
};
