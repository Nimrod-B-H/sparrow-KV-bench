/**
 * Feature Name Parser Module
 * 
 * Pure functions for extracting feature names from file paths
 * and generating branch names from issue metadata.
 * 
 * @module parsers/feature-name-parser
 */

/**
 * Extract feature name from feature file path
 * 
 * Handles two path formats:
 * - specs/feature-name/feature-name.feature (nested)
 * - specs/feature-name.feature (flat)
 * 
 * @param {string} featureFilePath - Path to feature file
 * @returns {string} Feature name (e.g., 'user-authentication')
 * @throws {Error} If feature name cannot be extracted
 * 
 * @example
 * extractFeatureName('specs/user-auth/user-auth.feature')
 * // Returns: 'user-auth'
 * 
 * extractFeatureName('specs/simple-feature.feature')
 * // Returns: 'simple-feature'
 */
function extractFeatureName(featureFilePath) {
  if (!featureFilePath || typeof featureFilePath !== 'string') {
    throw new Error('Feature file path must be a non-empty string');
  }
  
  // Try nested path format: specs/feature-name/feature-name.feature
  const nestedMatch = featureFilePath.match(/specs\/([^\/]+)\//);
  if (nestedMatch) {
    return nestedMatch[1];
  }
  
  // Try flat path format: specs/feature-name.feature
  const flatMatch = featureFilePath.match(/specs\/([^\/]+)\.feature$/);
  if (flatMatch) {
    return flatMatch[1];
  }
  
  throw new Error(
    `Cannot extract feature name from path: ${featureFilePath}. ` +
    `Expected format: 'specs/feature-name/...' or 'specs/feature-name.feature'`
  );
}

/**
 * Build a branch name from issue metadata
 * 
 * Format: feature/issue-{number}-{slug}
 * Where slug is the sanitized issue title (lowercase, hyphens, max 50 chars)
 * 
 * @param {number} issueNumber - GitHub issue number
 * @param {string} issueTitle - GitHub issue title
 * @returns {string} Branch name (e.g., 'feature/issue-42-add-user-authentication')
 * 
 * @example
 * buildBranchName(42, 'Add User Authentication')
 * // Returns: 'feature/issue-42-add-user-authentication'
 * 
 * buildBranchName(123, 'Fix: Bug with special@chars!')
 * // Returns: 'feature/issue-123-fix-bug-with-special-chars'
 */
function buildBranchName(issueNumber, issueTitle, maxSlugLength = 50) {
  if (typeof issueNumber !== 'number' || issueNumber <= 0) {
    throw new Error(`Issue number must be a positive number, got: ${issueNumber}`);
  }
  
  if (!issueTitle || typeof issueTitle !== 'string') {
    throw new Error('Issue title must be a non-empty string');
  }
  
  // Sanitize title: lowercase, replace non-alphanumeric with hyphens, trim leading/trailing hyphens
  const slug = issueTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, maxSlugLength);
  
  return `feature/issue-${issueNumber}-${slug}`;
}

module.exports = {
  extractFeatureName,
  buildBranchName
};
