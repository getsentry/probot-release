const { basename, join } = require('path');
const s3 = require('s3');

const {
  /**
   * Access key for AWS S3
   */
  S3_ACCESS_KEY,

  /**
   * Access secret key for AWS S3
   */
  S3_SECRET_KEY,

  /**
   * AWS S3 bucket containing build assets
   */
  S3_BUCKET,
} = process.env;

/**
 * AWS S3 client used to retrieve assets
 */
const client = s3.createClient({
  s3Options: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
});

/**
 * A store implementation for Amazon S3
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

    logger.debug(`Downloading S3 file ${file.key} to ${downloadDirectory}`);
    const localFile = join(downloadDirectory, file.name);
    const downloader = client.downloadFile({
      localFile,
      s3Params: {
        Bucket: S3_BUCKET,
        Key: file.key,
      },
    });

    const promise = new Promise((resolve, reject) => {
      // NOTE: The timeout is necessary to be able to list files immediately
      downloader.on('end', () => setTimeout(() => resolve(localFile), 100));
      downloader.on('error', reject);
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
   * Maps an Amazon S3 object to a file object
   *
   * @param {object} entry An Amazon object entry
   * @returns {object} A file object
   */
  function mapEntry(entry) {
    return {
      key: entry.Key,
      name: basename(entry.Key),
    };
  }

  /**
   * Retrieves a list of files stored for the commit
   *
   * Searches for all files stored in the configured S3 bucket in a folder
   * named after the repository and commit. If the folder is not found, an
   * error is thrown.
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
    const s3Path = `${owner}/${repo}/${sha}/`;
    logger.debug(`Loading list of S3 files in ${s3Path}`);

    const job = client.listObjects({
      s3Params: {
        Bucket: S3_BUCKET,
        Prefix: s3Path,
      },
    });

    const entries = [];
    fileCache = new Promise((resolve, reject) => {
      job.on('data', data => entries.push(...data.Contents));
      job.on('end', () => resolve(entries.map(mapEntry)));
      job.on('error', reject);
    });

    return fileCache;
  }

  /**
   * Downloads all files stored for the commit
   *
   * Searches for all files stored in the configured S3 bucket and
   * downloads them to the download directory. Each file is only
   * downloaded once when invoked multiple times.
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
      TYPE: false,
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
