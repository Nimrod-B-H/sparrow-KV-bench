/**
 * Issue Comment Template Generator
 * 
 * Generates markdown content for GitHub issue comments
 * (both success and failure scenarios).
 * 
 * @module templates/issue-comment
 */

/**
 * Generate success comment for issue
 * 
 * Posted when the automation successfully creates a PR.
 * 
 * @param {Object} options - Template options
 * @param {number} options.prNumber - Pull request number
 * @param {string} options.branchName - Branch name
 * @param {string} options.featureFilePath - Path to feature file
 * @returns {string} Markdown comment content
 */
function generateSuccessComment({ prNumber, branchName, featureFilePath }) {
  return [
    '## ✅ BDD Test Plan Generated',
    '',
    `**Pull Request:** #${prNumber}`,
    `**Branch:** \`${branchName}\``,
    `**Feature File:** \`${featureFilePath}\``,
    '',
    'Review the comprehensive test plan in the PR!',
    '',
    '*Generated using two-step AI workflow: feature analysis → test plan*'
  ].join('\n');
}

/**
 * Generate failure comment for issue
 * 
 * Posted when the automation fails, providing manual fallback instructions.
 * 
 * @param {Object} options - Template options
 * @param {string} options.issueTitle - GitHub issue title
 * @param {string} options.errorMessage - Error message to include
 * @returns {string} Markdown comment content
 */
function generateFailureComment({ issueTitle, errorMessage }) {
  return [
    '## ⚠️ Automated Feature Kickoff Failed',
    '',
    'Unable to automatically generate the test plan. Please manually apply:',
    '',
    '### Use Copilot Prompts:',
    '- [`@copilot /learn-feature-request`](.github/prompts/learn-feature-request.prompt.md) - Analyse feature',
    '- [`@copilot /create-test-plan`](.github/prompts/create-test-plan.prompt.md) - Create Gherkin scenarios',
    '',
    '### Manual Test Plan Template:',
    '',
    '```gherkin',
    `Feature: ${issueTitle}`,
    '  ',
    '  Scenario: Happy path',
    '    Given [initial state]',
    '    When [action]',
    '    Then [expected outcome]',
    '  ',
    '  Scenario: Error handling',
    '    Given [error condition]',
    '    When [action]',
    '    Then [error response]',
    '```',
    '',
    '---',
    '',
    `*Error: ${errorMessage}*`
  ].join('\n');
}

module.exports = {
  generateSuccessComment,
  generateFailureComment
};
