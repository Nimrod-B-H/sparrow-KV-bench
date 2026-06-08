/**
 * Pull Request Body Template Generator
 * 
 * Generates markdown content for automated pull request descriptions.
 * 
 * @module templates/pr-body
 */

/**
 * Generate pull request body content
 * 
 * Creates a structured markdown description for the auto-generated PR
 * including links to files, analysis, and next steps.
 * 
 * @param {Object} options - Template options
 * @param {number} options.issueNumber - GitHub issue number
 * @param {string} options.featureFilePath - Path to feature file
 * @param {string} options.stepDefsFile - Path to step definitions file
 * @param {string} options.branchName - Branch name
 * @param {string} options.featureAnalysis - AI-generated feature analysis
 * @returns {string} Markdown PR body
 */
function generatePRBody({
  issueNumber,
  featureFilePath,
  stepDefsFile,
  branchName,
  featureAnalysis
}) {
  return [
    '## 🤖 Auto-generated BDD Test Plan',
    '',
    `**Issue:** #${issueNumber}`,
    `**Feature File:** \`${featureFilePath}\``,
    `**Step Definitions:** \`${stepDefsFile}\``,
    '',
    '### AI-Generated Feature Analysis',
    '',
    '<details><summary>Click to expand</summary>',
    '',
    featureAnalysis,
    '',
    '</details>',
    '',
    '### Next Steps',
    `1. Review the scenarios in [\`${featureFilePath}\`](../blob/${branchName}/${featureFilePath})`,
    `2. Implement the feature for issue #${issueNumber} (by prompt or manually)`,
    `3. Use [\`@copilot /implement-step-definitions\`](.github/prompts/implement-step-definitions.prompt.md) to implement the step definitions`,
    '4. Run tests: `pnpm test:bdd`',
    '',
    `*Closes #${issueNumber} once merged*`
  ].join('\n');
}

module.exports = {
  generatePRBody
};
