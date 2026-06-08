/**
 * Step Definitions Template Generator
 * 
 * Generates TypeScript step definition stub files for BDD feature tests.
 * 
 * @module templates/step-definitions
 */

/**
 * Generate step definitions stub content
 * 
 * Creates a TypeScript file with imports and placeholder comments
 * for implementing step definitions.
 * 
 * @param {Object} options - Template options
 * @param {string} options.featureName - Name of the feature
 * @param {string} options.issueTitle - GitHub issue title
 * @param {number} options.issueNumber - GitHub issue number
 * @returns {string} TypeScript step definitions stub content
 * 
 * @example
 * const content = generateStepDefinitions({
 *   featureName: 'user-auth',
 *   issueTitle: 'Add user authentication',
 *   issueNumber: 42
 * });
 */
function generateStepDefinitions({ featureName, issueTitle, issueNumber }) {
  return [
    `// Step definitions for ${issueTitle}`,
    `// Generated from issue #${issueNumber}`,
    '',
    "import { Given, When, Then } from '@cucumber/cucumber';",
    "import { expect } from 'chai';",
    '',
    '// Implement your step definitions here',
    '// Use the @copilot /implement-step-definitions prompt to generate implementation',
    '',
    '// Example:',
    "// Given('a precondition', async function() {",
    '//   this.context = await setupPrecondition();',
    '// });',
    '',
    "// When('an action occurs', async function() {",
    '//   this.result = await performAction(this.context);',
    '// });',
    '',
    "// Then('an outcome is expected', function() {",
    '//   expect(this.result).to.be.true;',
    '// });',
    ''
  ].join('\n');
}

module.exports = {
  generateStepDefinitions
};
