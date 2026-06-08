/**
 * Issue Manager
 * 
 * High-level operations for managing issues via GitHub API.
 * 
 * @module github/issue-manager
 */

const logger = require('../logger');

/**
 * Post a comment on an issue
 * 
 * @param {Object} client - GitHub API client
 * @param {number} issueNumber - Issue number
 * @param {string} body - Comment body (markdown)
 * @returns {Promise<Object>} Created comment
 * @returns {number} result.id - Comment ID
 * @returns {string} result.url - Comment HTML URL
 */
async function postComment(client, issueNumber, body) {
  if (!body) {
    throw new Error('Comment body is required');
  }
  
  logger.debug('Posting comment to issue', { issueNumber, bodyLength: body.length });
  
  const comment = await client.request(
    'POST',
    client.repoPath(`/issues/${issueNumber}/comments`),
    { body }
  );
  
  logger.info('Posted comment to issue', {
    issueNumber,
    commentId: comment.id,
    url: comment.html_url
  });
  
  return {
    id: comment.id,
    url: comment.html_url
  };
}

/**
 * Update issue with labels
 * 
 * @param {Object} client - GitHub API client
 * @param {number} issueNumber - Issue number
 * @param {Array<string>} labels - Labels to add
 * @returns {Promise<void>}
 */
async function addLabels(client, issueNumber, labels) {
  if (!labels || labels.length === 0) {
    logger.debug('No labels to add to issue');
    return;
  }
  
  logger.debug('Adding labels to issue', { issueNumber, labels });
  
  await client.request(
    'POST',
    client.repoPath(`/issues/${issueNumber}/labels`),
    { labels }
  );
  
  logger.info('Added labels to issue', { issueNumber, labels });
}

module.exports = {
  postComment,
  addLabels
};
