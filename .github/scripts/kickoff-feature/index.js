#!/usr/bin/env node

/**
 * Kickoff Feature Automation - Main Entry Point
 * 
 * Orchestrates the automated feature kickoff workflow:
 * 1. Load and validate configuration
 * 2. Parse AI-generated content
 * 3. Create feature branch
 * 4. Create feature and step definition files
 * 5. Create pull request
 * 6. Post issue comment
 * 
 * This is a refactored, modular version with improved error handling,
 * logging, and maintainability.
 * 
 * @module index
 */

const fs = require('fs');

// Configuration and utilities
const { getConfig } = require('./config');
const logger = require('./logger');
const { handleError } = require('./error-handler');

// Parsers
const { parseGherkinFromContent, validateParsedGherkin } = require('./parsers/gherkin-parser');
const { extractFeatureName, buildBranchName } = require('./parsers/feature-name-parser');

// GitHub operations
const { createGitHubClient } = require('./github/github-client');
const { getDefaultBranch, createBranch } = require('./github/branch-manager');
const { createFiles } = require('./github/file-manager');
const { createPullRequestWithLabels } = require('./github/pr-manager');
const { postComment } = require('./github/issue-manager');

// Templates
const { generateStepDefinitions } = require('./templates/step-definitions');
const { generatePRBody } = require('./templates/pr-body');
const { generateSuccessComment } = require('./templates/issue-comment');

/**
 * Main execution function
 */
async function main() {
  const overallTimer = logger.timer('Kickoff feature automation');
  
  let config;
  let client;
  
  try {
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1: Load and validate configuration
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('CONFIGURATION');
    
    config = getConfig();
    logger.info('Configuration loaded', {
      owner: config.github.owner,
      repo: config.github.repo,
      issue: config.issue.number
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 2: Initialize GitHub client
    // ═══════════════════════════════════════════════════════════════════════
    client = createGitHubClient({
      token: config.github.token,
      owner: config.github.owner,
      repo: config.github.repo
    });
    
    logger.info('GitHub client initialized');
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 3: Read AI-generated content from files
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('PARSING AI RESPONSES');
    
    const featureAnalysis = fs.readFileSync(config.paths.featureAnalysis, 'utf8');
    const generatedContent = fs.readFileSync(config.paths.generatedContent, 'utf8');
    
    logger.debug('AI responses loaded', {
      analysisLength: featureAnalysis.length,
      contentLength: generatedContent.length
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 4: Parse Gherkin content
    // ═══════════════════════════════════════════════════════════════════════
    const parseTimer = logger.timer('Parse Gherkin content');
    
    const parsed = parseGherkinFromContent(generatedContent);
    validateParsedGherkin(parsed);
    
    const { featureFilePath, gherkinContent } = parsed;
    
    parseTimer();
    logger.info('Parsed Gherkin content', {
      featureFilePath,
      contentLength: gherkinContent.length
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 5: Extract metadata
    // ═══════════════════════════════════════════════════════════════════════
    const featureName = extractFeatureName(featureFilePath);
    const branchName = buildBranchName(
      config.issue.number,
      config.issue.title,
      config.branch.slugMaxLength
    );
    const stepDefsFile = config.patterns.stepDefinitionsPath(featureName);
    
    logger.info('Metadata extracted', {
      featureName,
      branchName,
      stepDefsFile
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 6: Create feature branch
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('BRANCH CREATION');
    
    const defaultBranch = await getDefaultBranch(client);
    const branchResult = await createBranch(client, branchName, defaultBranch.sha);
    
    if (branchResult.created) {
      logger.info('New branch created');
    } else {
      logger.warn('Using existing branch');
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 7: Create files (feature + step definitions)
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('FILE CREATION');
    
    const stepDefsContent = generateStepDefinitions({
      featureName,
      issueTitle: config.issue.title,
      issueNumber: config.issue.number
    });
    
    const filesTimer = logger.timer('Create files');
    
    const fileResults = await createFiles(client, [
      {
        path: featureFilePath,
        content: gherkinContent,
        message: `Add BDD test plan for issue #${config.issue.number}: ${config.issue.title}`,
        branch: branchName
      },
      {
        path: stepDefsFile,
        content: stepDefsContent,
        message: `Add step definitions stub for issue #${config.issue.number}`,
        branch: branchName
      }
    ]);
    
    filesTimer();
    
    // Check if any files failed
    if (fileResults.failed.length > 0) {
      throw new Error(
        `Failed to create ${fileResults.failed.length} file(s): ${
          fileResults.failed.map(f => f.file).join(', ')
        }`
      );
    }
    
    logger.info('All files created successfully');
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 8: Create pull request with labels
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('PULL REQUEST CREATION');
    
    const prBody = generatePRBody({
      issueNumber: config.issue.number,
      featureFilePath,
      stepDefsFile,
      branchName,
      featureAnalysis
    });
    
    const pr = await createPullRequestWithLabels(
      client,
      {
        title: `Feature: ${config.issue.title}`,
        head: branchName,
        base: defaultBranch.name,
        body: prBody
      },
      config.labels
    );
    
    logger.info('Pull request created with labels', {
      prNumber: pr.number,
      url: pr.url
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Step 9: Post success comment on issue
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('ISSUE COMMENT');
    
    const successComment = generateSuccessComment({
      prNumber: pr.number,
      branchName,
      featureFilePath
    });
    
    await postComment(client, config.issue.number, successComment);
    
    logger.info('Posted success comment to issue');
    
    // ═══════════════════════════════════════════════════════════════════════
    // Completion
    // ═══════════════════════════════════════════════════════════════════════
    overallTimer();
    logger.section('✅ SUCCESS');
    logger.info('All automation steps completed successfully');
    
    process.exit(0);
    
  } catch (error) {
    // ═══════════════════════════════════════════════════════════════════════
    // Error handling
    // ═══════════════════════════════════════════════════════════════════════
    logger.section('❌ ERROR');
    
    await handleError(error, {
      client,
      issueNumber: config?.issue?.number,
      issueTitle: config?.issue?.title
    });
    
    process.exit(1);
  }
}

// Execute main function
if (require.main === module) {
  main();
}

module.exports = { main };
