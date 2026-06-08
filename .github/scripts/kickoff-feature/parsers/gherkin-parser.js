/**
 * Gherkin Parser Module
 * 
 * Pure function for extracting Gherkin feature file path and content
 * from AI-generated markdown responses.
 * 
 * Implements multiple fallback strategies to handle various response formats.
 * 
 * @module parsers/gherkin-parser
 */

const logger = require('../logger');

/**
 * Parse Gherkin content from AI-generated markdown
 * 
 * Attempts multiple extraction strategies:
 * 1. Primary: Extract from "### ✅ Final Gherkin" section
 * 2. Fallback 1: Match any backtick-wrapped path + gherkin block
 * 3. Fallback 2: Match plain path mention + gherkin block
 * 
 * @param {string} content - AI-generated markdown content
 * @returns {Object} Parsed result
 * @returns {string} result.featureFilePath - Path to feature file (e.g., 'specs/my-feature/my-feature.feature')
 * @returns {string} result.gherkinContent - Gherkin content (trimmed)
 * @throws {Error} If unable to extract path and content from response
 * 
 * @example
 * const result = parseGherkinFromContent(aiResponse);
 * console.log(result.featureFilePath); // 'specs/user-auth/user-auth.feature'
 * console.log(result.gherkinContent);  // 'Feature: ...'
 */
function parseGherkinFromContent(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Content must be a non-empty string');
  }
  
  // Strategy 1: Primary extraction from "### ✅ Final Gherkin" section
  const finalGherkinMatch = content.match(
    /###\s+✅\s+Final Gherkin[^\n]*\n[\s\S]*?`(specs\/[^`]+\.feature)`[\s\S]*?```gherkin\n([\s\S]+?)```/i
  );
  
  if (finalGherkinMatch) {
    logger.debug('Extracted Gherkin using primary strategy (Final Gherkin section)');
    return {
      featureFilePath: finalGherkinMatch[1],
      gherkinContent: finalGherkinMatch[2].trim()
    };
  }
  
  // Strategy 2: Fallback - find any backtick-wrapped path + gherkin block
  const pathMatch = content.match(/`(specs\/[^`]+\.feature)`/);
  const codeMatch = content.match(/```gherkin\n([\s\S]+?)```/);
  
  if (pathMatch && codeMatch) {
    logger.warn('Using fallback Gherkin extraction (backtick path)');
    return {
      featureFilePath: pathMatch[1],
      gherkinContent: codeMatch[1].trim()
    };
  }
  
  // Strategy 3: Last resort - find plain path + gherkin block
  const plainPathMatch = content.match(/specs\/([\w-]+)\/([\w-]+)\.feature/);
  
  if (plainPathMatch && codeMatch) {
    logger.warn('Using fallback Gherkin extraction (plain path)');
    return {
      featureFilePath: plainPathMatch[0],
      gherkinContent: codeMatch[1].trim()
    };
  }
  
  // All strategies failed
  const errorMessage = [
    'Could not extract feature file path and Gherkin content from AI response.',
    '',
    'Expected format:',
    '  ### ✅ Final Gherkin',
    '  `specs/feature-name/feature-name.feature`',
    '  ```gherkin',
    '  Feature: ...',
    '  ```',
    '',
    `Content preview (first 500 chars): ${content.substring(0, 500)}...`
  ].join('\n');
  
  throw new Error(errorMessage);
}

/**
 * Validate parsed Gherkin content
 * 
 * @param {Object} parsed - Parsed Gherkin result
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateParsedGherkin(parsed) {
  if (!parsed.featureFilePath) {
    throw new Error('Feature file path is empty');
  }
  
  if (!parsed.featureFilePath.startsWith('specs/')) {
    throw new Error(`Feature file path must start with 'specs/', got: ${parsed.featureFilePath}`);
  }
  
  if (!parsed.featureFilePath.endsWith('.feature')) {
    throw new Error(`Feature file path must end with '.feature', got: ${parsed.featureFilePath}`);
  }
  
  if (!parsed.gherkinContent) {
    throw new Error('Gherkin content is empty');
  }
  
  if (!parsed.gherkinContent.includes('Feature:')) {
    throw new Error('Gherkin content does not contain "Feature:" keyword');
  }
  
  return true;
}

module.exports = {
  parseGherkinFromContent,
  validateParsedGherkin
};
