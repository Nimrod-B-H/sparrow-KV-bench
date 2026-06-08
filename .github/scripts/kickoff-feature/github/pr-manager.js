/**
 * Pull Request Manager
 * 
 * High-level operations for managing pull requests via GitHub API.
 * 
 * @module github/pr-manager
 */

const logger = require('../logger');

/**
 * Create a pull request
 * 
 * @param {Object} client - GitHub API client
 * @param {Object} options - PR options
 * @param {string} options.title - PR title
 * @param {string} options.head - Head branch name
 * @param {string} options.base - Base branch name
 * @param {string} options.body - PR body (markdown)
 * @returns {Promise<Object>} Created PR
 * @returns {number} result.number - PR number
 * @returns {string} result.url - PR HTML URL
 */
async function createPullRequest(client, { title, head, base, body }) {
  logger.debug('Creating pull request', { title, head, base });
  
  const pr = await client.request('POST', client.repoPath('/pulls'), {
    title,
    head,
    base,
    body
  });
  
  logger.info('Created pull request', {
    number: pr.number,
    url: pr.html_url
  });
  
  return {
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    state: pr.state
  };
}

/**
 * Add labels to a pull request
 * 
 * @param {Object} client - GitHub API client
 * @param {number} prNumber - PR number
 * @param {Array<string>} labels - Labels to add
 * @returns {Promise<void>}
 */
async function addLabels(client, prNumber, labels) {
  if (!labels || labels.length === 0) {
    logger.debug('No labels to add');
    return;
  }
  
  logger.debug('Adding labels to PR', { prNumber, labels });
  
  await client.request(
    'POST',
    client.repoPath(`/issues/${prNumber}/labels`),
    { labels }
  );
  
  logger.info('Added labels to PR', { prNumber, labels });
}

/**
 * Create a PR and add labels in one operation
 * 
 * @param {Object} client - GitHub API client
 * @param {Object} prOptions - PR creation options
 * @param {Array<string>} labels - Labels to add
 * @returns {Promise<Object>} Created PR with labels
 */
async function createPullRequestWithLabels(client, prOptions, labels) {
  const pr = await createPullRequest(client, prOptions);
  
  if (labels && labels.length > 0) {
    await addLabels(client, pr.number, labels);
  }
  
  return pr;
}

module.exports = {
  createPullRequest,
  addLabels,
  createPullRequestWithLabels
};
