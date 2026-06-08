/**
 * Structured Logger Module
 * 
 * Provides consistent, structured logging throughout the application
 * with context, timing, and different log levels.
 * 
 * @module logger
 */

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Current log level (can be controlled via environment)
 */
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format timestamp in ISO format
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with emoji and structure
 */
function formatMessage(level, message, context = {}) {
  const emoji = {
    DEBUG: '🔍',
    INFO: 'ℹ️ ',
    WARN: '⚠️ ',
    ERROR: '❌'
  }[level] || '';
  
  const prefix = `[${timestamp()}] ${emoji} ${level}:`;
  
  if (Object.keys(context).length === 0) {
    return `${prefix} ${message}`;
  }
  
  return `${prefix} ${message} ${JSON.stringify(context)}`;
}

/**
 * Log debug message (only shown if LOG_LEVEL=DEBUG)
 */
function debug(message, context = {}) {
  if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', message, context));
  }
}

/**
 * Log info message
 */
function info(message, context = {}) {
  if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', message, context));
  }
}

/**
 * Log warning message
 */
function warn(message, context = {}) {
  if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', message, context));
  }
}

/**
 * Log error message
 */
function error(message, context = {}) {
  if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', message, context));
  }
}

/**
 * Create a timer to measure operation duration
 * 
 * @param {string} operationName - Name of the operation being timed
 * @returns {Function} Function to call when operation completes
 * 
 * @example
 * const endTimer = timer('Parse Gherkin');
 * // ... do work ...
 * endTimer(); // Logs: ⏱️  Parse Gherkin completed in 123ms
 */
function timer(operationName) {
  const start = Date.now();
  
  return () => {
    const duration = Date.now() - start;
    info(`⏱️  ${operationName} completed`, { duration: `${duration}ms` });
  };
}

/**
 * Log section separator for better readability
 */
function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

module.exports = {
  debug,
  info,
  warn,
  error,
  timer,
  section,
  LOG_LEVELS
};
