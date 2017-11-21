const { shouldPerform } = require('dryrun');
const _ = require('lodash');
const fetch = require('node-fetch');
const tar = require('tar');
const { withTempDir } = require('../files');
const { forEachChained, spawn } = require('../utils');

/**
 * Command to launch Rustup's cargo
 */
const CARGO_BIN = process.env.CARGO_BIN || 'cargo';

/**
 * @typedef {object} Dependency A package dependency specification
 * @prop {string} name Unique name of the package
 * @prop {string} req The required version range
 */

/**
 * @typedef {object} Package A cargo package
 * @prop {string} id Unique identifier containing name, version and location
 * @prop {string} name The unique name of the cargo package
 * @prop {string} version The current version of this package
 * @prop {string} manifest_path Path to the manifest in the local workspace
 * @prop {Dependency[]} dependencies The full list of package dependencies
 */

/**
 * @typedef {object} MetaData Metadata on the current cargo workspace
 * @prop {Package[]} packages The full list of packages in this workspace
 * @prop {string[]} workspace_members IDs of the packages in this workspace
 */

/**
 * Downloads the entire repository contents of the tag
 *
 * The contents are compressed into a tarball and returned in a buffer that can
 * be streamed for extraction.
 *
 * @param {Context} context Enriched Github context
 * @returns {Promise<Stream>} The tarball data as stream
 * @async
 */
async function downloadSources(context) {
  const { owner, repo } = context.repo();
  const { ref, sha } = context.tag;

  context.logger.info(`Downloading sources for ${owner}/${repo}:${sha}`);
  const url = `https://github.com/${owner}/${repo}/archive/${ref}.tar.gz`;
  const response = await fetch(url);
  return response.body;
}

/**
 * Extracts a source code tarball in the specified directory
 *
 * The tarball should contain a top level directory that contains all source
 * files. The contents of that directory are directly extracted into the `cwd`
 * location.
 *
 * @param {Stream} stream A stream containing the source tarball
 * @param {string} cwd Path to the directory to extract in
 * @returns {Promise} A promise that resolves when the tarball has been extracted
 * @async
 */
function extractSources(stream, cwd) {
  return new Promise(resolve => {
    stream
      .pipe(tar.extract({ strip: 1, cwd }))
      .on('finish', () => setTimeout(resolve, 100));
  });
}

/**
 * Downloads source code of the Github repository and puts it in the specified
 * directory
 *
 * @param {Context} context Enriched Github context
 * @param {string} directory A directory to extract to
 * @returns {Promise} A promise that resolves when the sources are ready
 * @async
 */
async function downloadAndExtract(context, directory) {
  const stream = await downloadSources(context);
  context.logger.info(`Extracting sources to ${directory}`);
  return extractSources(stream, directory);
}

/**
 * Resolves cargo metadata for the project located in the specified directory
 *
 * Cargo metadata comprises the name and version of the root package, as well as
 * a flat list of its local dependencies and their respective versions. The full
 * list of dependencies is not included in this metadata.
 *
 * @param {string} directory
 * @returns {Promise<MetaData>} An object containing cargo metadata
 * @async
 */
async function getCargoMetadata(directory) {
  const json = await spawn(CARGO_BIN, [
    'metadata',
    '--manifest-path',
    `${directory}/Cargo.toml`,
    '--no-deps',
    '--format-version=1',
  ]);

  return JSON.parse(json);
}

/**
 * Determines the topological order in which to publish crates
 *
 * The order is determined by the dependency graph. In order to publish a crate,
 * all its dependencies have to be available on the index first. Therefore, this
 * method performs a topological sort of the list of given packages.
 *
 * Note that the actual order of packages in the result is indeterministic.
 * However, the topological order will always be consistent.
 *
 * @param {Package[]} packages A list of cargo packages (i.e. crates)
 * @returns {Package[]} The sorted list of packages
 */
function getPublishOrder(packages) {
  const remaining = _.keyBy(packages, p => p.name);
  const ordered = [];

  // We iterate until there are no packages left. Note that cargo will already
  // check for cycles in the dependency graph and fail if its not a DAG.
  while (!_.isEmpty(remaining)) {
    _.filter(
      remaining,
      // Find all packages with no remaining workspace dependencies
      p => p.dependencies.filter(dep => remaining[dep.name]).length === 0
    ).forEach(next => {
      ordered.push(next);
      delete remaining[next.name];
    });
  }

  return ordered;
}

/**
 * Publishes the given package on crates.io
 *
 * @param {Context} context Enriched Github context
 * @param {Package} crate A cargo package to publish
 * @returns {Promise} A promise that resolves when the package has been published
 * @async
 */
async function publishPackage(context, crate) {
  const { logger } = context;

  logger.info(`Releasing crate ${crate.name} version ${crate.version}`);
  const args = ['publish', '--manifest-path', crate.manifest_path];
  const env = _.pick(process.env, ['PATH', 'CARGO_REGISTRY_TOKEN']);
  return shouldPerform() && spawn(CARGO_BIN, args, { env });
}

/**
 * Publishes an entire workspace on crates.io
 *
 * If the workspace contains multiple packages with dependencies, they are
 * published in topological order. This ensures that once a package has been
 * published, all its requirements are available on the index as well.
 *
 * @param {Context} context Enriched Github context
 * @param {string} directory The path to the root package
 * @returns {Promise} A promise that resolves when the workspace has been published
 * @async
 */
async function publishWorkspace(context, directory) {
  context.logger.info(`Loading workspace information in ${directory}`);
  const metadata = await getCargoMetadata(directory);
  const packages = metadata.packages.filter(p =>
    metadata.workspace_members.includes(p.id)
  );

  const crates = getPublishOrder(packages);
  return forEachChained(crates, crate => publishPackage(context, crate));
}

/**
 * Pushes a cargo package or workspace on crates.io
 *
 * @param {Context} context Enriched Github context
 * @returns {Promise} A promise that resolves when the release has finished
 * @async
 */
module.exports = async context => {
  const { logger } = context;

  if (!process.env.CARGO_REGISTRY_TOKEN) {
    logger.warn('Skipping cargo release due to missing token');
    return;
  }

  await withTempDir(async directory => {
    await downloadAndExtract(context, directory);
    await publishWorkspace(context, directory);
    logger.info(`Cargo release completed`);
  });
};
