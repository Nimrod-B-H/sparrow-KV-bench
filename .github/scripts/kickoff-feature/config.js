/**
 * Configuration Module
 * 
 * Centralized configuration and environment variable validation.
 * Provides a single source of truth for all configuration values.
 * 
 * @module config
 */

/**
 * Validates and returns configuration from environment variables
 * 
 * @throws {Error} If required environment variables are missing or invalid
 * @returns {Object} Validated configuration object
 */
function getConfig() {
  const errors = [];
  
  // Required environment variables
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const issueNumber = process.env.ISSUE_NUMBER;
  const issueTitle = process.env.ISSUE_TITLE;
  
  // Validate required variables
  if (!token) {
    errors.push('GITHUB_TOKEN is required');
  }
  
  if (!repository) {
    errors.push('GITHUB_REPOSITORY is required');
  }
  
  if (!issueNumber) {
    errors.push('ISSUE_NUMBER is required');
  }
  
  if (!issueTitle) {
    errors.push('ISSUE_TITLE is required (can be empty string)');
  }
  
  // Parse repository
  let owner, repo;
  if (repository) {
    const parts = repository.split('/');
    if (parts.length !== 2) {
      errors.push(`GITHUB_REPOSITORY must be in format 'owner/repo', got: ${repository}`);
    } else {
      [owner, repo] = parts;
    }
  }
  
  // Parse issue number
  let parsedIssueNumber;
  if (issueNumber) {
    parsedIssueNumber = parseInt(issueNumber, 10);
    if (isNaN(parsedIssueNumber) || parsedIssueNumber <= 0) {
      errors.push(`ISSUE_NUMBER must be a positive integer, got: ${issueNumber}`);
    }
  }
  
  // Throw if any errors
  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n  - ${errors.join('\n  - ')}`
    );
  }
  
  return {
    // GitHub authentication
    github: {
      token,
      owner,
      repo,
      repository
    },
    
    // Issue context
    issue: {
      number: parsedIssueNumber,
      title: issueTitle
    },
    
    // File paths
    paths: {
      featureAnalysis: '/tmp/feature_analysis.txt',
      generatedContent: '/tmp/generated_content.txt'
    },
    
    // Path patterns
    patterns: {
      // Use 'specs' not 'features' based on actual project structure
      featureDirectory: 'specs',
      stepDefinitionsPath: (featureName) => `specs/${featureName}/step_definitions/${featureName}.steps.ts`
    },
    
    // Branch naming
    branch: {
      prefix: 'feature/issue-',
      slugMaxLength: 50
    },
    
    // PR labels
    labels: ['auto-generated', 'bdd-test-plan']
  };
}

module.exports = { getConfig };
