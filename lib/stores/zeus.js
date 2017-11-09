const { createWriteStream } = require('fs');
const { join } = require('path');
const request = require('request');

/**
 * API token to access Zeus
 */
const { ZEUS_API_TOKEN } = process.env;

/**
 * Server URL for Zeus
 */
const ZEUS_SERVER_URL = process.env.ZEUS_SERVER_URL || 'https://zeus.ci';

/**
 * A store implementation for Zeus
 *
 * @param {object} commit A repository and commit to lookup
 * @param {string} downloadDirectory Path to a local cache directory
 * @param {object} logger An optional logger
 * @returns {object} The store bound to the commit
 */
module.exports = (commit, downloadDirectory, logger = console) => {
  const downloadCache = {};
  let fileCache = null;

  /**
   * Downloads a file from the store
   *
   * The file is placed in the download directory. It is only downloaded once
   * when invoked multiple times. If the file does not exist, an error is
   * thrown. Use {@link listFiles} to retrieve available files.
   *
   * @param {object} file A file object to download
   * @returns {Promise<string>} Absolute path to the local copy of the file
   * @async
   */
  function downloadFile(file) {
    const cached = downloadCache[file.key];
    if (cached) {
      return cached;
    }

    logger.debug(`Downloading Zeus file ${file.key} to ${downloadDirectory}`);

    const localFile = join(downloadDirectory, file.name);
    const stream = request.get(file.url, { auth: { bearer: ZEUS_API_TOKEN } })
      .pipe(createWriteStream(localFile));

    const promise = new Promise((resolve, reject) => {
      // NOTE: The timeout is necessary to be able to list files immediately
      stream.on('finish', () => setTimeout(() => resolve(localFile), 100));
      stream.on('error', reject);
    });

    downloadCache[file.key] = promise;
    return promise;
  }

  /**
   * Downloads a list of files from the store
   *
   * The files are placed in the download directory. Each file is only
   * downloaded once when invoked multiple times. If one of the files
   * does not exist, an error is thrown. Use {@link listFiles} to
   * retrieve available files.
   *
   * @param {object[]} files A list of files to download
   * @returns {Promise<string[]>} Absolute paths to local copies of all files
   * @async
   */
  function downloadFiles(files) {
    return Promise.all(files.map(file => downloadFile(file)));
  }

  /**
   * Retrieves a list of files stored for the commit
   *
   * The list is only loaded once if invoked multiple times.
   *
   * @returns {Promise<object[]>} A list of file objects
   * @async
   */
  function listFiles() {
    if (fileCache != null) {
      return fileCache;
    }

    const { owner, repo, sha } = commit;
    const url = `${ZEUS_SERVER_URL}/api/repos/gh/${owner}/${repo}/releases/${sha}/artifacts`;
    const auth = { bearer: ZEUS_API_TOKEN };

    fileCache = new Promise((resolve, reject) => {
      request(url, { auth }, (error, response, body) => {
        if (error) {
          reject(error);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Request failed with status code ${request.statusCode}`));
          return;
        }

        const artifacts = JSON.parse(body).map(artifact => ({
          name: artifact.name,
          type: artifact.type,
          url: artifact.download_url,
        }));

        resolve(artifacts);
      });
    });

    return fileCache;
  }

  /**
   * Downloads all files stored for the commit
   *
   * Retrieves the full list of artifacts from Zeus and stores them in the
   * download directory. Each file is only downloaded once when invoked
   * multiple times.
   *
   * @returns {Promise<string[]>} Absolute paths to local copies of all files
   * @async
   */
  async function downloadAll() {
    const files = await listFiles();
    return downloadFiles(files);
  }

  /**
   * Returns all capabilities of this store provider.
   *
   * @returns {object} The capabilities object
   */
  function getCapabilities() {
    return {
      TYPE: true,
    };
  }

  return {
    downloadAll,
    downloadFile,
    downloadFiles,
    listFiles,
    getCapabilities,
  };
};
