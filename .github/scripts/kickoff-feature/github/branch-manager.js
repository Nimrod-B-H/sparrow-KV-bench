/**
 * Branch Manager
 * 
 * High-level operations for managing Git branches via GitHub API.
 * 
 * @module github/branch-manager
 */

const logger = require('../logger');

/**
 * Get the default branch SHA
 * 
 * @param {Object} client - GitHub API client
 * @returns {Promise<Object>} Branch info
 * @returns {string} result.name - Default branch name (e.g., 'main')
 * @returns {string} result.sha - Commit SHA
 */
async function getDefaultBranch(client) {
  logger.debug('Fetching default branch');
  
  const repoData = await client.request('GET', client.repoPath(''));
  const defaultBranch = repoData.default_branch;
  
  const refData = await client.request(
    'GET',
    client.repoPath(`/git/ref/heads/${defaultBranch}`)
  );
  
  const result = {
    name: defaultBranch,
    sha: refData.object.sha
  };
  
  logger.info('Retrieved default branch', result);
  
  return result;
}

/**
 * Create a new branch
 * 
 * Idempotent: succeeds if branch already exists.
 * 
 * @param {Object} client - GitHub API client
 * @param {string} branchName - Name of branch to create
 * @param {string} baseSha - Base commit SHA
 * @returns {Promise<Object>} Result
 * @returns {boolean} result.created - True if newly created, false if already existed
 * @returns {string} result.branchName - Branch name
 */
async function createBranch(client, branchName, baseSha) {
  try {
    await client.request('POST', client.repoPath('/git/refs'), {
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });
    
    logger.info('Created branch', { branchName, baseSha: baseSha.substring(0, 7) });
    
    return {
      created: true,
      branchName
    };
    
  } catch (error) {
    // Branch already exists (422 Unprocessable Entity)
    if (error.statusCode === 422 && error.message.includes('Reference already exists')) {
      logger.warn('Branch already exists, continuing', { branchName });
      
      return {
        created: false,
        branchName
      };
    }
    
    // Other error, rethrow
    throw error;
  }
}

/**
 * Get the latest commit SHA for a branch
 * 
 * @param {Object} client - GitHub API client
 * @param {string} branchName - Name of branch
 * @returns {Promise<string>} Current commit SHA
 */
async function getBranchSHA(client, branchName) {
  logger.debug('Fetching latest branch SHA', { branchName });
  
  const refData = await client.request(
    'GET',
    client.repoPath(`/git/ref/heads/${branchName}`)
  );
  
  const sha = refData.object.sha;
  logger.debug('Retrieved branch SHA', { branchName, sha: sha.substring(0, 7) });
  
  return sha;
}

/**
 * Check if a branch exists
 * 
 * @param {Object} client - GitHub API client
 * @param {string} branchName - Name of branch to check
 * @returns {Promise<boolean>} True if branch exists
 */
async function branchExists(client, branchName) {
  try {
    await client.request('GET', client.repoPath(`/git/ref/heads/${branchName}`));
    return true;
  } catch (error) {
    if (error.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

module.exports = {
  getDefaultBranch,
  createBranch,
  branchExists,
  getBranchSHA
};
