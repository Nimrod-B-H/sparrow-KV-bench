/**
 * Error Handler
 * 
 * Centralized error handling with graceful degradation.
 * Posts fallback comments to GitHub issues when automation fails.
 * 
 * @module error-handler
 */

const logger = require('./logger');
const { generateFailureComment } = require('./templates/issue-comment');

/**
 * Handle automation error and post fallback comment
 * 
 * @param {Error} error - The error that occurred
 * @param {Object} context - Error context
 * @param {Object} context.client - GitHub API client (optional)
 * @param {number} context.issueNumber - Issue number to comment on
 * @param {string} context.issueTitle - Issue title for fallback template
 * @returns {Promise<void>}
 */
async function handleError(error, context) {
  const { client, issueNumber, issueTitle } = context;
  
  logger.error('Automation failed', {
    error: error.message,
    stack: error.stack,
    issueNumber
  });
  
  // Try to post fallback comment to issue
  if (client && issueNumber && issueTitle) {
    try {
      const fallbackComment = generateFailureComment({
        issueTitle,
        errorMessage: error.message
      });
      
      logger.info('Attempting to post fallback comment to issue');
      
      await client.request(
        'POST',
        client.repoPath(`/issues/${issueNumber}/comments`),
        { body: fallbackComment }
      );
      
      logger.info('Successfully posted fallback comment');
      
    } catch (commentError) {
      logger.error('Failed to post fallback comment', {
        error: commentError.message
      });
    }
  } else {
    logger.warn('Cannot post fallback comment - missing client or issue context');
  }
}

/**
 * Categorize error type for better error messages
 * 
 * @param {Error} error - Error to categorize
 * @returns {string} Error category
 */
function categorizeError(error) {
  if (error.message.includes('Could not extract')) {
    return 'PARSING_ERROR';
  }
  
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return 'API_CLIENT_ERROR';
  }
  
  if (error.statusCode >= 500) {
    return 'API_SERVER_ERROR';
  }
  
  if (error.message.includes('validation failed')) {
    return 'VALIDATION_ERROR';
  }
  
  if (error.message.includes('Network error')) {
    return 'NETWORK_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * Create a user-friendly error message
 * 
 * @param {Error} error - Original error
 * @returns {string} User-friendly message
 */
function getUserFriendlyMessage(error) {
  const category = categorizeError(error);
  
  const messages = {
    PARSING_ERROR: 'Unable to parse AI response. The format may have changed.',
    API_CLIENT_ERROR: 'GitHub API request failed. Please check permissions and try again.',
    API_SERVER_ERROR: 'GitHub API is experiencing issues. Please try again later.',
    VALIDATION_ERROR: 'Configuration validation failed. Please check environment variables.',
    NETWORK_ERROR: 'Network connection error. Please check connectivity.',
    UNKNOWN_ERROR: 'An unexpected error occurred.'
  };
  
  return messages[category] || messages.UNKNOWN_ERROR;
}

module.exports = {
  handleError,
  categorizeError,
  getUserFriendlyMessage
};
