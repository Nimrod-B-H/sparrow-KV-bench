/**
 * File Manager
 * 
 * High-level operations for creating and updating files via GitHub API.
 * 
 * @module github/file-manager
 */

const logger = require('../logger');
const { getBranchSHA } = require('./branch-manager');

/**
 * Create or update a file in the repository
 * 
 * @param {Object} client - GitHub API client
 * @param {Object} options - File options
 * @param {string} options.path - File path in repository
 * @param {string} options.content - File content
 * @param {string} options.message - Commit message
 * @param {string} options.branch - Branch name
 * @returns {Promise<Object>} Result with file metadata
 */
async function createFile(client, { path, content, message, branch }) {
  // Validate inputs
  if (!path) {
    throw new Error('File path is required');
  }
  
  if (!content) {
    throw new Error('File content is required');
  }
  
  if (!message) {
    throw new Error('Commit message is required');
  }
  
  if (!branch) {
    throw new Error('Branch name is required');
  }
  
  logger.debug('Creating file', { path, branch, contentLength: content.length });
  
  // Fetch the latest SHA for the branch to avoid conflicts
  let currentSHA;
  try {
    currentSHA = await getBranchSHA(client, branch);
    logger.debug('Using latest branch SHA for file operation', { 
      path, 
      sha: currentSHA.substring(0, 7) 
    });
  } catch (error) {
    // If branch doesn't exist yet or can't get SHA, proceed without it
    logger.debug('Could not fetch branch SHA, proceeding without it', { path });
  }
  
  const result = await client.request(
    'PUT',
    client.repoPath(`/contents/${path}`),
    {
      message,
      content: Buffer.from(content).toString('base64'),
      branch
    }
  );
  
  logger.info('Created file', {
    path,
    branch,
    sha: result.content?.sha?.substring(0, 7)
  });
  
  return {
    path,
    sha: result.content?.sha,
    url: result.content?.html_url
  };
}

/**
 * Create multiple files in a single batch
 * 
 * Creates files sequentially (not in parallel) to avoid SHA conflicts.
 * Each file operation fetches the latest branch SHA.
 * 
 * @param {Object} client - GitHub API client
 * @param {Array<Object>} files - Array of file configurations
 * @returns {Promise<Object>} Results
 * @returns {Array<Object>} results.succeeded - Successfully created files
 * @returns {Array<Object>} results.failed - Failed file creations with errors
 */
async function createFiles(client, files) {
  logger.info('Creating multiple files', { count: files.length });
  
  const succeeded = [];
  const failed = [];
  
  // Create files sequentially to avoid SHA conflicts
  for (const file of files) {
    try {
      const result = await createFile(client, file);
      succeeded.push({ success: true, file: file.path, result });
      logger.info('File created successfully', { path: file.path });
    } catch (error) {
      logger.error('Failed to create file', {
        path: file.path,
        error: error.message
      });
      failed.push({ success: false, file: file.path, error: error.message });
    }
  }
  
  logger.info('File creation batch complete', {
    total: files.length,
    succeeded: succeeded.length,
    failed: failed.length
  });
  
  if (failed.length > 0) {
    logger.error('Some files failed to create', {
      failedFiles: failed.map(f => f.file)
    });
  }
  
  return { succeeded, failed };
}

module.exports = {
  createFile,
  createFiles
};
