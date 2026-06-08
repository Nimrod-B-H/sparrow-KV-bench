/**
 * GitHub API Client
 * 
 * Low-level abstraction for making GitHub API requests.
 * Includes retry logic, error handling, and rate limit awareness.
 * 
 * @module github/github-client
 */

const https = require('https');
const logger = require('../logger');

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a GitHub API request with retry logic
 * 
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} options.path - API path (e.g., '/repos/owner/repo/issues')
 * @param {Object} options.body - Request body (will be JSON stringified)
 * @param {string} options.token - GitHub API token
 * @param {Object} options.retryConfig - Retry configuration (optional)
 * @returns {Promise<Object>} Response data (parsed JSON)
 * @throws {Error} If request fails after all retries
 */
async function githubRequest({
  method,
  path,
  body = null,
  token,
  retryConfig = DEFAULT_RETRY_CONFIG
}) {
  const { maxRetries, retryDelayMs, retryableStatuses } = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig
  };
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`GitHub API ${method} ${path}`, { attempt, maxRetries });
      
      const response = await makeRequest(method, path, body, token);
      
      logger.debug(`GitHub API ${method} ${path} succeeded`, {
        status: response.status,
        attempt
      });
      
      return response.data;
      
    } catch (error) {
      lastError = error;
      
      const shouldRetry = 
        attempt < maxRetries && 
        retryableStatuses.includes(error.statusCode);
      
      if (shouldRetry) {
        const delay = retryDelayMs * attempt; // Exponential backoff
        logger.warn(`GitHub API ${method} ${path} failed, retrying...`, {
          attempt,
          statusCode: error.statusCode,
          retryIn: `${delay}ms`,
          error: error.message
        });
        
        await sleep(delay);
        continue;
      }
      
      // Don't retry, throw immediately
      break;
    }
  }
  
  // All retries exhausted
  logger.error(`GitHub API ${method} ${path} failed after ${maxRetries} attempts`, {
    error: lastError.message,
    statusCode: lastError.statusCode
  });
  
  throw lastError;
}

/**
 * Make a single GitHub API request (no retry)
 * 
 * @private
 */
function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'kickoff-feature-automation',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Parse response
        let parsedData;
        try {
          parsedData = data ? JSON.parse(data) : {};
        } catch (e) {
          parsedData = { raw: data };
        }
        
        // Check for errors
        if (res.statusCode >= 400) {
          const error = new Error(
            `GitHub API ${method} ${path} failed with status ${res.statusCode}: ${
              parsedData.message || data
            }`
          );
          error.statusCode = res.statusCode;
          error.response = parsedData;
          reject(error);
          return;
        }
        
        resolve({
          status: res.statusCode,
          data: parsedData
        });
      });
    });
    
    req.on('error', (error) => {
      const enrichedError = new Error(`Network error: ${error.message}`);
      enrichedError.originalError = error;
      reject(enrichedError);
    });
    
    if (payload) {
      req.write(payload);
    }
    
    req.end();
  });
}

/**
 * Create a GitHub API client instance
 * 
 * @param {Object} config - Client configuration
 * @param {string} config.token - GitHub API token
 * @param {string} config.owner - Repository owner
 * @param {string} config.repo - Repository name
 * @returns {Object} Client with bound request method
 */
function createGitHubClient({ token, owner, repo }) {
  if (!token) {
    throw new Error('GitHub token is required');
  }
  
  if (!owner || !repo) {
    throw new Error('Repository owner and name are required');
  }
  
  return {
    /**
     * Make a request with repository context
     */
    request: (method, path, body, retryConfig) => {
      return githubRequest({ method, path, body, token, retryConfig });
    },
    
    /**
     * Repository-scoped path helper
     */
    repoPath: (path) => `/repos/${owner}/${repo}${path}`,
    
    // Expose config
    owner,
    repo,
    token
  };
}

module.exports = {
  createGitHubClient,
  githubRequest
};
